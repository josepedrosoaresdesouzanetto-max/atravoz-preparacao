import copy
import json
import time
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from jwcrypto import jwk, jwe

from app.main import create_app
from app.mesh import Authority, digest, sign, verify
from intelligence.contracts import utcnow

TOKEN = "mesh-test-operator-" + "t" * 40
HEADERS = {"Authorization": "Bearer " + TOKEN}


@pytest.fixture
def setup(tmp_path):
    authority = Authority(jwk.JWK.generate(kty="EC", crv="P-256"), jwk.JWK.generate(kty="RSA", size=2048))
    client = TestClient(create_app(tmp_path / "mesh.sqlite3", TOKEN, mesh_authority=authority))
    return client, authority


def enroll(client):
    key = jwk.JWK.generate(kty="EC", crv="P-256")
    invitation = client.post("/api/v1/mesh/invitations", headers=HEADERS).json()["invitation"]
    body = {
        "invitation": invitation,
        "public_jwk": key.export_public(as_dict=True),
        "proof": sign(
            {
                "kind": "mesh-enrollment",
                "invitation_hash": digest(invitation),
                "subject": key.thumbprint(),
                "at": int(time.time()),
            },
            key,
        ),
    }
    response = client.post("/api/v1/mesh/enroll", json=body)
    assert response.status_code == 200, response.text
    return key, response.json()["credential"], body


def envelope(authority, key, credential, incident_id=None, description="Pessoa fictícia ilhada"):
    now = int(time.time())
    submission = {
        "incident": {
            "schema_version": 1,
            "incident_id": incident_id or str(uuid4()),
            "created_at": "2026-11-01T12:00:00+00:00",
            "updated_at": "2026-11-01T12:00:00+00:00",
            "record_type": "help",
            "description": description,
            "synthetic": True,
        },
        "write_key": "a" * 64,
    }
    encrypted = jwe.JWE(
        json.dumps(submission).encode(),
        protected={"alg": "RSA-OAEP-256", "enc": "A256GCM", "kid": authority.id, "typ": "mesh+jwe"},
    )
    encrypted.add_recipient(authority.encryption)
    sealed = encrypted.serialize(compact=True)
    origin = {
        "kind": "mesh-origin",
        "version": 1,
        "message_id": str(uuid4()),
        "created": now,
        "expires": now + 3600,
        "max_hops": 4,
        "payload_size": len(sealed),
        "cipher_hash": digest(sealed),
        "priority": "normal",
    }
    return {
        "version": 1,
        "origin_credential": credential,
        "sealed": sealed,
        "origin_proof": sign(origin, key),
        "hops": [],
    }, submission


def forward(env, sender, sender_credential, receiver):
    value = copy.deepcopy(env)
    import base64

    origin = json.loads(base64.urlsafe_b64decode(env["origin_proof"].split(".")[1] + "=="))
    hop = {
        "kind": "mesh-hop",
        "message_id": origin["message_id"],
        "origin_hash": digest(env["origin_proof"]),
        "previous": digest(env["hops"][-1]["proof"]) if env["hops"] else digest(env["origin_proof"]),
        "sender": sender.thumbprint(),
        "receiver": receiver.thumbprint(),
        "index": len(env["hops"]) + 1,
        "transmission_id": str(uuid4()),
        "at": int(time.time()),
    }
    value["hops"].append({"credential": sender_credential, "proof": sign(hop, sender)})
    return value


def deliver(client, env, key, credential):
    import base64

    origin = json.loads(base64.urlsafe_b64decode(env["origin_proof"].split(".")[1] + "=="))
    proof = sign(
        {
            "kind": "mesh-gateway",
            "message_id": origin["message_id"],
            "origin_hash": digest(env["origin_proof"]),
            "at": int(time.time()),
            "nonce": str(uuid4()),
        },
        key,
    )
    return client.post(
        "/api/v1/mesh/deliveries", json={"envelope": env, "credential": credential, "proof": proof}
    )


def test_single_use_invitation_proof_and_admin(setup):
    client, _ = setup
    assert client.post("/api/v1/mesh/invitations").status_code == 401
    _, _, body = enroll(client)
    assert client.post("/api/v1/mesh/enroll", json=body).status_code == 401
    body["proof"] = "invalid"
    assert client.post("/api/v1/mesh/enroll", json=body).status_code == 401


def test_two_signed_hops_real_decryption_and_idempotence(setup):
    client, authority = setup
    a, ac, _ = enroll(client)
    b, bc, _ = enroll(client)
    c, cc, _ = enroll(client)
    env, submission = envelope(authority, a, ac)
    env = forward(forward(env, a, ac, b), b, bc, c)
    response = deliver(client, env, c, cc)
    assert response.status_code == 200, response.text
    receipt = verify(response.json()["proof"], authority.signing)
    assert receipt["status"] == "RECEBIDO_PELO_SERVIDOR"
    assert submission["incident"]["description"] not in response.text
    assert deliver(client, env, c, cc).json() == response.json()
    direct = client.post("/api/v1/incidents", json=submission)
    assert direct.json()["receipt_id"] == receipt["receipt_id"]
    result = client.get("/api/v1/incidents", headers=HEADERS).json()
    assert result["total"] == 1
    assert result["items"][0]["mesh_deliveries"][0]["hops"] == 2
    assert "credential" not in str(result) and c.thumbprint() not in str(result)


