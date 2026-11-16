from __future__ import annotations

import secrets
import sqlite3
import time
from collections import deque
from collections.abc import AsyncIterator
from dataclasses import dataclass
from urllib.parse import urlsplit

import anyio
from aiohttp import ClientError, ClientSession, ClientTimeout, WSMsgType, web
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from .hub import Hub
from .metadata import Metadata
from .models import BridgeError, Config, Device, Rpc
from .protocol import parse_rpc
from .viewer import Viewer


class PairInput(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    code: str = Field(min_length=16, max_length=128)
    label: str = Field(min_length=1, max_length=100)


@dataclass(frozen=True, slots=True)
class Ticket:
    device: Device
    expires: float


def create_app(config: Config) -> web.Application:
    metadata = Metadata(config.state_dir)
    hub = Hub(config, metadata)
    tickets: dict[str, Ticket] = {}
    pair_failures: deque[float] = deque(maxlen=5)

    @web.middleware
    async def boundary(request: web.Request, handler):
        origin = request.headers.get("Origin")
        host = request.headers.get("Host", "")
        allowed_hosts = {
            urlsplit(config.public_origin).netloc,
            f"127.0.0.1:{config.port}",
            f"localhost:{config.port}",
        }
        if host not in allowed_hosts or (origin is not None and origin not in config.origins):
            return web.json_response({"error": "origin_rejected"}, status=403)
        try:
            if request.method == "OPTIONS":
                response = web.Response(status=204)
            else:
                response = await handler(request)
        except BridgeError as exc:
            response = web.json_response(
                {"error": exc.reason},
                status=401
                if exc.reason in {"authentication_required", "invalid_pair_code"}
                else 400,
            )
        except (ValidationError, ValueError):
            response = web.json_response({"error": "invalid_schema"}, status=400)
        if isinstance(response, web.Response):
            response.headers["Cache-Control"] = "no-store"
            response.headers["X-Content-Type-Options"] = "nosniff"
            if origin is not None:
                response.headers.update(
                    {
                        "Access-Control-Allow-Origin": origin,
                        "Vary": "Origin",
                        "Access-Control-Allow-Methods": "POST, OPTIONS",
                        "Access-Control-Allow-Headers": "Authorization, Content-Type",
                    }
                )
        return response

    async def health(request: web.Request) -> web.Response:
        return web.json_response({"status": "ok"})

    async def pair(request: web.Request) -> web.Response:
        now = time.monotonic()
        if len(pair_failures) == 5 and now - pair_failures[0] < 60:
            return web.json_response({"error": "rate_limited"}, status=429)
        body = PairInput.model_validate_json(await request.read())
        await hub.ready()
        try:
            result = metadata.pair(body.code, body.label)
        except BridgeError:
            pair_failures.append(now)
            raise
        return web.json_response({**result, "profileId": hub.native.profile_id, "apiVersion": 1})

    async def connect(request: web.Request) -> web.Response:
        authorization = request.headers.get("Authorization", "")
        if not authorization.startswith("Bearer "):
            raise BridgeError("authentication_required")
        device = metadata.authenticate(authorization[7:])
        now = time.monotonic()
        for key, value in list(tickets.items()):
            if value.expires < now:
                tickets.pop(key)
        if len(tickets) >= 1000:
            raise BridgeError("rate_limited")
        ticket = secrets.token_urlsafe(32)
        tickets[ticket] = Ticket(device, now + 30)
        target = config.public_origin.replace("https://", "wss://", 1)
        return web.json_response(
            {"apiVersion": 1, "wsUrl": f"{target}/v1/ws", "ticket": ticket, "expiresInSeconds": 30}
        )

    async def websocket(request: web.Request) -> web.WebSocketResponse:
        protocols = [
            part.strip() for part in request.headers.get("Sec-WebSocket-Protocol", "").split(",")
        ]
        credentials = [
            part[len("oh-ticket.") :] for part in protocols if part.startswith("oh-ticket.")
        ]
        if len(credentials) != 1 or "obsidian-hermes-v1" not in protocols or len(protocols) != 2:
            raise BridgeError("authentication_required")
        ticket = tickets.pop(credentials[0], None)
        if (
            ticket is None
            or ticket.expires < time.monotonic()
            or not metadata.active(ticket.device)
        ):
            raise BridgeError("authentication_required")
        socket = web.WebSocketResponse(
            protocols=["obsidian-hermes-v1"], heartbeat=15, max_msg_size=2 * 1024 * 1024
        )
        await socket.prepare(request)
        viewer = Viewer(ticket.device, socket)
        hub.viewers.append(viewer)
        try:
            async for message in socket:
                if message.type != WSMsgType.TEXT:
                    continue
                request_id: str | int | None = None
                try:
                    if not metadata.active(viewer.device):
                        raise BridgeError("device_revoked")
                    envelope = Rpc.model_validate_json(message.data)
                    request_id = envelope.id
                    rpc = parse_rpc(envelope)
                    result = await hub.dispatch(rpc.method, rpc.params, viewer)
                    await socket.send_json({"jsonrpc": "2.0", "id": rpc.id, "result": result})
                except BridgeError as exc:
                    await socket.send_json(
                        {
                            "jsonrpc": "2.0",
                            "id": request_id,
                            "error": {"code": -32000, "message": exc.reason},
                        }
                    )
                except (ValidationError, ValueError):
                    await socket.send_json(
                        {
                            "jsonrpc": "2.0",
                            "id": request_id,
                            "error": {"code": -32602, "message": "invalid_schema"},
                        }
                    )
                except (ClientError, TimeoutError, sqlite3.Error):
                    await socket.send_json(
                        {
                            "jsonrpc": "2.0",
                            "id": request_id,
                            "error": {"code": -32000, "message": "outcome_unknown"},
                        }
                    )
        finally:
            hub.viewers.remove(viewer)
        return socket

    async def lifespan(application: web.Application) -> AsyncIterator[None]:
        with metadata.db:
            metadata.db.execute("UPDATE operations SET phase='unknown' WHERE phase='preparing'")
        async with ClientSession(timeout=ClientTimeout(total=50)) as session:
            async with anyio.create_task_group() as group:
                hub.session, hub.group = session, group
                group.start_soon(hub.maintain)
                yield
                for viewer in list(hub.viewers):
                    await viewer.socket.close(code=1001)
                if hub.native.socket is not None:
                    await hub.native.socket.close()
                group.cancel_scope.cancel()
        metadata.close()

    app = web.Application(client_max_size=8192, middlewares=[boundary])
    app.cleanup_ctx.append(lifespan)
    app.router.add_get("/healthz", health)
    app.router.add_post("/v1/pair", pair)
    app.router.add_post("/v1/connect", connect)
    app.router.add_get("/v1/ws", websocket)
    app.router.add_options("/v1/{action:pair|connect}", health)
    return app
