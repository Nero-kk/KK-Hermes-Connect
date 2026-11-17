from __future__ import annotations

import secrets
import shlex
import sys
import time
from dataclasses import dataclass, field
from typing import ClassVar

import anyio
from pydantic import BaseModel, ConfigDict, Field

from .models import BridgeError, Device, JsonObject


class EditBody(BaseModel):
    model_config: ClassVar[ConfigDict] = ConfigDict(extra="forbid", frozen=True)
    grant: str = Field(min_length=32, max_length=128)
    text: str = Field(max_length=262144)


@dataclass(slots=True)
class Grant:
    device_id: str
    session_id: str
    path: str
    expires: float
    text: str | None = None
    result: JsonObject | None = None
    done: anyio.Event = field(default_factory=anyio.Event)


class NoteEdits:
    def __init__(self, port: int) -> None:
        self.port: int = port
        self.grants: dict[str, Grant] = {}

    def prepare(self, device: Device, session_id: str, path: str) -> JsonObject:
        self.grants = {key: value for key, value in self.grants.items()
                       if value.expires > time.monotonic()}
        if len(self.grants) >= 100:
            raise BridgeError("rate_limited")
        parts = path.replace("\\", "/").split("/")
        if not path.endswith(".md") or any(not p or p.startswith(".") or ":" in p for p in parts):
            raise BridgeError("note_invalid_path")
        token = secrets.token_urlsafe(32)
        self.grants[token] = Grant(device.device_id, session_id, path, time.monotonic() + 1800)
        command = shlex.join([sys.executable, "-m", "kk_bridge.note_tool", str(self.port), token])
        return {"grant": token, "path": path, "command": command}

    def owned(self, token: str, device: Device, session_id: str) -> Grant:
        grant = self.grants.get(token)
        if grant is None or grant.expires <= time.monotonic():
            raise BridgeError("note_grant_expired")
        if grant.device_id != device.device_id or grant.session_id != session_id:
            raise BridgeError("operation_forbidden")
        return grant

    def pending(self, device: Device, session_id: str) -> JsonObject:
        return {"edits": [{"grant": token, "path": grant.path, "text": grant.text}
                          for token, grant in self.grants.items()
                          if grant.device_id == device.device_id and grant.session_id == session_id
                          and grant.text is not None and grant.result is None
                          and grant.expires > time.monotonic()]}

    def complete(
        self, token: str, device: Device, session_id: str, result: JsonObject,
    ) -> JsonObject:
        grant = self.owned(token, device, session_id)
        if grant.text is None:
            raise BridgeError("note_edit_not_pending")
        if grant.result is None:
            grant.result = {**result, "path": grant.path}
            grant.done.set()
        return grant.result

    async def submit(self, body: EditBody) -> JsonObject:
        grant = self.grants.get(body.grant)
        if grant is None or grant.expires <= time.monotonic():
            raise BridgeError("note_grant_expired")
        if grant.text is not None and grant.text != body.text:
            raise BridgeError("operation_conflict")
        grant.text = body.text
        with anyio.move_on_after(90):
            await grant.done.wait()
        if grant.result is None:
            grant.result = {"success": False, "reason": "note_client_unavailable",
                            "path": grant.path}
            grant.done.set()
        return grant.result
