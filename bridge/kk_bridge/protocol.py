from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, JsonValue, ValidationError

from .models import JSON_OBJECT, BridgeError, JsonObject, Rpc


class Params(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, strict=True)


class Hello(Params):
    apiVersion: Literal[1]
    clientVersion: str = Field(max_length=64)
    deviceId: str = Field(min_length=1, max_length=128)
    profileId: str | None = None


class Ping(Params):
    nonce: str = Field(max_length=128)


class ListSessions(Params):
    query: str = Field(default="", max_length=500)
    source: str | None = None


class Cursor(Params):
    replayEpoch: str = Field(min_length=1, max_length=128)
    sequence: int = Field(ge=0)


class Session(Params):
    logicalSessionId: str = Field(min_length=1, max_length=256)


class OpenSession(Session):
    cursor: Cursor | None = None


class History(Session):
    cursor: str | None = None
    limit: int = Field(default=100, ge=1, le=100)


class Operation(Params):
    operationId: str = Field(
        pattern=r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
    )


class Fork(Operation, Session):
    pass


class Send(Fork):
    text: str = Field(min_length=1, max_length=65536)


class Respond(Session):
    requestId: str = Field(min_length=1, max_length=256)
    generation: int | None = Field(default=None, ge=0)
    answer: JsonObject


METHODS: dict[str, type[Params]] = {
    "bridge.hello": Hello,
    "bridge.ping": Ping,
    "sessions.list": ListSessions,
    "sessions.create": Operation,
    "sessions.open": OpenSession,
    "sessions.history": History,
    "sessions.release": Session,
    "sessions.fork": Fork,
    "messages.send": Send,
    "operations.get": Operation,
    "operations.cancel": Operation,
    "requests.respond": Respond,
}


def parse_rpc(rpc: Rpc) -> Rpc:
    model = METHODS.get(rpc.method)
    if rpc.jsonrpc != "2.0" or model is None:
        raise BridgeError("method_not_allowed")
    try:
        params = model.model_validate(rpc.params)
    except ValidationError as exc:
        raise BridgeError("invalid_params") from exc
    return rpc.model_copy(
        update={
            "params": JSON_OBJECT.validate_python(params.model_dump(mode="json", exclude_none=True))
        }
    )


def schema() -> JsonObject:
    definitions: JsonObject = {}
    branches: list[JsonValue] = []
    for method, model in METHODS.items():
        model_schema = JSON_OBJECT.validate_python(model.model_json_schema())
        nested = model_schema.pop("$defs", {})
        if isinstance(nested, dict):
            definitions.update(nested)
        definitions[model.__name__] = model_schema
        branches.append(
            {
                "type": "object",
                "additionalProperties": False,
                "required": ["jsonrpc", "id", "method", "params"],
                "properties": {
                    "jsonrpc": {"const": "2.0"},
                    "id": {"type": ["string", "integer"]},
                    "method": {"const": method},
                    "params": {"$ref": f"#/$defs/{model.__name__}"},
                },
            }
        )
    return {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": "KK Hermes Bridge v1 client RPC",
        "$defs": definitions,
        "oneOf": branches,
    }
