from __future__ import annotations

import json

from pydantic import JsonValue

from .models import JsonObject, integer, obj, rows, text


def summaries(listed: JsonObject, profile: str) -> list[JsonObject]:
    return [
        {
            "logicalSessionId": str(row.get("session_id") or row.get("resolved_id") or row["id"]),
            "profileId": profile,
            "title": str(row.get("title") or "제목 없는 대화"),
            "source": str(row.get("source") or "unknown"),
            "lastActiveAt": row.get("last_active_at", row.get("started_at", 0)),
            "running": row.get("running", False),
            "canResume": True,
            "canFork": True,
        }
        for row in rows(listed.get("sessions", []))
    ]


def transcript(page: JsonObject) -> JsonObject:
    messages: list[JsonValue] = []
    for row in rows(page.get("rows", [])):
        content = row.get("text")
        if content is None:
            raw = row.get("content", "")
            content = raw if isinstance(raw, str) else json.dumps(raw, ensure_ascii=False, indent=2)
        if row.get("row_id") is None:
            continue
        messages.append(
            {
                "id": str(row["row_id"]),
                "role": str(row.get("role", "system")),
                "text": str(content),
                "name": str(row.get("name") or ""),
                "compaction": row.get("row_kind") == "compaction",
                "truncated": row.get("truncated") is True,
            }
        )
    return {
        "messages": messages,
        "nextCursor": page.get("next_cursor"),
        "reset": page.get("reset", False),
    }


def phase(receipt: JsonObject) -> str:
    match receipt.get("status"):
        case "queued":
            return "queued"
        case "started":
            return "running"
        case "terminal":
            match receipt.get("outcome"):
                case "completed" | "success":
                    return "completed"
                case "cancelled" | "interrupted":
                    return "cancelled"
                case _:
                    return "failed"
        case _:
            return "unknown"


def safe_receipt(receipt: JsonObject) -> JsonObject:
    return {
        key: receipt.get(key)
        for key in ("admission_id", "status", "outcome", "execution_generation", "authority_epoch")
    }


def snapshot(raw: JsonObject, history: JsonObject, profile: str) -> JsonObject:
    info = obj(raw.get("info", {}))
    return {
        "logicalSessionId": text(raw.get("session_id")),
        "profileId": profile,
        "title": str(info.get("title") or "연이와 대화"),
        "source": str(info.get("source") or "unknown"),
        "running": raw.get("running", False),
        "revision": integer(raw.get("revision")),
        "generation": integer(raw.get("execution_generation")),
        "replayEpoch": text(raw.get("replay_epoch")),
        "sequence": integer(raw.get("last_sequence")),
        **history,
    }
