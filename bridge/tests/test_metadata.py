from __future__ import annotations

import uuid
from pathlib import Path

import pytest

from kk_bridge.metadata import Metadata
from kk_bridge.models import BridgeError, Device, JsonObject, text


@pytest.fixture
def metadata(tmp_path: Path):
    store = Metadata(tmp_path)
    yield store
    store.close()


def registered(metadata: Metadata, owner: str = "jin") -> Device:
    paired = metadata.pair(metadata.pair_code(owner), "test")
    return metadata.authenticate(text(paired["token"]))


def test_pair_code_is_single_use_and_revocation_rejects_the_token(metadata: Metadata) -> None:
    code = metadata.pair_code()
    pair = metadata.pair(code, "phone")
    device = metadata.authenticate(text(pair["token"]))
    with pytest.raises(BridgeError, match="invalid_pair_code"):
        metadata.pair(code, "second")
    metadata.revoke(device.device_id)
    with pytest.raises(BridgeError, match="authentication_required"):
        metadata.authenticate(text(pair["token"]))


def test_a_second_device_of_the_owner_can_control_but_another_owner_cannot(
    metadata: Metadata,
) -> None:
    first, second, foreign = (
        registered(metadata),
        registered(metadata),
        registered(metadata, "foreign"),
    )
    identity: JsonObject = {
        "operationId": str(uuid.uuid4()),
        "profileId": "yeon",
        "logicalSessionId": "s",
        "kind": "send",
        "text": "안녕",
    }
    metadata.begin(identity, first)
    metadata.control(text(identity["operationId"]), second)
    assert metadata.operation(text(identity["operationId"]), second)["phase"] == "preparing"
    with pytest.raises(BridgeError, match="operation_forbidden"):
        metadata.control(text(identity["operationId"]), foreign)


@pytest.mark.parametrize("changed", ["text", "logicalSessionId", "profileId", "kind"])
def test_same_operation_identity_cannot_be_reused_with_a_different_payload(
    metadata: Metadata, changed: str
) -> None:
    device = registered(metadata)
    identity: JsonObject = {
        "operationId": str(uuid.uuid4()),
        "profileId": "yeon",
        "logicalSessionId": "s",
        "kind": "send",
        "text": "공백 그대로\n ",
    }
    assert metadata.begin(identity, device)
    assert not metadata.begin(identity, device)
    with pytest.raises(BridgeError, match="operation_conflict"):
        metadata.begin({**identity, changed: "different"}, device)


def test_expired_details_keep_the_tombstone_and_reject_reexecution(metadata: Metadata) -> None:
    device = registered(metadata)
    identity: JsonObject = {
        "operationId": str(uuid.uuid4()),
        "profileId": "yeon",
        "logicalSessionId": "s",
        "kind": "send",
        "text": "hello",
    }
    metadata.begin(identity, device)
    metadata.update(text(identity["operationId"]), {"phase": "completed", "result": {}})
    with metadata.db:
        metadata.db.execute("UPDATE operations SET updated=0")
    assert metadata.expire() == 1
    with pytest.raises(BridgeError, match="operation_expired"):
        metadata.begin(identity, device)