def test_parallel_relays_new_envelopes_same_incident_and_independent_reports(setup):
    client, authority = setup
    a, ac, _ = enroll(client)
    env, submission = envelope(authority, a, ac)
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda _: deliver(client, env, a, ac), range(4)))
    assert all(r.status_code == 200 for r in results)
    assert len({r.json()["proof"] for r in results}) == 1
    second, _ = envelope(authority, a, ac, submission["incident"]["incident_id"])
    assert deliver(client, second, a, ac).status_code == 200
    independent, _ = envelope(authority, a, ac)
    assert deliver(client, independent, a, ac).status_code == 200
    assert client.get("/api/v1/incidents", headers=HEADERS).json()["total"] == 2


def test_tamper_unauthorized_gateway_revocation_and_expiration(setup):
    client, authority = setup
    a, ac, _ = enroll(client)
    b, bc, _ = enroll(client)
    env, _ = envelope(authority, a, ac)
    assert deliver(client, env, b, bc).status_code == 422
    broken = copy.deepcopy(env)
    broken["sealed"] += "x"
    assert deliver(client, broken, a, ac).status_code == 422
    claim = verify(env["origin_proof"], a)
    claim["expires"] = int(time.time()) - 1
    broken = {**env, "origin_proof": sign(claim, a)}
    assert deliver(client, broken, a, ac).status_code == 422
    assert (
        client.post("/api/v1/mesh/revoke", json={"subject": a.thumbprint()}, headers=HEADERS).status_code
        == 200
    )
    assert deliver(client, env, a, ac).status_code == 422
    assert client.get("/api/v1/mesh/trust").json()["revoked"] == [a.thumbprint()]
    assert client.get("/api/v1/incidents", headers=HEADERS).json()["total"] == 0


def test_changed_message_id_content_is_rejected_atomically(setup):
    client, authority = setup
    a, ac, _ = enroll(client)
    one, _ = envelope(authority, a, ac)
    assert deliver(client, one, a, ac).status_code == 200
    two, _ = envelope(authority, a, ac, description="Diferente")
    claim = verify(two["origin_proof"], a)
    claim["message_id"] = verify(one["origin_proof"], a)["message_id"]
    two["origin_proof"] = sign(claim, a)
    assert deliver(client, two, a, ac).status_code == 409
    assert client.get("/api/v1/incidents", headers=HEADERS).json()["total"] == 1


def test_mesh_missing_or_bad_config_preserves_direct_api(tmp_path, monkeypatch):
    monkeypatch.setenv("MESH_KEY_DIR", str(tmp_path / "missing"))
    monkeypatch.setenv("MESH_KEY_PASSWORD", "x" * 32)
    client = TestClient(create_app(tmp_path / "direct.sqlite3", TOKEN))
    assert client.get("/api/v1/mesh/trust").status_code == 503
    assert client.get("/api/v1/ready").status_code == 200
    now = utcnow().isoformat()
    body = {
        "incident": {
            "schema_version": 1,
            "incident_id": str(uuid4()),
            "created_at": now,
            "updated_at": now,
            "record_type": "help",
            "synthetic": True,
        },
        "write_key": "b" * 64,
    }
    assert client.post("/api/v1/incidents", json=body).status_code == 200


def test_encrypted_key_files_require_password(tmp_path):
    key = jwk.JWK.generate(kty="EC", crv="P-256")
    data = key.export_to_pem(private_key=True, password=b"test-only-strong-password-1234567890")
    assert b"ENCRYPTED PRIVATE KEY" in data
    with pytest.raises(Exception):
        jwk.JWK.from_pem(data)
    assert jwk.JWK.from_pem(data, b"test-only-strong-password-1234567890").thumbprint() == key.thumbprint()


def test_operator_view_is_explicit_audited_and_not_assistance(setup):
    client, authority = setup
    key, credential, _ = enroll(client)
    env, submission = envelope(authority, key, credential)
    assert deliver(client, env, key, credential).status_code == 200
    iid = submission["incident"]["incident_id"]
    assert client.post(f"/api/v1/incidents/{iid}/viewed").status_code == 401
    assert (
        client.post(f"/api/v1/incidents/{iid}/viewed", headers=HEADERS).json()["event"]
        == "OPERATOR_VIEW_ACKNOWLEDGED"
    )
    detail = client.get(f"/api/v1/incidents/{iid}", headers=HEADERS).json()
    assert detail["status"] == "RECEBIDO_SERVIDOR"
    assert "não confirma" in detail["history"][-1]["note"]
    assert client.get("/api/v1/mesh/metrics").status_code == 401
    summary = client.get("/api/v1/mesh/metrics", headers=HEADERS).json()
    assert summary["distinct_incidents"] == 1 and summary["signed_hop_histogram"] == {"0": 1}
