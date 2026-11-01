"""Protocolo de laboratório. NÃO acessa rádio Bluetooth e NÃO cifra dados."""

import hashlib
import json
import sqlite3
import struct
import time
from pathlib import Path
from uuid import UUID, uuid4

from intelligence.contracts import Incident, utcnow

MAX_PACKET = 8192
HEADER = 20  # UUID de sessão + índice uint16 + total uint16


def encode(incident: Incident, sender_id: str) -> bytes:
    if len(incident.description) > 320:
        raise ValueError("Relato acima de 320 caracteres: não truncar silenciosamente nem alterar o UUID")
    body = {
        "protocol_version": 1,
        "transfer_id": str(uuid4()),
        "sender_id": str(UUID(sender_id)),
        "incident": incident.model_dump(mode="json"),
    }
    raw = json.dumps(body, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()
    packet = json.dumps(
        {"body": body, "sha256": hashlib.sha256(raw).hexdigest()}, ensure_ascii=False, separators=(",", ":")
    ).encode()
    if len(packet) > MAX_PACKET:
        raise ValueError("Packet exceeds bound")
    return packet


def decode(packet: bytes):
    if len(packet) > MAX_PACKET:
        raise ValueError("Packet exceeds bound")
    envelope = json.loads(packet)
    if set(envelope) != {"body", "sha256"}:
        raise ValueError("Unknown envelope fields")
    body = envelope["body"]
    if (
        set(body) != {"protocol_version", "transfer_id", "sender_id", "incident"}
        or body["protocol_version"] != 1
    ):
        raise ValueError("Incompatible protocol")
    UUID(body["transfer_id"])
    UUID(body["sender_id"])
    raw = json.dumps(body, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()
    if hashlib.sha256(raw).hexdigest() != envelope["sha256"]:
        raise ValueError("Integrity mismatch")
    incident = Incident.model_validate(body["incident"])
    if len(incident.description) > 320:
        raise ValueError("Description limit")
    return body, envelope["sha256"], incident


def fragment(packet: bytes, max_frame: int = 180) -> list[bytes]:
    body, _, _ = decode(packet)
    if not 84 <= max_frame <= 244:
        raise ValueError("Negotiate usable ATT payload >=84; default MTU not supported by this experiment")
    size = max_frame - HEADER
    chunks = [packet[i : i + size] for i in range(0, len(packet), size)]
    return [
        UUID(body["transfer_id"]).bytes + struct.pack("!HH", i, len(chunks)) + data
        for i, data in enumerate(chunks)
    ]


class Reassembler:
    def __init__(self):
        self.started = time.monotonic()
        self.session = None
        self.total = None
        self.parts = {}

    def accept(self, frame: bytes) -> bytes | None:
        if time.monotonic() - self.started > 120:
            raise ValueError("Session expired; restart transfer")
        if not HEADER < len(frame) <= 244:
            raise ValueError("Invalid frame length")
        session = frame[:16]
        index, total = struct.unpack("!HH", frame[16:20])
        if not 1 <= total <= 128 or index >= total:
            raise ValueError("Invalid sequence")
        if self.session is None:
            self.session, self.total = session, total
        if session != self.session or total != self.total:
            raise ValueError("Mixed sessions")
        data = frame[20:]
        if index in self.parts and self.parts[index] != data:
            raise ValueError("Conflicting fragment")
        self.parts[index] = data
        if sum(map(len, self.parts.values())) > MAX_PACKET:
            raise ValueError("Packet exceeds bound")
        if len(self.parts) == self.total:
            packet = b"".join(self.parts[i] for i in range(total))
            body, _, _ = decode(packet)
            if UUID(body["transfer_id"]).bytes != session:
                raise ValueError("Envelope session mismatch")
            return packet
        return None


class DurableInbox:
    def __init__(self, path: str, receiver_id: str):
        self.path, self.receiver_id = path, str(UUID(receiver_id))
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(path) as conn:
            conn.execute("CREATE TABLE IF NOT EXISTS inbox(id TEXT PRIMARY KEY,payload TEXT NOT NULL)")
            conn.execute(
                "CREATE TABLE IF NOT EXISTS receipts(id TEXT PRIMARY KEY,digest TEXT NOT NULL,receipt TEXT NOT NULL)"
            )

    def receive(self, packet: bytes):
        body, digest, incident = decode(packet)
        payload = incident.model_dump_json()
        with sqlite3.connect(self.path) as conn:
            conn.execute("BEGIN IMMEDIATE")
            old_receipt = conn.execute(
                "SELECT digest,receipt FROM receipts WHERE id=?", (body["transfer_id"],)
            ).fetchone()
            if old_receipt:
                if old_receipt[0] != digest:
                    raise ValueError("Transfer id conflict")
                return json.loads(old_receipt[1])
            old = conn.execute(
                "SELECT payload FROM inbox WHERE id=?", (str(incident.incident_id),)
            ).fetchone()
            if old and old[0] != payload:
                raise ValueError("Incident conflict; manual review needed")
            conn.execute("INSERT OR IGNORE INTO inbox VALUES(?,?)", (str(incident.incident_id), payload))
            receipt = {
                "transfer_id": body["transfer_id"],
                "incident_id": str(incident.incident_id),
                "receiver_id": self.receiver_id,
                "sha256": digest,
                "stored_at": utcnow().isoformat(),
                "status": "TRANSFERIDO_PARA_DISPOSITIVO",
                "server_received": False,
            }
            conn.execute(
                "INSERT INTO receipts VALUES(?,?,?)", (body["transfer_id"], digest, json.dumps(receipt))
            )
        return receipt  # Only after commit; not a Bluetooth or server delivery assertion.
