from __future__ import annotations

import json

import pytest

from kk_bridge.model_controls import ModelControls
from kk_bridge.models import BridgeError, Config, JsonObject, Rpc, obj
from kk_bridge.native import Native
from kk_bridge.protocol import parse_rpc


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


class Authority(Native):
    def __init__(self) -> None:
        super().__init__(Config())
        self.model = "model-a"
        self.effort = "medium"
        self.running = False
        self.reasoning = True
        self.available = True
        self.mutations = 0
        self.guard = False
        self.stats: JsonObject = {
            "context_tokens": 24000,
            "context_length": 128000,
            "model": "model-a",
            "provider": "configured",
        }

    async def rpc(self, method: str, params: JsonObject) -> JsonObject:
        match method:
            case "session.stats":
                return self.stats
            case "model.options":
                return {
                    "model": self.model,
                    "provider": "configured",
                    "providers": [
                        {
                            "slug": "configured",
                            "name": "Configured",
                            "authenticated": True,
                            "models": ["model-a", "model-b"],
                            "api_key": "secret-not-for-client",
                            "usage": {"windows": [{"label": "Session", "used_percent": 39,
                                                   "resets_at": "2026-11-17T02:42:00Z",
                                                   "api_key": "secret-not-for-client"}]},
                            "capabilities": {
                                name: {"reasoning": self.reasoning}
                                for name in ["model-a", "model-b"]
                            },
                            "unavailable_models": [] if self.available else ["model-b"],
                        },
                        {"slug": "no-login", "authenticated": False, "models": ["private-model"]},
                    ],
                }
            case "session.resume":
                return {
                    "session_id": "s",
                    "revision": 2,
                    "execution_generation": 4,
                    "running": self.running,
                    "info": {
                        "model": self.model,
                        "provider": "configured",
                        "reasoning_effort": self.effort,
                        "reasoning_effort_wire": self.effort,
                    },
                }
            case "session.mutate":
                self.mutations += 1
                if self.guard:
                    return {
                        "status": "confirmation_required",
                        "confirm": "a" * 64,
                        "confirm_message": "Confirm this selection",
                    }
                if params["expected_revision"] != 2 or params["expected_generation"] != 4:
                    raise BridgeError("revision_conflict")
                payload = obj(params["payload"])
                if params["operation"] == "model":
                    self.model = str(payload["model"])
                else:
                    self.effort = str(payload["effort"])
                return {"revision": 3}
            case _:
                raise BridgeError("method_not_allowed")


def pick() -> JsonObject:
    return {
        "logicalSessionId": "s",
        "requestId": "abcdef12-1234-4234-8234-123456789012",
        "expectedRevision": 2,
        "expectedGeneration": 4,
        "provider": "configured",
        "model": "model-b",
    }


@pytest.mark.anyio
async def test_inventory_projects_only_client_model_fields() -> None:
    result = await ModelControls(Authority()).read("s")
    assert "secret-not-for-client" not in json.dumps(result)
    assert "private-model" not in json.dumps(result)
    assert len(result["options"]) == 2
    assert result["usage"] == [{"provider": "configured", "label": "Session", "usedPercent": 39,
                                "resetsAt": "2026-11-17T02:42:00Z"}]


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("overrides", "expected"),
    [
        ({}, {"usedTokens": 24000, "maxTokens": 128000}),
        ({"context_tokens": 0}, {"usedTokens": 0, "maxTokens": 128000}),
        ({"context_tokens": 200000}, {"usedTokens": 128000, "maxTokens": 128000}),
        ({"context_length": None}, None),
        ({"context_length": 0}, None),
        ({"context_tokens": -1}, None),
        ({"context_tokens": True}, None),
        ({"context_tokens": "24000"}, None),
        ({"model": "previous-model"}, None),
        ({"provider": "previous-provider"}, None),
    ],
)
async def test_context_meter_uses_only_current_model_context_stats(
    overrides: JsonObject, expected: JsonObject | None,
) -> None:
    native = Authority()
    native.stats.update(overrides)
    result = await ModelControls(native).read("s")
    assert result["contextUsage"] == expected


@pytest.mark.anyio
@pytest.mark.parametrize("refusal", ["unavailable", "running", "foreign-provider"])
async def test_refused_model_pick_never_mutates_authority(refusal: str) -> None:
    native = Authority()
    params = pick()
    if refusal == "unavailable":
        native.available = False
    elif refusal == "running":
        native.running = True
    else:
        params["provider"] = "no-login"
    with pytest.raises(BridgeError):
        await ModelControls(native).change("models.set", params)
    assert native.mutations == 0
    assert native.model == "model-a"


@pytest.mark.anyio
async def test_unsupported_reasoning_never_mutates_authority() -> None:
    native = Authority()
    native.reasoning = False
    params = {key: value for key, value in pick().items() if key not in {"model", "provider"}}
    with pytest.raises(BridgeError, match="reasoning_unsupported"):
        await ModelControls(native).change("reasoning.set", {**params, "effort": "high"})
    assert native.mutations == 0


@pytest.mark.anyio
async def test_model_confirmation_is_not_reported_as_applied() -> None:
    native = Authority()
    native.guard = True
    result = await ModelControls(native).change("models.set", pick())
    assert result["status"] == "confirmation_required"
    assert "settings" not in result
    assert native.model == "model-a"


@pytest.mark.anyio
async def test_stale_selection_keeps_the_previous_model() -> None:
    native = Authority()
    with pytest.raises(BridgeError, match="revision_conflict"):
        await ModelControls(native).change("models.set", {**pick(), "expectedRevision": 1})
    assert native.model == "model-a"


@pytest.mark.parametrize("field", ["api_key", "base_url", "scope", "payload"])
def test_model_control_protocol_rejects_unrelated_parameters(field: str) -> None:
    with pytest.raises(BridgeError, match="invalid_params"):
        parse_rpc(Rpc(id="request", method="models.set", params={**pick(), field: "untrusted"}))
