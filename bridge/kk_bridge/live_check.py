from __future__ import annotations

import json
import uuid

import anyio
from aiohttp import ClientSession, ClientTimeout, ClientWebSocketResponse, WSMsgType

from .metadata import Metadata
from .models import JSON_OBJECT, BridgeError, Config, JsonObject, obj, rows, text


async def rpc(socket: ClientWebSocketResponse, method: str, params: JsonObject) -> JsonObject:
    request_id = str(uuid.uuid4())
    await socket.send_json({"jsonrpc": "2.0", "id": request_id, "method": method, "params": params})
    with anyio.fail_after(60):
        while True:
            message = await socket.receive()
            if message.type != WSMsgType.TEXT:
                raise BridgeError("socket_closed")
            frame = JSON_OBJECT.validate_json(message.data)
            if frame.get("id") != request_id:
                continue
            if "error" in frame:
                raise BridgeError(text(obj(frame["error"])["message"]))
            return obj(frame["result"])


async def check() -> None:
    config = Config()
    metadata = Metadata(config.state_dir)
    code = metadata.pair_code()
    url = f"http://127.0.0.1:{config.port}"
    device_id = ""
    try:
        async with ClientSession(timeout=ClientTimeout(total=65)) as client:
            async with client.post(
                f"{url}/v1/pair", json={"code": code, "label": "automated-live-QA"}
            ) as response:
                paired = JSON_OBJECT.validate_json(await response.read())
                if response.status != 200:
                    raise BridgeError(str(paired))
            device_id = text(paired["deviceId"])
            token = text(paired["token"])
            async with client.post(
                f"{url}/v1/connect", headers={"Authorization": f"Bearer {token}"}
            ) as response:
                bootstrap = JSON_OBJECT.validate_json(await response.read())
            async with client.ws_connect(
                f"{url}/v1/ws",
                protocols=["obsidian-hermes-v1", f"oh-ticket.{text(bootstrap['ticket'])}"],
            ) as socket:
                hello = await rpc(
                    socket,
                    "bridge.hello",
                    {"apiVersion": 1, "clientVersion": "0.1.0", "deviceId": device_id},
                )
                listed = await rpc(socket, "sessions.list", {})
                create_id = str(uuid.uuid4())
                created = await rpc(socket, "sessions.create", {"operationId": create_id})
                session_id = text(obj(created["snapshot"])["logicalSessionId"])
                duplicate = await rpc(socket, "sessions.create", {"operationId": create_id})
                assert obj(duplicate["snapshot"])["logicalSessionId"] == session_id
                print(
                    json.dumps(
                        {"step": "create", "sessionId": session_id, "duplicateSameSession": True},
                        ensure_ascii=False,
                    ),
                    flush=True,
                )
                operation_id = str(uuid.uuid4())
                params: JsonObject = {
                    "operationId": operation_id,
                    "logicalSessionId": session_id,
                    "text": (
                        "KK Hermes Connect 연결 검수입니다. 도구를 사용하지 말고 OK만 답해주세요."
                    ),
                }
                submitted = await rpc(socket, "messages.send", params)
                retry = await rpc(socket, "messages.send", params)
                assert (
                    obj(submitted["result"])["admission_id"] == obj(retry["result"])["admission_id"]
                )
                print(
                    json.dumps(
                        {"step": "admission", "operationId": operation_id, "sameAdmission": True},
                        ensure_ascii=False,
                    ),
                    flush=True,
                )
                with anyio.fail_after(180):
                    while True:
                        state = await rpc(socket, "operations.get", {"operationId": operation_id})
                        if state["phase"] in {"completed", "failed", "cancelled", "unknown"}:
                            break
                        with anyio.move_on_after(3):
                            await socket.receive()
                opened = await rpc(socket, "sessions.open", {"logicalSessionId": session_id})
                messages = rows(opened["messages"])
                assert len([row for row in messages if row["role"] == "user"]) == 1
                assert state["phase"] == "completed", state["phase"]
                branch = await rpc(
                    socket,
                    "sessions.fork",
                    {"logicalSessionId": session_id, "operationId": str(uuid.uuid4())},
                )
                child = text(obj(branch["snapshot"])["logicalSessionId"])
                assert child != session_id
                assert len(rows(obj(branch["snapshot"])["messages"])) >= len(messages)
                print(
                    json.dumps(
                        {
                            "step": "complete",
                            "serverId": hello["serverId"],
                            "profileId": hello["profileId"],
                            "codeSha": hello["codeSha"],
                            "listedCount": listed["loadedCount"],
                            "sessionId": session_id,
                            "operationId": operation_id,
                            "phase": state["phase"],
                            "userRows": 1,
                            "savedRows": len(messages),
                            "branchSessionId": child,
                            "branchInheritedRows": True,
                        },
                        ensure_ascii=False,
                    ),
                    flush=True,
                )
    finally:
        if device_id:
            metadata.revoke(device_id)
        metadata.close()


if __name__ == "__main__":
    anyio.run(check)
