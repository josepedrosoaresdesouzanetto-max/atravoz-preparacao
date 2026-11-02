import hashlib
import io
import sqlite3
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.main import create_app
from intelligence.contracts import utcnow

TOKEN = "operator-test-" + "x" * 40
KEY = "a" * 64
ADMIN = {"Authorization": f"Bearer {TOKEN}"}


def payload(**changes):
    now = utcnow().isoformat()
    return {
        "incident": {
            "schema_version": 1,
            "incident_id": str(uuid4()),
            "created_at": now,
            "updated_at": now,
            "record_type": "help",
            "description": "Três pessoas ilhadas. Água subindo.",
            "synthetic": True,
            **changes,
        },
        "write_key": KEY,
    }


@pytest.fixture
def client(tmp_path):
    return TestClient(create_app(tmp_path / "test.sqlite", TOKEN))


def test_idempotency_persistence_and_privacy(client):
    item = payload()
    one = client.post("/api/v1/incidents", json=item)
    two = client.post("/api/v1/incidents", json=item)
    assert one.status_code == two.status_code == 200
    assert one.json() == two.json()
    assert client.get("/api/v1/incidents").status_code == 401
    result = client.get("/api/v1/incidents", headers=ADMIN).json()
    assert result["total"] == 1 and "key_hash" not in str(result) and KEY not in str(result)
    with sqlite3.connect(client.app.state.db.path) as conn:
        assert conn.execute("SELECT COUNT(*) FROM incidents").fetchone()[0] == 1
    fresh = TestClient(create_app(client.app.state.db.path, TOKEN))
    assert fresh.get("/api/v1/incidents", headers=ADMIN).json()["total"] == 1


def test_parallel_retries_do_not_duplicate(client):
    item = payload()
    with ThreadPoolExecutor(max_workers=5) as pool:
        replies = list(pool.map(lambda _: client.post("/api/v1/incidents", json=item), range(5)))
    assert all(r.status_code == 200 for r in replies)
    assert len({r.json()["receipt_id"] for r in replies}) == 1


def test_collision_and_capability(client):
    item = payload()
    client.post("/api/v1/incidents", json=item)
    item["write_key"] = "b" * 64
    assert client.post("/api/v1/incidents", json=item).status_code == 401
    item["write_key"] = KEY
    item["incident"]["description"] = "changed"
    assert client.post("/api/v1/incidents", json=item).status_code == 409
    path = "/api/v1/incidents/" + item["incident"]["incident_id"] + "/status"
    assert client.get(path).status_code == 401
    assert (
        client.get(path, headers={"Authorization": "Bearer " + KEY}).json()["receipt"]["status"]
        == "RECEBIDO_SERVIDOR"
    )


@pytest.mark.parametrize(
    "changes",
    [
        {"schema_version": 2},
        {"description": "x" * 4001},
        {"synthetic": False},
        {"created_at": "2026-01-01T00:00:00"},
        {"location": {"source": "gps", "latitude": 999}},
        {"record_type": "rescue_sent"},
    ],
)
def test_invalid_inputs(client, changes):
    assert client.post("/api/v1/incidents", json=payload(**changes)).status_code == 422


def test_missing_location_and_special_characters(client):
    assert (
        client.post(
            "/api/v1/incidents", json=payload(description="Água 🌧 <script>alert(1)</script>", location=None)
        ).status_code
        == 200
    )


def test_no_receipt_on_write_failure(client):
    with sqlite3.connect(client.app.state.db.path) as conn:
        conn.execute(
            "CREATE TRIGGER fail BEFORE INSERT ON incidents BEGIN SELECT RAISE(ABORT, 'disk failed'); END"
        )
    response = client.post("/api/v1/incidents", json=payload())
    assert response.status_code == 503 and "receipt_id" not in response.text
    assert client.get("/api/v1/incidents", headers=ADMIN).json()["total"] == 0


def image_data():
    file = io.BytesIO()
    Image.new("RGB", (8, 8), "blue").save(file, format="PNG")
    return file.getvalue()


def with_attachment(client, data, mime="image/png", kind="photo"):
    aid = str(uuid4())
    item = payload(
        attachments=[
            {
                "attachment_id": aid,
                "kind": kind,
                "mime_type": mime,
                "byte_size": len(data),
                "sha256": hashlib.sha256(data).hexdigest(),
            }
        ]
    )
    response = client.post("/api/v1/incidents", json=item)
    assert response.json()["attachment_ids_received"] == []
    iid = item["incident"]["incident_id"]
    return iid, aid, {"Authorization": "Bearer " + KEY, "X-Attachment-ID": aid, "Content-Type": mime}


def test_attachments_only_acknowledged_after_commit(client):
    data = image_data()
    iid, aid, headers = with_attachment(client, data)
    path = f"/api/v1/incidents/{iid}/attachments"
    assert client.get(path + "/" + aid, headers=ADMIN).status_code == 404
    assert client.post(path, content=b"bad", headers=headers).status_code == 422
    response = client.post(path, content=data, headers=headers)
    assert response.status_code == 200
    assert client.post(path, content=data, headers=headers).json() == response.json()
    assert client.get(path + "/" + aid, headers=ADMIN).content == data


