from __future__ import annotations

import json

import anyio
from aiohttp import ClientSession, ClientTimeout

from .models import Config, rows
from .native import Native


async def probe() -> None:
    native = Native(Config())
    async with ClientSession(timeout=ClientTimeout(total=50)) as session:
        async with anyio.create_task_group() as group:
            await native.attach(session, group)
            listed = await native.rpc(
                "session.list", {"scope": "stored", "picker": True, "limit": 200}
            )
            sessions = rows(listed.get("sessions", []))
            print(
                json.dumps(
                    {
                        "profile": native.profile_id,
                        "instance": native.instance,
                        "code_sha": native.code_sha,
                        "describe": native.describe,
                        "session_count": len(sessions),
                        "session_fields": sorted(sessions[0]) if sessions else [],
                        "sources": sorted({str(row.get("source")) for row in sessions}),
                        "channel_matches": [
                            {key: row.get(key) for key in ("id", "session_id", "source")}
                            for row in sessions
                            if "C0CHQJRCNH1" in json.dumps(row)
                        ],
                    },
                    indent=2,
                )
            )
            if native.socket is not None:
                await native.socket.close()
            group.cancel_scope.cancel()


if __name__ == "__main__":
    anyio.run(probe)
