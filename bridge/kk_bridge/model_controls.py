from __future__ import annotations

from pydantic import JsonValue

from .models import BridgeError, JsonObject, integer, obj, rows, text
from .native import Native

EFFORTS = ("none", "minimal", "low", "medium", "high", "xhigh", "max", "ultra")


class ModelControls:
    def __init__(self, native: Native) -> None:
        self.native: Native = native

    async def read(self, session_id: str) -> JsonObject:
        inventory = await self.native.rpc(
            "model.options", {"session_id": session_id, "include_unconfigured": False}
        )
        raw = await self.native.rpc(
            "session.resume", {"session_id": session_id, "omit_messages": True}
        )
        if raw.get("session_id") != session_id:
            raise BridgeError("session_changed")
        info = obj(raw.get("info", {}))
        selection: JsonObject = {
            "model": info.get("model") or inventory.get("model"),
            "provider": info.get("provider") or inventory.get("provider"),
            "reasoning": info.get("reasoning_effort"),
            "reasoningWire": info.get("reasoning_effort_wire") or "",
        }
        if selection["reasoning"] not in EFFORTS:
            level = await self.native.rpc(
                "config.get", {"session_id": session_id, "key": "reasoning"}
            )
            selection["reasoning"] = level.get("value")
        options: list[JsonValue] = []
        for provider in rows(inventory.get("providers", [])):
            if provider.get("authenticated") is False:
                continue
            slug = text(provider.get("slug"))
            capabilities = obj(provider.get("capabilities") or {})
            unavailable = provider.get("unavailable_models") or []
            models = provider.get("models", [])
            if not isinstance(models, list) or not isinstance(unavailable, list):
                raise BridgeError("invalid_schema")
            for model in models:
                name = text(model)
                capability = obj(capabilities.get(name) or {})
                options.append(
                    {
                        "model": name,
                        "provider": slug,
                        "label": f"{provider.get('name') or slug} · {name}",
                        "available": name not in unavailable,
                        "reasoning": capability.get("reasoning") is True,
                        "canDisableReasoning": capability.get("can_disable_reasoning") is not False,
                    }
                )
        return {
            "logicalSessionId": session_id,
            "selection": selection,
            "options": options,
            "revision": integer(raw.get("revision")),
            "generation": integer(raw.get("execution_generation")),
            "running": raw.get("running") is True,
        }

    async def change(self, method: str, params: JsonObject) -> JsonObject:
        session_id = text(params.get("logicalSessionId"))
        current = await self.read(session_id)
        if current["running"]:
            raise BridgeError("session_busy")
        match method:
            case "models.set":
                option = next(
                    (
                        row
                        for row in rows(current["options"])
                        if row["model"] == params.get("model")
                        and row["provider"] == params.get("provider")
                        and row["available"]
                    ),
                    None,
                )
                if option is None:
                    raise BridgeError("model_unavailable")
                payload: JsonObject = {"model": params["model"], "provider": params["provider"]}
                if params.get("confirm"):
                    payload["confirm"] = params["confirm"]
                operation = "model"
            case "reasoning.set":
                selection = obj(current["selection"])
                option = next(
                    (
                        row
                        for row in rows(current["options"])
                        if row["model"] == selection["model"]
                        and row["provider"] == selection["provider"]
                    ),
                    None,
                )
                if option is None or not option["reasoning"]:
                    raise BridgeError("reasoning_unsupported")
                if params.get("effort") == "none" and not option["canDisableReasoning"]:
                    raise BridgeError("reasoning_unsupported")
                payload = {"effort": params["effort"]}
                operation = "reasoning"
            case _:
                raise BridgeError("method_not_allowed")
        result = await self.native.rpc(
            "session.mutate",
            {
                "session_id": session_id,
                "request_id": text(params.get("requestId")),
                "expected_revision": params["expectedRevision"],
                "expected_generation": params["expectedGeneration"],
                "operation": operation,
                "payload": payload,
            },
        )
        if result.get("status") == "confirmation_required":
            return {
                "status": "confirmation_required",
                "confirm": text(result.get("confirm")),
                "message": str(result.get("confirm_message") or "모델 변경을 확인하세요.")[:4000],
            }
        return {
            "status": "deferred" if result.get("status") == "deferred" else "applied",
            "settings": await self.read(session_id),
        }
