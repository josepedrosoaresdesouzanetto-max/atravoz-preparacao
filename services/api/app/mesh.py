"""Opt-in JOSE gateway. No radio, public enrollment, or emergency dispatch here."""

import hashlib
import json
import os
import secrets
import time
from pathlib import Path
from uuid import UUID

from fastapi import Depends, HTTPException
from jwcrypto import jwk, jwe, jws
from pydantic import Field

from intelligence.contracts import StrictModel, Submission
from intelligence.transport_quality import summarize_transport

MESH_SCHEMA = """
CREATE TABLE IF NOT EXISTS mesh_invites(hash TEXT PRIMARY KEY, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS mesh_revoked(subject TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS mesh_deliveries(message_id TEXT PRIMARY KEY, origin_hash TEXT NOT NULL,
 incident_id TEXT NOT NULL REFERENCES incidents(id), hops INTEGER NOT NULL, proof TEXT NOT NULL,
 received_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS mesh_nonces(nonce TEXT PRIMARY KEY, expires INTEGER NOT NULL);
"""


def digest(value):
    import base64

    return base64.urlsafe_b64encode(hashlib.sha256(value.encode()).digest()).decode().rstrip("=")


def sign(value, key):
    token = jws.JWS(json.dumps(value, separators=(",", ":"), ensure_ascii=False).encode())
    token.add_signature(key, protected={"alg": "ES256", "typ": "mesh+jws"})
    return token.serialize(compact=True)


def verify(token, key):
    if not isinstance(token, str) or len(token) > 20000:
        raise ValueError("Proof size")
    result = jws.JWS()
    result.allowed_algs = ["ES256"]
    result.deserialize(token, key)
    if result.jose_header != {"alg": "ES256", "typ": "mesh+jws"}:
        raise ValueError("Proof header")
    return json.loads(result.payload)


def public_ec(value):
    if set(value) != {"kty", "crv", "x", "y"} or value["kty"] != "EC" or value["crv"] != "P-256":
        raise ValueError("Public P-256 key required")
    return jwk.JWK(**value)