def test_media_invalid_or_too_large(client):
    iid, aid, headers = with_attachment(client, b"not a photo")
    assert (
        client.post(
            f"/api/v1/incidents/{iid}/attachments", content=b"not a photo", headers=headers
        ).status_code
        == 415
    )
    assert client.post("/api/v1/incidents", content=b"x" * (5 * 1024 * 1024)).status_code == 413


def test_ai_failure_preserves_incident(client):
    class BrokenProvider:
        name = "broken-test-only"

        def extract(self, text):
            raise TimeoutError()

    client.app.state.provider = BrokenProvider()
    receipt = client.post("/api/v1/incidents", json=payload()).json()
    path = "/api/v1/incidents/" + receipt["incident_id"]
    assert client.post(path + "/analysis").status_code == 401
    assert client.post(path + "/analysis", headers=ADMIN).json()["processing_status"] == "fallback"
    record = client.get(path, headers=ADMIN).json()
    assert record["status"] == "RECEBIDO_SERVIDOR" and record["description"].startswith("Três")


def test_transcription_requires_auth_and_preserves_received_audio(client):
    data = b"RIFF" + b"\x00" * 4 + b"WAVE" + b"synthetic test container"
    iid, aid, headers = with_attachment(client, data, "audio/wav", "audio")
    base = f"/api/v1/incidents/{iid}"
    path = base + f"/attachments/{aid}/transcribe"
    assert client.post(base + "/attachments", content=data, headers=headers).status_code == 200
    original = client.get(base, headers=ADMIN).json()["description"]
    assert client.post(path).status_code == 401
    assert client.post(path, headers=ADMIN).status_code == 503

    class ControlledTranscriber:
        def transcribe(self, audio, mime, language):
            assert audio == data and mime == "audio/wav" and language == "pt"
            return {
                "processing_status": "transcribed",
                "text": "Saída controlada, sem inferência.",
                "language": "pt",
                "duration_s": 1,
                "model_name": "test-double",
                "human_review_required": True,
            }

    client.app.state.transcriber = ControlledTranscriber()
    result = client.post(path, headers=ADMIN)
    assert result.status_code == 200 and result.json()["original_unchanged"]
    assert result.json()["transcript"]["human_review_required"] is True
    assert client.get(base, headers=ADMIN).json()["description"] == original
    assert client.get(base + f"/attachments/{aid}", headers=ADMIN).content == data
    client.app.state.inference_gate.acquire()
    try:
        assert client.post(path, headers=ADMIN).status_code == 429
        assert client.post(base + "/analysis", headers=ADMIN).status_code == 429
    finally:
        client.app.state.inference_gate.release()


def test_invalid_transcription_fails_closed_without_changing_audio(client):
    data = b"RIFF" + b"\x00" * 4 + b"WAVE" + b"synthetic test container"
    iid, aid, headers = with_attachment(client, data, "audio/wav", "audio")
    base = f"/api/v1/incidents/{iid}/attachments"
    client.post(base, content=data, headers=headers)

    class InvalidTranscriber:
        def transcribe(self, *_):
            return {"text": "Missing review requirement and schema"}

    client.app.state.transcriber = InvalidTranscriber()
    assert client.post(base + f"/{aid}/transcribe", headers=ADMIN).status_code == 503
    assert client.get(base + f"/{aid}", headers=ADMIN).content == data
    assert client.app.state.inference_gate.acquire(blocking=False)
    client.app.state.inference_gate.release()


def test_review_is_audited_and_does_not_claim_rescue(client):
    iid = client.post("/api/v1/incidents", json=payload()).json()["incident_id"]
    path = f"/api/v1/incidents/{iid}"
    change = {
        "status": "EM_VERIFICACAO",
        "expected_status": "RECEBIDO_SERVIDOR",
        "note": "Revisão sintética de teste",
    }
    assert client.post(path + "/review", json=change, headers=ADMIN).status_code == 200
    assert client.post(path + "/review", json=change, headers=ADMIN).status_code == 409
    change["status"] = "ATENDIMENTO_CONFIRMADO"
    assert client.post(path + "/review", json=change, headers=ADMIN).status_code == 422
    result = client.get(path, headers=ADMIN).json()
    assert len(result["history"]) == 2 and result["description"].startswith("Três")


def test_rate_limit_and_closed_default(tmp_path):
    limited = TestClient(create_app(tmp_path / "limit.sqlite", "", rate_limit=2))
    assert limited.get("/api/v1/incidents").status_code == 503
    assert limited.get("/api/v1/health").status_code == 200
    assert limited.get("/api/v1/health").status_code == 429


def test_misconfigured_ai_never_blocks_receipt(tmp_path, monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "ollama")
    monkeypatch.setenv("OLLAMA_MODEL", "")
    client = TestClient(create_app(tmp_path / "misconfigured.sqlite", TOKEN))
    receipt = client.post("/api/v1/incidents", json=payload())
    assert receipt.status_code == 200
    iid = receipt.json()["incident_id"]
    result = client.post(f"/api/v1/incidents/{iid}/analysis", headers=ADMIN)
    assert result.json()["processing_status"] == "fallback"
