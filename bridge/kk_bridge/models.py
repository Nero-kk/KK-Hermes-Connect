from __future__ import annotations

from pathlib import Path
from typing import TypeAlias

from pydantic import BaseModel, ConfigDict, Field, JsonValue, TypeAdapter

JsonObject: TypeAlias = dict[str, JsonValue]
JSON_OBJECT = TypeAdapter(JsonObject)


class BridgeError(Exception):
    def __init__(self, reason: str) -> None:
        self.reason = reason
        super().__init__(reason)


class Config(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")
    profile: str = "default"
    owner_id: str = "owner"
    verified_code_sha: str = ""
    hermes: str = "hermes"
    public_origin: str = "https://example.ts.net"
    port: int = Field(default=17867, ge=1024, le=65535)
    origins: tuple[str, ...] = ("app://obsidian.md", "capacitor://localhost", "http://localhost")
    state_dir: Path = Path.home() / ".local/share/kk-hermes-connect"


class Device(BaseModel):
    model_config = ConfigDict(frozen=True)
    device_id: str
    owner_id: str
    label: str


class Rpc(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")
    jsonrpc: str = "2.0"
    id: str | int
    method: str
    params: JsonObject = Field(default_factory=dict)


def obj(value: JsonValue) -> JsonObject:
    if not isinstance(value, dict):
        raise BridgeError("invalid_schema")
    return value


def text(value: JsonValue) -> str:
    if not isinstance(value, str):
        raise BridgeError("invalid_schema")
    return value


def integer(value: JsonValue) -> int:
    if not isinstance(value, int) or isinstance(value, bool):
        raise BridgeError("invalid_schema")
    return value


def rows(value: JsonValue) -> list[JsonObject]:
    if not isinstance(value, list):
        raise BridgeError("invalid_schema")
    return [obj(item) for item in value]