class Authority:
    def __init__(self, signing, encryption):
        self.signing, self.encryption = signing, encryption
        self.id = signing.thumbprint()

    @classmethod
    def from_environment(cls):
        directory, password = os.environ.get("MESH_KEY_DIR"), os.environ.get("MESH_KEY_PASSWORD", "")
        if not directory or len(password) < 32:
            return None
        return cls(
            *(
                jwk.JWK.from_pem((Path(directory) / name).read_bytes(), password.encode())
                for name in ("signing.pem", "encryption.pem")
            )
        )

    def trust(self, revoked):
        return {
            "authority_id": self.id,
            "signing_jwk": self.signing.export_public(as_dict=True),
            "encryption_jwk": self.encryption.export_public(as_dict=True),
            "revoked": revoked,
        }

    def member(self, token, revoked, now):
        claim = verify(token, self.signing)
        if set(claim) != {"aud", "sub", "jwk", "iat", "nbf", "exp", "role"}:
            raise ValueError("Credential fields")
        key = public_ec(claim["jwk"])
        if (
            claim["aud"] != "mesh-member-v1"
            or claim["role"] != "participant"
            or claim["sub"] != key.thumbprint()
            or claim["sub"] in revoked
            or claim["exp"] <= now
            or claim["nbf"] > now + 300
            or claim["iat"] > now + 300
            or not 0 < claim["exp"] - claim["iat"] <= 86400
        ):
            raise ValueError("Credential expired, revoked or invalid")
        return claim, key

    def envelope(self, env, credential, proof, revoked, now):
        if set(env) != {"version", "origin_credential", "sealed", "origin_proof", "hops"}:
            raise ValueError("Envelope fields")
        if env["version"] != 1 or len(json.dumps(env).encode()) > 65536 or len(env["hops"]) > 4:
            raise ValueError("Envelope limits")
        origin_member, origin_key = self.member(env["origin_credential"], revoked, now)
        origin = verify(env["origin_proof"], origin_key)
        if set(origin) != {
            "kind",
            "version",
            "message_id",
            "created",
            "expires",
            "max_hops",
            "payload_size",
            "cipher_hash",
            "priority",
        }:
            raise ValueError("Origin fields")
        UUID(origin["message_id"])
        if (
            origin["kind"] != "mesh-origin"
            or origin["version"] != 1
            or origin["priority"] != "normal"
            or not 1 <= origin["max_hops"] <= 4
            or len(env["hops"]) > origin["max_hops"]
            or origin["created"] > now + 300
            or origin["expires"] <= now
            or not 0 < origin["expires"] - origin["created"] <= 43200
            or origin["expires"] > origin_member["exp"]
            or len(env["sealed"].encode()) != origin["payload_size"]
            or not 1 <= origin["payload_size"] <= 16384
            or digest(env["sealed"]) != origin["cipher_hash"]
        ):
            raise ValueError("Origin integrity or expiration")
        origin_hash = digest(env["origin_proof"])
        holder, previous = origin_member["sub"], origin_hash
        visited = {holder}
        for index, item in enumerate(env["hops"], 1):
            if set(item) != {"credential", "proof"}:
                raise ValueError("Hop fields")
            sender, key = self.member(item["credential"], revoked, now)
            hop = verify(item["proof"], key)
            if set(hop) != {
                "kind",
                "message_id",
                "origin_hash",
                "previous",
                "sender",
                "receiver",
                "index",
                "transmission_id",
                "at",
            }:
                raise ValueError("Hop claim fields")
            UUID(hop["transmission_id"])
            if (
                hop["kind"] != "mesh-hop"
                or sender["sub"] != holder
                or hop["sender"] != holder
                or hop["index"] != index
                or hop["previous"] != previous
                or hop["origin_hash"] != origin_hash
                or hop["message_id"] != origin["message_id"]
                or hop["receiver"] in visited
                or len(hop["receiver"]) != 43
                or not origin["created"] - 300 <= hop["at"] <= now + 300
            ):
                raise ValueError("Invalid hop chain")
            holder, previous = hop["receiver"], digest(item["proof"])
            visited.add(holder)
        gateway, key = self.member(credential, revoked, now)
        gateway_claim = verify(proof, key)
        if (
            set(gateway_claim) != {"kind", "message_id", "origin_hash", "at", "nonce"}
            or gateway_claim["kind"] != "mesh-gateway"
            or gateway["sub"] != holder
            or gateway_claim["message_id"] != origin["message_id"]
            or gateway_claim["origin_hash"] != origin_hash
            or abs(gateway_claim["at"] - now) > 120
        ):
            raise ValueError("Gateway proof")
        UUID(gateway_claim["nonce"])
        encrypted = jwe.JWE()
        encrypted.allowed_algs = ["RSA-OAEP-256", "A256GCM"]
        encrypted.deserialize(env["sealed"])
        if encrypted.jose_header != {
            "alg": "RSA-OAEP-256",
            "enc": "A256GCM",
            "kid": self.id,
            "typ": "mesh+jwe",
        }:
            raise ValueError("Encryption header")
        encrypted.decrypt(self.encryption)
        submission = Submission.model_validate_json(encrypted.payload)
        return origin, origin_hash, submission, gateway_claim["nonce"]


class Enrollment(StrictModel):
    invitation: str = Field(min_length=40, max_length=100)
    public_jwk: dict
    proof: str = Field(max_length=4000)


class Delivery(StrictModel):
    envelope: dict
    credential: str = Field(max_length=3000)
    proof: str = Field(max_length=3000)


class Revocation(StrictModel):
    subject: str = Field(pattern=r"^[A-Za-z0-9_-]{43}$")


