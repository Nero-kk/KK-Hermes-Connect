from __future__ import annotations

import time

import anyio
from aiohttp import ClientSession
from anyio.abc import TaskGroup
from pydantic import JsonValue

from .metadata import Metadata
from .model_controls import ModelControls
from .models import BridgeError, Config, JsonObject, obj, text
from .native import Native
from .operations import Operations
from .projection import snapshot, summaries, transcript
from .requests import Requests
from .viewer import Viewer


class Hub:
    def __init__(self, config: Config, metadata: Metadata) -> None:
        self.config = config
        self.metadata = metadata
        self.native = Native(config)
        self.native.on_event = self.event
        self.operations = Operations(self.native, metadata)
        self.requests = Requests(self.native)
        self.model_controls = ModelControls(self.native)
        self.viewers: list[Viewer] = []
        self.mounted: dict[str, float] = {}
        self.catalog: dict[str, JsonObject] = {}
        self.group: TaskGroup | None = None
        self.session: ClientSession | None = None

    async def ready(self) -> None:
        if self.group is None or self.session is None:
            raise BridgeError("bridge_unavailable")
        if not self.native.connected or not self.native.verified:
            self.requests.registry.clear()
            self.requests.responding.clear()
            await self.native.attach(self.session, self.group)

    async def history(self, params: JsonObject) -> JsonObject:
        native_params: JsonObject = {
            "session_id": text(params.get("logicalSessionId")),
            "limit": 100,
            "order": "latest",
        }
        cursor = params.get("cursor")
        if isinstance(cursor, str):
            native_params["cursor"] = cursor
        return transcript(await self.native.rpc("session.transcript", native_params))

    async def open(self, session_id: str, viewer: Viewer) -> JsonObject:
        raw = await self.native.rpc(
            "session.resume", {"session_id": session_id, "omit_messages": True}
        )
        canonical = text(raw.get("session_id"))
        viewer.sessions.add(canonical)
        self.mounted[canonical] = time.monotonic()
        page = await self.history({"logicalSessionId": canonical})
        info = obj(raw.get("info", {}))
        if not info.get("source"):
            if canonical not in self.catalog:
                listed = await self.native.rpc("session.list", {"scope": "stored", "limit": 200})
                for item in summaries(listed, self.native.profile_id):
                    self.catalog[text(item["logicalSessionId"])] = item
            known = self.catalog.get(canonical, {})
            raw["info"] = {
                **info,
                "source": known.get("source", "unknown"),
                "title": known.get("title", "Chat with Yeon"),
            }
        operations: list[JsonValue] = []
        for item in self.metadata.for_session(canonical, viewer.device):
            if item["phase"] in {"preparing", "admitted", "queued", "running", "unknown"}:
                item = await self.operations.get(text(item["operationId"]), viewer.device)
            operations.append(item)
        return {
            **snapshot(raw, page, self.native.profile_id),
            "requests": self.requests.sync(raw),
            "operations": operations,
            "instanceId": self.native.instance,
        }

    async def dispatch(self, method: str, params: JsonObject, viewer: Viewer) -> JsonObject:
        if viewer.device.owner_id != self.config.owner_id:
            raise BridgeError("operation_forbidden")
        await self.ready()
        if "profileId" in params and params["profileId"] != self.native.profile_id:
            raise BridgeError("profile_mismatch")
        match method:
            case "bridge.hello":
                if (
                    params.get("apiVersion") != 1
                    or params.get("deviceId") != viewer.device.device_id
                ):
                    raise BridgeError("authentication_required")
                return {
                    "apiVersion": 1,
                    "serverId": self.metadata.server_id,
                    "profileId": self.native.profile_id,
                    "profileName": self.config.profile,
                    "instanceId": self.native.instance,
                    "codeSha": self.native.code_sha,
                    "capabilities": self.native.describe.get("capabilities", []),
                    "limits": {"textBytes": 65536, "frameBytes": 2 * 1024 * 1024},
                }
            case "bridge.ping":
                return {"nonce": params.get("nonce"), "serverTime": time.time()}
            case "sessions.list":
                listed = await self.native.rpc(
                    "session.list", {"scope": "stored", "limit": 200, "picker": True}
                )
                items = summaries(listed, self.native.profile_id)
                for item in items:
                    self.catalog[text(item["logicalSessionId"])] = item
                query = str(params.get("query", "")).casefold()
                filtered: list[JsonValue] = [
                    item
                    for item in items
                    if query in (str(item["title"]) + str(item["logicalSessionId"])).casefold()
                    and (not params.get("source") or item["source"] == params["source"])
                ]
                return {
                    "summaries": filtered,
                    "nextCursor": None,
                    "listingComplete": len(items) < 200,
                    "searchScope": "loaded",
                    "loadedCount": len(items),
                }
            case "sessions.open":
                cursor = params.get("cursor")
                if isinstance(cursor, dict):
                    await self.native.rpc(
                        "session.events.since",
                        {
                            "session_id": text(params.get("logicalSessionId")),
                            "replay_epoch": text(cursor.get("replayEpoch")),
                            "last_sequence": cursor.get("sequence", 0),
                        },
                    )
                return await self.open(text(params.get("logicalSessionId")), viewer)
            case "sessions.create":
                operation = await self.operations.execute("create", params, viewer.device)
                result = obj(operation["result"])
                if operation["phase"] == "completed":
                    return {
                        "operation": operation,
                        "snapshot": await self.open(text(result["logicalSessionId"]), viewer),
                    }
                return {"operation": operation}
            case "operations.get":
                return await self.operations.get(text(params.get("operationId")), viewer.device)
            case "operations.cancel":
                return await self.operations.cancel(text(params.get("operationId")), viewer.device)
        session_id = text(params.get("logicalSessionId"))
        if session_id not in viewer.sessions:
            raise BridgeError("session_not_open")
        match method:
            case "sessions.history":
                return await self.history(params)
            case "sessions.release":
                viewer.sessions.discard(session_id)
                return {"released": True}
            case "messages.send":
                return await self.operations.execute("send", params, viewer.device)
            case "sessions.fork":
                operation = await self.operations.execute("fork", params, viewer.device)
                result = obj(operation["result"])
                if operation["phase"] == "completed":
                    return {
                        "operation": operation,
                        "snapshot": await self.open(text(result["logicalSessionId"]), viewer),
                    }
                return {"operation": operation}
            case "requests.respond":
                return await self.requests.respond(params)
            case "models.get":
                return await self.model_controls.read(session_id)
            case "models.set" | "reasoning.set":
                return await self.model_controls.change(method, params)
            case _:
                raise BridgeError("method_not_allowed")

    async def event(self, frame: JsonObject) -> None:
        params = obj(frame.get("params", {}))
        method = frame.get("method")
        if method == "event":
            session_id = str(params.get("session_id", ""))
            kind = str(params.get("type", ""))
            payload = obj(params.get("payload", {}))
            normalized: JsonObject = {
                "logicalSessionId": session_id,
                "instanceId": self.native.instance,
                "replayEpoch": params.get("replay_epoch"),
                "sequence": params.get("seq"),
                "kind": kind,
            }
            if kind == "message.delta":
                normalized.update(
                    {
                        "text": payload.get("text"),
                        "turnId": payload.get("turn_id"),
                        "segment": payload.get("segment"),
                        "offset": payload.get("offset"),
                    }
                )
            elif kind.startswith("tool."):
                normalized.update(
                    {
                        "toolId": payload.get("tool_id"),
                        "name": payload.get("name"),
                        "summary": payload.get("summary"),
                        "result": payload.get("result"),
                    }
                )
            await self.broadcast("session.event", normalized, session_id)
        elif isinstance(frame.get("id"), str):
            session_id = str(params.get("session_id", ""))
            await self.broadcast("session.changed", {"logicalSessionId": session_id}, session_id)

    async def broadcast(self, method: str, params: JsonObject, session_id: str) -> None:
        for viewer in list(self.viewers):
            if session_id in viewer.sessions and not viewer.socket.closed:
                try:
                    with anyio.fail_after(2):
                        await viewer.socket.send_json(
                            {"jsonrpc": "2.0", "method": method, "params": params}
                        )
                except (ConnectionError, TimeoutError):
                    await viewer.socket.close()

    async def maintain(self) -> None:
        while True:
            await anyio.sleep(3)
            for viewer in list(self.viewers):
                if not self.metadata.active(viewer.device):
                    await viewer.socket.close(code=4001, message=b"device_revoked")
            if not self.native.connected:
                continue
            for session_id, last_seen in list(self.mounted.items()):
                watching = any(session_id in v.sessions for v in self.viewers)
                if watching:
                    self.mounted[session_id] = time.monotonic()
                    continue
                if time.monotonic() - last_seen < 600:
                    continue
                try:
                    current = await self.native.rpc(
                        "session.resume", {"session_id": session_id, "omit_messages": True}
                    )
                    if (
                        current.get("running")
                        or current.get("pending")
                        or current.get("prompts")
                        or current.get("open_requests")
                        or self.metadata.has_uncertain(session_id)
                    ):
                        continue
                    await self.native.rpc("session.detach", {"session_id": session_id})
                    self.mounted.pop(session_id)
                except BridgeError:
                    self.mounted.pop(session_id)
