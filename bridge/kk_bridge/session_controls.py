from __future__ import annotations

from .models import JsonObject, integer, text
from .native import Native


class SessionControls:
    def __init__(self, native: Native) -> None:
        self.native: Native = native

    async def rename(self, params: JsonObject) -> JsonObject:
        result = await self.native.rpc(
            "session.mutate",
            {
                "session_id": text(params.get("logicalSessionId")),
                "request_id": text(params.get("requestId")),
                "expected_revision": params["expectedRevision"],
                "expected_generation": params["expectedGeneration"],
                "operation": "rename",
                "payload": {"title": text(params.get("title"))},
            },
        )
        return {"title": text(result.get("title")), "revision": integer(result.get("revision"))}
