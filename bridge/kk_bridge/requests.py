from __future__ import annotations

import hashlib

import anyio
from pydantic import JsonValue

from .models import BridgeError, JsonObject, integer, obj, rows, text
from .native import Native


class Requests:
    def __init__(self, native: Native) -> None:
        self.native = native
        self.registry: dict[str, JsonObject] = {}
        self.responding: set[str] = set()
        self.lock = anyio.Lock()

    def sync(self, raw: JsonObject) -> list[JsonValue]:
        session_id = text(raw.get("session_id"))
        entries: list[JsonObject] = []
        for prompt in rows(raw.get("prompts", [])):
            entries.append(
                {
                    "nativeId": prompt["prompt_id"],
                    "route": "control",
                    "kind": prompt["kind"],
                    "session": session_id,
                    "generation": prompt["execution_generation"],
                    "params": prompt,
                }
            )
        for frame in rows(raw.get("open_requests", [])):
            entries.append(
                {
                    "nativeId": frame["id"],
                    "route": "server",
                    "kind": frame["method"],
                    "session": session_id,
                    "generation": None,
                    "params": frame["params"],
                }
            )
        alive: set[str] = set()
        projected: list[JsonValue] = []
        for entry in entries:
            request_id = hashlib.sha256(
                (
                    self.native.instance
                    + session_id
                    + str(entry["nativeId"])
                    + str(entry["generation"])
                ).encode()
            ).hexdigest()
            alive.add(request_id)
            self.registry[request_id] = {**entry, "instance": self.native.instance}
            params = obj(entry["params"])
            kind = str(entry["kind"])
            supported = kind in {"approval", "clarify"}
            projected.append(
                {
                    "requestId": request_id,
                    "kind": kind if supported else "unsupported",
                    "nativeKind": kind,
                    "generation": entry["generation"],
                    "state": "responding" if request_id in self.responding else "open",
                    "question": str(params.get("question") or params.get("description") or kind),
                    "command": str(params.get("command") or ""),
                    "choices": params.get("choices", []),
                    "questions": params.get("questions", []),
                    "lockedAnswers": params.get("answers", {}),
                    "timeoutSeconds": params.get("timeout_s"),
                }
            )
        for request_id, entry in list(self.registry.items()):
            if entry["session"] == session_id and request_id not in alive:
                self.registry.pop(request_id)
                self.responding.discard(request_id)
        return projected

    async def respond(self, params: JsonObject) -> JsonObject:
        request_id = text(params.get("requestId"))
        session_id = text(params.get("logicalSessionId"))
        async with self.lock:
            self.sync(
                await self.native.rpc(
                    "session.resume", {"session_id": session_id, "omit_messages": True}
                )
            )
            entry = self.registry.get(request_id)
            if entry is None or request_id in self.responding:
                raise BridgeError("already_answered")
            if entry["session"] != session_id or entry["instance"] != self.native.instance:
                raise BridgeError("request_expired")
            answer = obj(params.get("answer"))
            payload = obj(entry["params"])
            kind = text(entry["kind"])
            match kind:
                case "approval":
                    choice = text(answer.get("choice"))
                    choices = payload.get("choices", [])
                    if (
                        not isinstance(choices, list)
                        or choice not in choices
                        or set(answer) != {"choice"}
                    ):
                        raise BridgeError("invalid_choice")
                    converted: JsonObject = {"choice": choice}
                case "clarify":
                    if entry["route"] == "control":
                        converted = {"answer": text(answer.get("answer"))}
                        choices = payload.get("choices", [])
                        if (
                            isinstance(choices, list)
                            and choices
                            and converted["answer"] not in choices
                        ):
                            raise BridgeError("invalid_choice")
                    else:
                        answers = obj(answer.get("answers"))
                        questions = rows(payload.get("questions", []))
                        if set(answers) != {text(q["qid"]) for q in questions}:
                            raise BridgeError("invalid_answer")
                        for question in questions:
                            value = answers[text(question["qid"])]
                            if value is not None:
                                text(value)
                            choices = question.get("choices")
                            if isinstance(choices, list) and value is not None:
                                selected = (
                                    text(value).split(", ")
                                    if question.get("multi_select")
                                    else [value]
                                )
                                if any(item not in choices for item in selected):
                                    raise BridgeError("invalid_choice")
                        converted = {"answers": answers, "outcome": "submitted"}
                case _:
                    raise BridgeError("unsupported_interaction")
            self.responding.add(request_id)
            if entry["route"] == "server":
                await self.native.send(
                    {"jsonrpc": "2.0", "id": entry["nativeId"], "result": converted}
                )
                return {"state": "responding"}
            try:
                result = await self.native.rpc(
                    f"{kind}.respond",
                    {
                        "session_id": session_id,
                        "prompt_id": entry["nativeId"],
                        "execution_generation": integer(entry["generation"]),
                        **converted,
                    },
                )
            except BridgeError as exc:
                if exc.reason not in {"outcome_unknown", "gateway_unavailable"}:
                    self.responding.discard(request_id)
                raise
            return {"state": "closed", "status": result.get("status")}
