from __future__ import annotations

import json
import uuid

from .metadata import Metadata
from .models import BridgeError, Device, JsonObject, integer, obj, text
from .native import Native
from .projection import phase, safe_receipt


class Operations:
    def __init__(self, native: Native, metadata: Metadata) -> None:
        self.native = native
        self.metadata = metadata

    async def execute(self, kind: str, params: JsonObject, device: Device) -> JsonObject:
        operation_id = text(params.get("operationId"))
        try:
            uuid.UUID(operation_id)
        except ValueError as exc:
            raise BridgeError("invalid_operation_id") from exc
        session_id = str(params.get("logicalSessionId", ""))
        identity: JsonObject = {
            "operationId": operation_id,
            "profileId": self.native.profile_id,
            "kind": kind,
            "logicalSessionId": session_id,
        }
        if kind == "send":
            prompt = text(params.get("text"))
            if not prompt.strip() or len(prompt.encode("utf-8")) > 65536:
                raise BridgeError("payload_too_large")
            identity["text"] = prompt
        fresh = self.metadata.begin(identity, device)
        if not fresh:
            return await self.get(operation_id, device)
        result: JsonObject
        try:
            match kind:
                case "send":
                    preview = str(identity["text"])
                    if preview.startswith("[KK_HERMES_OBSIDIAN_CONTEXT_V1]\n"):
                        try:
                            attached = json.loads(preview.split("\n", 1)[1])
                            if (isinstance(attached, dict)
                                    and isinstance(attached.get("request"), str)):
                                preview = attached["request"]
                        except (ValueError, IndexError):
                            preview = "Obsidian 노트 작업"
                    raw = await self.native.rpc(
                        "prompt.submit",
                        {
                            "session_id": session_id,
                            "submission_id": f"kkh-{operation_id}",
                            "text": identity["text"],
                            "title_preview": preview[:1000],
                        },
                    )
                    result = safe_receipt(raw)
                    current_phase = phase(raw)
                case "create":
                    raw = await self.native.rpc(
                        "session.create",
                        {
                            "request_id": f"kkh-{operation_id}",
                            "source": "gui",
                            "client": {"name": "kk-hermes-connect", "version": "0.3.0"},
                        },
                    )
                    session_id = text(raw.get("session_id"))
                    result = {"logicalSessionId": session_id}
                    current_phase = "completed"
                case "fork":
                    current = await self.native.rpc(
                        "session.resume", {"session_id": session_id, "omit_messages": True}
                    )
                    raw = await self.native.rpc(
                        "session.mutate",
                        {
                            "session_id": session_id,
                            "request_id": f"kkh-{operation_id}",
                            "operation": "branch",
                            "payload": {},
                            "expected_revision": integer(current.get("revision")),
                            "expected_generation": integer(current.get("execution_generation")),
                        },
                    )
                    child = text(raw.get("branched_session_id"))
                    result = {
                        "logicalSessionId": child,
                        "parentSessionId": session_id,
                        "inheritance": "Hermes native branch",
                        "copiedMessages": raw.get("copied_messages"),
                    }
                    session_id = child
                    current_phase = "completed"
                case _:
                    raise BridgeError("method_not_allowed")
            self.metadata.update(
                operation_id,
                {"phase": current_phase, "result": result, "logicalSessionId": session_id},
            )
        except BridgeError as exc:
            state = (
                "unknown" if exc.reason in {"outcome_unknown", "gateway_unavailable"} else "failed"
            )
            self.metadata.update(operation_id, {"phase": state, "result": {"reason": exc.reason}})
            if state == "failed":
                raise
        return self.metadata.operation(operation_id, device)

    async def get(self, operation_id: str, device: Device) -> JsonObject:
        operation = self.metadata.operation(operation_id, device)
        if operation["profileId"] != self.native.profile_id:
            raise BridgeError("operation_forbidden")
        result = obj(operation["result"])
        admission = result.get("admission_id")
        if isinstance(admission, str):
            receipt = await self.native.rpc(
                "prompt.receipt",
                {"session_id": operation["logicalSessionId"], "admission_id": admission},
            )
            self.metadata.update(
                operation_id,
                {
                    "phase": phase(receipt),
                    "result": {
                        **safe_receipt(receipt),
                        "cancelRequested": result.get("cancelRequested", False),
                    },
                },
            )
        return self.metadata.operation(operation_id, device)

    async def cancel(self, operation_id: str, device: Device) -> JsonObject:
        operation = await self.get(operation_id, device)
        result = obj(operation["result"])
        admission = result.get("admission_id")
        if not isinstance(admission, str):
            raise BridgeError("outcome_unknown")
        self.metadata.control(operation_id, device)
        receipt = await self.native.rpc(
            "prompt.cancel",
            {"session_id": operation["logicalSessionId"], "admission_id": admission},
        )
        self.metadata.update(
            operation_id,
            {"phase": phase(receipt), "result": {**safe_receipt(receipt), "cancelRequested": True}},
        )
        return await self.get(operation_id, device)