def register_mesh(api, db, admin, persist, authority=None):
    with db.connect() as conn:
        conn.executescript(MESH_SCHEMA)
    if authority is None:
        try:
            authority = Authority.from_environment()
        except Exception:
            authority = None  # Mesh configuration never disables the existing direct API.
    api.state.mesh_authority = authority

    def available():
        if authority is None:
            raise HTTPException(503, "Rede Solidária não provisionada; envio direto preservado.")
        return authority

    @api.get("/api/v1/mesh/trust")
    def trust(a=Depends(available)):
        with db.connect() as conn:
            return a.trust([r[0] for r in conn.execute("SELECT subject FROM mesh_revoked")])

    @api.get("/api/v1/mesh/metrics")
    def metrics(actor=Depends(admin)):
        with db.connect() as conn:
            return summarize_transport(conn.execute("SELECT incident_id,hops FROM mesh_deliveries"))

    @api.post("/api/v1/mesh/invitations")
    def invitation(actor=Depends(admin), a=Depends(available)):
        token, now = secrets.token_urlsafe(32), int(time.time())
        with db.connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            conn.execute("DELETE FROM mesh_invites WHERE expires<=?", (now,))
            if conn.execute("SELECT COUNT(*) FROM mesh_invites").fetchone()[0] >= 100:
                raise HTTPException(429, "Limite de convites pendentes.")
            conn.execute("INSERT INTO mesh_invites VALUES(?,?)", (digest(token), now + 600))
        return {"invitation": token, "expires": now + 600, "authority_id": a.id}

    @api.post("/api/v1/mesh/enroll")
    def enroll(body: Enrollment, a=Depends(available)):
        now = int(time.time())
        try:
            key = public_ec(body.public_jwk)
            proof = verify(body.proof, key)
            if (
                set(proof) != {"kind", "invitation_hash", "subject", "at"}
                or proof["kind"] != "mesh-enrollment"
                or proof["invitation_hash"] != digest(body.invitation)
                or proof["subject"] != key.thumbprint()
                or abs(proof["at"] - now) > 120
            ):
                raise ValueError("Enrollment proof")
            with db.connect() as conn:
                conn.execute("BEGIN IMMEDIATE")
                row = conn.execute(
                    "SELECT expires FROM mesh_invites WHERE hash=?", (digest(body.invitation),)
                ).fetchone()
                if (
                    not row
                    or row[0] <= now
                    or conn.execute(
                        "SELECT 1 FROM mesh_revoked WHERE subject=?", (key.thumbprint(),)
                    ).fetchone()
                ):
                    raise ValueError("Invitation expired, used or revoked")
                credential = sign(
                    {
                        "aud": "mesh-member-v1",
                        "sub": key.thumbprint(),
                        "jwk": body.public_jwk,
                        "iat": now,
                        "nbf": now,
                        "exp": now + 86400,
                        "role": "participant",
                    },
                    a.signing,
                )
                conn.execute("DELETE FROM mesh_invites WHERE hash=?", (digest(body.invitation),))
            return {"credential": credential}
        except Exception as exc:
            if isinstance(exc, HTTPException):
                raise
            raise HTTPException(401, "Convite ou prova inválida.") from None

    @api.post("/api/v1/mesh/revoke")
    def revoke(body: Revocation, actor=Depends(admin), a=Depends(available)):
        with db.connect() as conn:
            conn.execute("INSERT OR IGNORE INTO mesh_revoked VALUES(?)", (body.subject,))
        return {"revoked": body.subject}

    @api.post("/api/v1/mesh/deliveries")
    def deliver(body: Delivery, a=Depends(available)):
        now = int(time.time())
        with db.connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            revoked = [r[0] for r in conn.execute("SELECT subject FROM mesh_revoked")]
            try:
                origin, origin_hash, submission, nonce = a.envelope(
                    body.envelope, body.credential, body.proof, revoked, now
                )
            except Exception:
                raise HTTPException(422, "Envelope inválido, expirado ou não autorizado.") from None
            old = conn.execute(
                "SELECT * FROM mesh_deliveries WHERE message_id=?", (origin["message_id"],)
            ).fetchone()
            if old:
                if old["origin_hash"] != origin_hash:
                    raise HTTPException(409, "Identificador mesh reutilizado.")
                return {"proof": old["proof"]}
            conn.execute("DELETE FROM mesh_nonces WHERE expires<=?", (now,))
            if conn.execute("SELECT 1 FROM mesh_nonces WHERE nonce=?", (nonce,)).fetchone():
                raise HTTPException(409, "Prova de sessão reutilizada.")
            if conn.execute("SELECT COUNT(*) FROM mesh_deliveries").fetchone()[0] >= 10000:
                raise HTTPException(507, "Limite demonstrativo de recibos mesh.")
            receipt = persist(submission, conn)
            signed = sign(
                {
                    "kind": "mesh-server-receipt",
                    "message_id": origin["message_id"],
                    "origin_hash": origin_hash,
                    "receipt_id": str(receipt.receipt_id),
                    "server_received_at": receipt.server_received_at.isoformat(),
                    "status": "RECEBIDO_PELO_SERVIDOR",
                },
                a.signing,
            )
            conn.execute(
                "INSERT INTO mesh_deliveries VALUES(?,?,?,?,?,?)",
                (
                    origin["message_id"],
                    origin_hash,
                    str(submission.incident.incident_id),
                    len(body.envelope["hops"]),
                    signed,
                    receipt.server_received_at.isoformat(),
                ),
            )
            conn.execute("INSERT INTO mesh_nonces VALUES(?,?)", (nonce, now + 300))
        return {"proof": signed}  # Only after the transaction commits.
