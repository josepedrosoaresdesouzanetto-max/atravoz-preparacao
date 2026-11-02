import json
import time
from uuid import uuid4
from fastapi.testclient import TestClient
from jwcrypto import jwk
import pytest
from app.main import create_app
from app.mesh import Authority, sign, digest
from intelligence.contracts import utcnow

TOKEN = "diagnostic-test-" + ("x" * 40)
ADMIN = {"Authorization": "Bearer " + TOKEN}


@pytest.fixture
def setup(tmp_path):
    authority = Authority(jwk.JWK.generate(kty="EC", crv="P-256"), jwk.JWK.generate(kty="RSA", size=2048))
    client = TestClient(create_app(tmp_path / "d.sqlite", TOKEN, mesh_authority=authority))
    key = jwk.JWK.generate(kty="EC", crv="P-256")
    now = int(time.time())
    credential = sign(
        {
            "aud": "mesh-member-v1",
            "sub": key.thumbprint(),
            "jwk": key.export_public(as_dict=True),
            "iat": now,
            "nbf": now,
            "exp": now + 86400,
            "role": "participant",
        },
        authority.signing,
    )
    return client, key, credential


def report():
    at = utcnow().isoformat()
    return {
        "schema_version": 1,
        "report_id": str(uuid4()),
        "created_at": at,
        "privacy": "allowlisted-technical-fields-only",
        "events": [
            {
                "event_id": str(uuid4()),
                "correlation_id": str(uuid4()),
                "at": at,
                "last_at": at,
                "version": "0.2.0-test",
                "platform": "android",
                "module": "sync",
                "operation": "send",
                "code": "SYNC_FAILED",
                "result": "pending",
                "recovery": "queued",
                "attempt": 1,
                "duration_ms": 100,
                "network": "offline",
                "count": 2,
            }
        ],
    }


def upload(client, key, credential, value):
    serialized = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    proof = sign(
        {
            "kind": "diagnostic-upload",
            "report_id": value["report_id"],
            "digest": digest(serialized),
            "at": int(time.time()),
            "nonce": str(uuid4()),
        },
        key,
    )
    return client.post(
        "/api/v1/diagnostics", json={"serialized": serialized, "credential": credential, "proof": proof}
    )


def test_signed_diagnostic_receipt_and_authenticated_panel(setup):
    client, key, credential = setup
    r = report()
    response = upload(client, key, credential, r)
    assert response.status_code == 200, response.text
    assert response.json() == {"report_id": r["report_id"], "status": "PERSISTED"}
    assert upload(client, key, credential, r).json() == response.json()
    assert client.get("/api/v1/diagnostics").status_code == 401
    data = client.get("/api/v1/diagnostics", headers=ADMIN).json()
    assert len(data["reports"]) == 1
    assert data["frequencies"]["SYNC_FAILED"] == 2
    assert credential not in str(data) and key.thumbprint() not in str(data)


@pytest.mark.parametrize("field", ["victim", "location", "password", "audio", "message", "stack"])
def test_diagnostic_rejects_sensitive_or_free_text_fields(setup, field):
    client, key, credential = setup
    r = report()
    r["events"][0][field] = "PRIVATE-DO-NOT-STORE"
    assert upload(client, key, credential, r).status_code == 422
    assert "PRIVATE-DO-NOT-STORE" not in client.get("/api/v1/diagnostics", headers=ADMIN).text


def test_diagnostic_collision_quota_and_bad_authorization(setup):
    client, key, credential = setup
    r = report()
    assert upload(client, key, "invalid", r).status_code == 422
    assert upload(client, key, credential, r).status_code == 200
    r["events"][0]["count"] = 3
    assert upload(client, key, credential, r).status_code == 409
    for _ in range(9):
        assert upload(client, key, credential, report()).status_code == 200
    assert upload(client, key, credential, report()).status_code == 429


def test_missing_diagnostic_authority_does_not_disable_direct_api(tmp_path):
    client = TestClient(create_app(tmp_path / "noauth.sqlite", TOKEN))
    assert client.get("/api/v1/ready").status_code == 200
    body = {"serialized": json.dumps(report()), "credential": "missing", "proof": "missing"}
    assert client.post("/api/v1/diagnostics", json=body).status_code == 503


def test_local_import_rejects_private_extra_fields(tmp_path):
    import subprocess
    import sys
    from pathlib import Path

    root = Path(__file__).resolve().parents[3]
    source, output = tmp_path / "report.json", tmp_path / "analysis.md"
    source.write_text(json.dumps(report()), encoding="utf-8")
    command = [
        sys.executable,
        str(root / "scripts/analyze_diagnostics.py"),
        str(source),
        "--output",
        str(output),
    ]
    result = subprocess.run(command, capture_output=True, timeout=20)
    assert result.returncode == 0 and "SYNC_FAILED: 2" in output.read_text(encoding="utf-8")
    private = report()
    private["events"][0]["description"] = "synthetic private content must be rejected"
    source.write_text(json.dumps(private), encoding="utf-8")
    rejected = subprocess.run(command[:-1] + [str(tmp_path / "rejected.md")], capture_output=True, timeout=20)
    assert rejected.returncode != 0 and not (tmp_path / "rejected.md").exists()
    assert b"synthetic private content" not in rejected.stderr
