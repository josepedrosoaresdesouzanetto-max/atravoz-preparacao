import json
import sqlite3
from uuid import uuid4

import pytest

from intelligence.contracts import Incident, utcnow
from protocol import DurableInbox, Reassembler, decode, encode, fragment


def packet():
    now = utcnow()
    incident = Incident(
        incident_id=uuid4(),
        created_at=now,
        updated_at=now,
        description="Três pessoas ilhadas",
        record_type="witness",
        synthetic=True,
    )
    return encode(incident, str(uuid4()))


def test_fragmentation_reordering_repetition_and_durable_ack(tmp_path):
    raw = packet()
    frames = fragment(raw)
    r = Reassembler()
    assert r.accept(frames[-1]) is None
    result = None
    for frame in reversed(frames):
        result = r.accept(frame)
    assert result == raw
    inbox = DurableInbox(str(tmp_path / "inbox.sqlite"), str(uuid4()))
    ack = inbox.receive(result)
    assert ack["status"] == "TRANSFERIDO_PARA_DISPOSITIVO" and not ack["server_received"]
    assert inbox.receive(result) == ack
    with sqlite3.connect(inbox.path) as conn:
        assert conn.execute("SELECT COUNT(*) FROM inbox").fetchone()[0] == 1


def test_corruption_mixed_sessions_and_incomplete_transfer():
    raw = packet()
    data = json.loads(raw)
    data["body"]["incident"]["description"] = "adulterado"
    with pytest.raises(ValueError):
        decode(json.dumps(data).encode())
    r = Reassembler()
    assert r.accept(fragment(raw)[0]) is None
    with pytest.raises(ValueError):
        r.accept(fragment(packet())[0])
    with pytest.raises(ValueError):
        fragment(raw, 20)


def test_write_failure_cannot_ack(tmp_path):
    inbox = DurableInbox(str(tmp_path / "inbox.sqlite"), str(uuid4()))
    with sqlite3.connect(inbox.path) as conn:
        conn.execute(
            "CREATE TRIGGER fail BEFORE INSERT ON inbox BEGIN SELECT RAISE(ABORT, 'write failure'); END"
        )
    with pytest.raises(sqlite3.Error):
        inbox.receive(packet())


def test_conflicting_or_oversized_frames():
    frame = fragment(packet())[0]
    r = Reassembler()
    r.accept(frame)
    with pytest.raises(ValueError):
        r.accept(frame[:-1] + bytes([frame[-1] ^ 1]))
    with pytest.raises(ValueError):
        Reassembler().accept(b"x" * 245)
