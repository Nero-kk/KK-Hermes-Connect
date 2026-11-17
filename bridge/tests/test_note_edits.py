from __future__ import annotations

import anyio
import pytest

from kk_bridge.models import BridgeError, Device, text
from kk_bridge.note_edits import EditBody, NoteEdits


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.mark.anyio
async def test_note_tool_waits_for_owning_devices_verified_save_receipt() -> None:
    edits = NoteEdits(17867)
    owner = Device(device_id="owner-device", owner_id="jin", label="Windows")
    other = Device(device_id="another-device", owner_id="jin", label="Phone")
    token = text(edits.prepare(owner, "session", "Inbox/Note.md")["grant"])
    outcomes = []

    async def submit() -> None:
        outcomes.append(await edits.submit(EditBody(grant=token, text="updated")))

    async with anyio.create_task_group() as group:
        group.start_soon(submit)
        await anyio.lowlevel.checkpoint()
        assert edits.pending(other, "session") == {"edits": []}
        assert edits.pending(owner, "session") == {
            "edits": [{"grant": token, "path": "Inbox/Note.md", "text": "updated"}]
        }
        with pytest.raises(BridgeError, match="operation_forbidden"):
            edits.complete(token, other, "session", {"success": True})
        edits.complete(token, owner, "session", {"success": True, "backupPath": "private/backup"})
    assert outcomes == [{"success": True, "backupPath": "private/backup", "path": "Inbox/Note.md"}]
    assert edits.pending(owner, "session") == {"edits": []}
    with pytest.raises(BridgeError, match="operation_conflict"):
        await edits.submit(EditBody(grant=token, text="different"))


@pytest.mark.parametrize("path", ["../A.md", "/A.md", ".obsidian/private.md", "D:/A.md", "A.txt"])
def test_note_grants_reject_paths_outside_normal_vault_notes(path: str) -> None:
    edits = NoteEdits(17867)
    owner = Device(device_id="owner-device", owner_id="jin", label="Windows")
    with pytest.raises(BridgeError, match="note_invalid_path"):
        edits.prepare(owner, "session", path)
