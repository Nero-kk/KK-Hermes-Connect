from __future__ import annotations

import json
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from urllib.parse import urlsplit

import anyio
from aiohttp import ClientError, ClientSession, ClientWebSocketResponse, WSMsgType
from anyio.abc import TaskGroup

from .models import JSON_OBJECT, BridgeError, Config, JsonObject, obj, text


@dataclass(slots=True)
class Waiting:
    ready: anyio.Event = field(default_factory=anyio.Event)
    frame: JsonObject | None = None


class Native:
    def __init__(self, config: Config) -> None:
        self.config = config
        self.socket: ClientWebSocketResponse | None = None
        self.pending: dict[str, Waiting] = {}
        self.instance = ""
        self.profile_id = ""
        self.code_sha = ""
        self.describe: JsonObject = {}
        self.on_event: Callable[[JsonObject], Awaitable[None]] | None = None
        self.connected = False
        self.verified = False
        self.send_lock = anyio.Lock()
        self.connect_lock = anyio.Lock()

    async def attach(self, session: ClientSession, group: TaskGroup) -> None:
        async with self.connect_lock:
            if self.connected and self.verified:
                return
            with anyio.fail_after(20):
                result = await anyio.run_process(
                    [
                        self.config.hermes,
                        "-p",
                        self.config.profile,
                        "gateway",
                        "attach",
                        "--json",
                        "--timeout",
                        "12",
                    ],
                    check=False,
                )
            try:
                bootstrap = JSON_OBJECT.validate_json(result.stdout)
            except ValueError as exc:
                raise BridgeError("gateway_unavailable") from exc
            if bootstrap.get("state") != "ready":
                raise BridgeError("gateway_unavailable")
            endpoint = obj(bootstrap.get("endpoint"))
            profile = text(endpoint.get("profile_id"))
            if profile.rstrip("/").split("/")[-1] != self.config.profile:
                raise BridgeError("profile_mismatch")
            if endpoint.get("code_sha") != bootstrap.get("client_code_sha"):
                raise BridgeError("incompatible_gateway")
            if endpoint.get("code_sha") != self.config.verified_code_sha:
                raise BridgeError("incompatible_gateway")
            target = text(bootstrap.get("url"))
            parsed = urlsplit(target)
            if parsed.scheme != "ws" or parsed.hostname not in {"127.0.0.1", "localhost", "::1"}:
                raise BridgeError("invalid_upstream")
            protocols = bootstrap.get("protocols")
            if not isinstance(protocols, list) or not all(isinstance(p, str) for p in protocols):
                raise BridgeError("invalid_upstream")
            self.socket = await session.ws_connect(
                target,
                protocols=[text(p) for p in protocols],
                max_msg_size=2 * 1024 * 1024,
                heartbeat=15,
            )
            if self.socket.protocol != bootstrap.get("protocol"):
                await self.socket.close()
                raise BridgeError("incompatible_gateway")
            self.profile_id = profile
            self.instance = text(endpoint.get("instance_id"))
            self.code_sha = text(endpoint.get("code_sha"))
            self.connected = True
            group.start_soon(self.read)
            try:
                self.describe = await self.rpc("runtime.describe", {})
                if (
                    self.describe.get("profile_id") != self.profile_id
                    or self.describe.get("instance_id") != self.instance
                ):
                    raise BridgeError("profile_mismatch")
                capabilities = self.describe.get("capabilities", [])
                if not isinstance(capabilities, list) or not all(
                    item in capabilities for item in ["durable-admission-v1", "event-replay-v1"]
                ):
                    raise BridgeError("incompatible_gateway")
                self.verified = True
            except BridgeError:
                self.connected = self.verified = False
                await self.socket.close()
                raise

    async def read(self) -> None:
        socket = self.socket
        if socket is None:
            return
        try:
            async for message in socket:
                if message.type != WSMsgType.TEXT:
                    continue
                frame = JSON_OBJECT.validate_json(message.data)
                request_id = frame.get("id")
                waiting = self.pending.get(str(request_id))
                if waiting is not None and "method" not in frame:
                    waiting.frame = frame
                    waiting.ready.set()
                elif self.on_event is not None:
                    await self.on_event(frame)
        except (ClientError, ValueError):
            self.connected = False
        finally:
            if self.socket is socket:
                self.connected = self.verified = False
            for waiting in self.pending.values():
                waiting.ready.set()

    async def rpc(self, method: str, params: JsonObject) -> JsonObject:
        import uuid

        request_id = str(uuid.uuid4())
        waiting = Waiting()
        self.pending[request_id] = waiting
        try:
            await self.send(
                {"jsonrpc": "2.0", "id": request_id, "method": method, "params": params}
            )
            with anyio.fail_after(45):
                await waiting.ready.wait()
            frame = waiting.frame
            if frame is None:
                raise BridgeError("outcome_unknown")
            if "error" in frame:
                error = obj(frame["error"])
                reason = str(error.get("message", "native_refused"))
                if len(reason) > 80 or not reason.replace("_", "").isalnum():
                    reason = "native_refused"
                raise BridgeError(reason)
            return obj(frame.get("result"))
        except (TimeoutError, ClientError, ConnectionError) as exc:
            raise BridgeError("outcome_unknown") from exc
        finally:
            self.pending.pop(request_id, None)

    async def send(self, frame: JsonObject) -> None:
        if not self.connected or self.socket is None:
            raise BridgeError("gateway_unavailable")
        async with self.send_lock:
            await self.socket.send_str(json.dumps(frame, ensure_ascii=False))
