from __future__ import annotations

import json
import uuid

import anyio
from aiohttp import ClientResponseError, ClientSession, ClientTimeout

from .live_check import rpc
from .metadata import Metadata
from .models import JSON_OBJECT, BridgeError, Config, JsonObject, obj, text


async def check() -> None:
    settings = Config()
    metadata = Metadata(settings.state_dir)
    base = f"http://127.0.0.1:{settings.port}"
    devices: list[str] = []
    passed: list[str] = []
    try:
        async with ClientSession(timeout=ClientTimeout(total=65)) as client:

            async def register(owner: str) -> JsonObject:
                async with client.post(
                    f"{base}/v1/pair",
                    json={"code": metadata.pair_code(owner), "label": "security-QA"},
                ) as response:
                    result = JSON_OBJECT.validate_json(await response.read())
                    assert response.status == 200, result
                    devices.append(text(result["deviceId"]))
                    return result

            async def ticket(device: JsonObject) -> str:
                async with client.post(
                    f"{base}/v1/connect",
                    headers={"Authorization": f"Bearer {text(device['token'])}"},
                ) as response:
                    assert response.status == 200
                    result = JSON_OBJECT.validate_json(await response.read())
                    return text(result["ticket"])

            first, second, foreign = (
                await register("jin"),
                await register("jin"),
                await register("qa-foreign"),
            )
            async with client.post(
                f"{base}/v1/connect",
                headers={
                    "Origin": "https://evil.test",
                    "Authorization": f"Bearer {text(first['token'])}",
                },
            ) as response:
                assert response.status == 403
                passed.append("untrusted-origin-rejected")
            first_ticket = await ticket(first)
            async with client.ws_connect(
                f"{base}/v1/ws", protocols=["obsidian-hermes-v1", f"oh-ticket.{first_ticket}"]
            ) as socket:
                try:
                    await client.ws_connect(
                        f"{base}/v1/ws",
                        protocols=["obsidian-hermes-v1", f"oh-ticket.{first_ticket}"],
                    )
                except ClientResponseError as error:
                    assert error.status == 401
                    passed.append("ticket-single-use")
                else:
                    raise AssertionError("ticket reused")
                try:
                    await rpc(socket, "shell.exec", {"command": "whoami"})
                except BridgeError as error:
                    assert error.reason == "method_not_allowed"
                    passed.append("arbitrary-native-rpc-rejected")
                operation_id = str(uuid.uuid4())
                created = await rpc(socket, "sessions.create", {"operationId": operation_id})
                session_id = text(obj(created["snapshot"])["logicalSessionId"])
                second_ticket = await ticket(second)
                async with client.ws_connect(
                    f"{base}/v1/ws", protocols=["obsidian-hermes-v1", f"oh-ticket.{second_ticket}"]
                ) as other:
                    operation = await rpc(other, "operations.get", {"operationId": operation_id})
                    assert operation["logicalSessionId"] == session_id
                    passed.append("same-owner-other-device-receipt")
                foreign_ticket = await ticket(foreign)
                async with client.ws_connect(
                    f"{base}/v1/ws", protocols=["obsidian-hermes-v1", f"oh-ticket.{foreign_ticket}"]
                ) as other:
                    try:
                        await rpc(other, "operations.get", {"operationId": operation_id})
                    except BridgeError as error:
                        assert error.reason == "operation_forbidden"
                        passed.append("foreign-owner-receipt-rejected")
                    else:
                        raise AssertionError("foreign operation visible")
                    try:
                        await rpc(
                            other, "operations.get", {"operationId": operation_id, "ownerId": "jin"}
                        )
                    except BridgeError as error:
                        assert error.reason == "invalid_params"
                        passed.append("owner-spoof-rejected")
                    else:
                        raise AssertionError("spoof accepted")
            revocable = await ticket(second)
            metadata.revoke(text(second["deviceId"]))
            try:
                await client.ws_connect(
                    f"{base}/v1/ws", protocols=["obsidian-hermes-v1", f"oh-ticket.{revocable}"]
                )
            except ClientResponseError as error:
                assert error.status == 401
                passed.append("revoked-device-unspent-ticket-rejected")
            else:
                raise AssertionError("revoked ticket accepted")
            print(json.dumps({"checks": passed, "count": len(passed)}, ensure_ascii=False))
    finally:
        for device_id in devices:
            metadata.revoke(device_id)
        metadata.close()


if __name__ == "__main__":
    anyio.run(check)
