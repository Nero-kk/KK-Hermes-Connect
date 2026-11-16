from __future__ import annotations

import anyio
import pytest

from kk_bridge.models import BridgeError, Config, JsonObject
from kk_bridge.native import Native
from kk_bridge.requests import Requests


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


class Authority(Native):
    def __init__(self) -> None:
        super().__init__(Config())
        self.instance = "test-instance"
        self.accepted: list[JsonObject] = []
        self.responses: list[JsonObject] = []
        self.waiting: list[JsonObject] = [
            {
                "kind": "approval",
                "prompt_id": "p1",
                "execution_generation": 9,
                "choices": ["once", "deny"],
                "description": "approve",
            }
        ]
        self.server_requests: list[JsonObject] = []

    async def rpc(self, method: str, params: JsonObject) -> JsonObject:
        match method:
            case "session.resume":
                current: JsonObject = {
                    "session_id": "s",
                    "prompts": [row for row in self.waiting],
                    "open_requests": [row for row in self.server_requests],
                }
                await anyio.lowlevel.checkpoint()
                return current
            case "approval.respond":
                assert params == {
                    "session_id": "s",
                    "execution_generation": 9,
                    "prompt_id": "p1",
                    "choice": "once",
                }
                self.accepted.append(params)
                self.waiting.clear()
                return {"status": "resolved", "prompt_id": "p1"}
            case _:
                raise BridgeError("method_not_allowed")

    async def send(self, frame: JsonObject) -> None:
        self.responses.append(frame)


@pytest.mark.anyio
async def test_two_devices_racing_the_same_approval_forward_one_valid_answer() -> None:
    authority = Authority()
    requests = Requests(authority)
    cards = requests.sync(await authority.rpc("session.resume", {}))
    card = cards[0]
    assert isinstance(card, dict)
    outcomes: list[str] = []

    async def answer() -> None:
        try:
            await requests.respond(
                {
                    "logicalSessionId": "s",
                    "requestId": card["requestId"],
                    "answer": {"choice": "once"},
                }
            )
            outcomes.append("resolved")
        except BridgeError as error:
            outcomes.append(error.reason)

    async with anyio.create_task_group() as group:
        group.start_soon(answer)
        group.start_soon(answer)
    assert sorted(outcomes) == ["already_answered", "resolved"]
    assert len(authority.accepted) == 1


@pytest.mark.anyio
async def test_unsupported_shared_secret_remains_open_without_a_native_response() -> None:
    authority = Authority()
    authority.waiting.clear()
    authority.server_requests = [
        {"id": "srq-secret", "method": "secret", "params": {"session_id": "s"}}
    ]
    requests = Requests(authority)
    cards = requests.sync(await authority.rpc("session.resume", {}))
    card = cards[0]
    assert isinstance(card, dict)
    with pytest.raises(BridgeError, match="unsupported_interaction"):
        await requests.respond(
            {
                "logicalSessionId": "s",
                "requestId": card["requestId"],
                "answer": {"value": "must-not-be-forwarded"},
            }
        )
    assert authority.responses == []
    assert authority.server_requests[0]["id"] == "srq-secret"


@pytest.mark.anyio
async def test_server_approval_uses_its_frame_id_and_waits_for_native_closure() -> None:
    authority = Authority()
    authority.waiting.clear()
    authority.server_requests = [
        {
            "id": "srq-approval",
            "method": "approval",
            "params": {"session_id": "s", "choices": ["once", "deny"]},
        }
    ]
    requests = Requests(authority)
    cards = requests.sync(await authority.rpc("session.resume", {}))
    card = cards[0]
    assert isinstance(card, dict)
    result = await requests.respond(
        {"logicalSessionId": "s", "requestId": card["requestId"], "answer": {"choice": "once"}}
    )
    assert result == {"state": "responding"}
    assert authority.responses == [
        {"jsonrpc": "2.0", "id": "srq-approval", "result": {"choice": "once"}}
    ]
    with pytest.raises(BridgeError, match="already_answered"):
        await requests.respond(
            {"logicalSessionId": "s", "requestId": card["requestId"], "answer": {"choice": "once"}}
        )
