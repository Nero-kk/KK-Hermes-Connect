from __future__ import annotations

import hashlib
import json
import os
import secrets
import sqlite3
import time
import uuid
from pathlib import Path

from .models import JSON_OBJECT, BridgeError, Device, JsonObject


def digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


class Metadata:
    def __init__(self, directory: Path) -> None:
        directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        os.chmod(directory, 0o700)
        self.db = sqlite3.connect(directory / "metadata.sqlite3")
        os.chmod(directory / "metadata.sqlite3", 0o600)
        self.db.row_factory = sqlite3.Row
        self.db.executescript("""
            PRAGMA journal_mode=WAL;
            PRAGMA busy_timeout=3000;
            CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS devices (
                id TEXT PRIMARY KEY, owner TEXT NOT NULL, label TEXT NOT NULL,
                token_hash TEXT UNIQUE NOT NULL, revoked INTEGER NOT NULL DEFAULT 0);
            CREATE TABLE IF NOT EXISTS pair_codes (
                hash TEXT PRIMARY KEY, owner TEXT NOT NULL, expires REAL NOT NULL);
            CREATE TABLE IF NOT EXISTS operations (
                id TEXT PRIMARY KEY, owner TEXT NOT NULL, started_device TEXT NOT NULL,
                controller TEXT NOT NULL, profile TEXT NOT NULL, session TEXT NOT NULL,
                kind TEXT NOT NULL, hash TEXT NOT NULL, phase TEXT NOT NULL,
                result TEXT NOT NULL DEFAULT '{}', updated REAL NOT NULL);
        """)
        with self.db:
            self.db.execute(
                "INSERT OR IGNORE INTO settings VALUES ('server_id', ?)", (str(uuid.uuid4()),)
            )
        row = self.db.execute("SELECT value FROM settings WHERE key='server_id'").fetchone()
        self.server_id = str(row["value"])

    def close(self) -> None:
        self.db.close()

    def pair_code(self, owner: str = "jin") -> str:
        code = secrets.token_urlsafe(24)
        with self.db:
            self.db.execute("DELETE FROM pair_codes WHERE expires < ?", (time.time(),))
            self.db.execute(
                "INSERT INTO pair_codes VALUES (?, ?, ?)", (digest(code), owner, time.time() + 300)
            )
        return code

    def pair(self, code: str, label: str) -> JsonObject:
        token = secrets.token_urlsafe(32)
        device_id = str(uuid.uuid4())
        with self.db:
            row = self.db.execute(
                "SELECT owner FROM pair_codes WHERE hash=? AND expires>?",
                (digest(code), time.time()),
            ).fetchone()
            if row is None:
                raise BridgeError("invalid_pair_code")
            self.db.execute("DELETE FROM pair_codes WHERE hash=?", (digest(code),))
            self.db.execute(
                "INSERT INTO devices (id,owner,label,token_hash) VALUES (?,?,?,?)",
                (device_id, row["owner"], label[:100], digest(token)),
            )
        return {"deviceId": device_id, "token": token, "serverId": self.server_id}

    def authenticate(self, token: str) -> Device:
        row = self.db.execute(
            "SELECT * FROM devices WHERE token_hash=? AND revoked=0", (digest(token),)
        ).fetchone()
        if row is None:
            raise BridgeError("authentication_required")
        return Device(device_id=row["id"], owner_id=row["owner"], label=row["label"])

    def active(self, device: Device) -> bool:
        row = self.db.execute(
            "SELECT revoked FROM devices WHERE id=?", (device.device_id,)
        ).fetchone()
        return row is not None and row["revoked"] == 0

    def revoke(self, device_id: str) -> None:
        with self.db:
            cursor = self.db.execute("UPDATE devices SET revoked=1 WHERE id=?", (device_id,))
            if cursor.rowcount != 1:
                raise BridgeError("device_not_found")

    def devices(self) -> list[JsonObject]:
        return [
            {"deviceId": row["id"], "label": row["label"], "revoked": bool(row["revoked"])}
            for row in self.db.execute("SELECT id,label,revoked FROM devices")
        ]

    def operation(self, operation_id: str, device: Device) -> JsonObject:
        row = self.db.execute("SELECT * FROM operations WHERE id=?", (operation_id,)).fetchone()
        if row is None:
            raise BridgeError("operation_not_found")
        if row["owner"] != device.owner_id:
            raise BridgeError("operation_forbidden")
        if row["phase"] == "expired":
            raise BridgeError("operation_expired")
        return {
            "operationId": row["id"],
            "logicalSessionId": row["session"],
            "phase": row["phase"],
            "profileId": row["profile"],
            "kind": row["kind"],
            "payloadHash": row["hash"],
            "result": JSON_OBJECT.validate_json(row["result"]),
        }

    def begin(self, identity: JsonObject, device: Device) -> bool:
        operation_id = str(identity["operationId"])
        payload_hash = digest(
            json.dumps(
                {**identity, "owner": device.owner_id, "server": self.server_id},
                sort_keys=True,
                separators=(",", ":"),
                ensure_ascii=False,
            )
        )
        row = self.db.execute("SELECT * FROM operations WHERE id=?", (operation_id,)).fetchone()
        if row is not None:
            if row["owner"] != device.owner_id:
                raise BridgeError("operation_forbidden")
            if row["hash"] != payload_hash:
                raise BridgeError("operation_conflict")
            if row["phase"] == "expired":
                raise BridgeError("operation_expired")
            return False
        with self.db:
            self.db.execute(
                "INSERT INTO operations VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                (
                    operation_id,
                    device.owner_id,
                    device.device_id,
                    device.device_id,
                    str(identity["profileId"]),
                    str(identity.get("logicalSessionId", "")),
                    str(identity["kind"]),
                    payload_hash,
                    "preparing",
                    "{}",
                    time.time(),
                ),
            )
        return True

    def update(self, operation_id: str, update: JsonObject) -> None:
        phase = str(update["phase"])
        result = update.get("result", {})
        with self.db:
            self.db.execute(
                "UPDATE operations SET phase=?,result=?,session=COALESCE(?,session),"
                "updated=? WHERE id=?",
                (
                    phase,
                    json.dumps(result, ensure_ascii=False),
                    update.get("logicalSessionId"),
                    time.time(),
                    operation_id,
                ),
            )

    def control(self, operation_id: str, device: Device) -> None:
        self.operation(operation_id, device)
        with self.db:
            self.db.execute(
                "UPDATE operations SET controller=? WHERE id=?", (device.device_id, operation_id)
            )

    def for_session(self, session_id: str, device: Device) -> list[JsonObject]:
        identifiers = [
            row["id"]
            for row in self.db.execute(
                "SELECT id FROM operations WHERE session=? AND owner=? AND phase!='expired' "
                "ORDER BY updated DESC LIMIT 100",
                (session_id, device.owner_id),
            )
        ]
        return [self.operation(identifier, device) for identifier in identifiers]

    def expire(self) -> int:
        with self.db:
            cursor = self.db.execute(
                "UPDATE operations SET phase='expired',result='{}' "
                "WHERE phase IN ('completed','failed','cancelled') AND updated<?",
                (time.time() - 30 * 86400,),
            )
        return cursor.rowcount

    def has_uncertain(self, session_id: str) -> bool:
        row = self.db.execute(
            "SELECT 1 FROM operations WHERE session=? AND phase IN ('unknown','preparing') LIMIT 1",
            (session_id,),
        ).fetchone()
        return row is not None
