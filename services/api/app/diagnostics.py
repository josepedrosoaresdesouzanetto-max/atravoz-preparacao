"""Technical diagnostics with an allowlist: never accept free-text error messages."""

import json
import time
import sys
from datetime import datetime, timezone
from typing import Literal
from uuid import UUID, uuid4

from fastapi import Depends, HTTPException
from pydantic import Field
from intelligence.contracts import StrictModel
from app.mesh import digest, verify

CODES = Literal[
    "APP_START",
    "APP_FAILURE",
    "STORAGE_FAILED",
    "SYNC_FAILED",
    "UPLOAD_FAILED",
    "NETWORK_OFFLINE",
    "NETWORK_ONLINE",
    "RADIO_DISCOVERY_FAILED",
    "MESH_AUTH_FAILED",
    "MESH_TRANSFER_FAILED",
    "FRAGMENT_REJECTED",
    "INTEGRITY_REJECTED",
    "CRYPTO_FAILED",
    "DUPLICATE_AVOIDED",
    "RESOURCE_LIMIT",
    "CAMERA_FAILED",
    "MICROPHONE_FAILED",
    "API_FAILED",
    "AI_FAILED",
    "CENTRAL_FAILED",
    "UPDATE_FAILED",
    "RECOVERED",
    "EXPORT_READY",
]


class DiagnosticEvent(StrictModel):
    event_id: UUID
    correlation_id: UUID
    at: datetime
    last_at: datetime
    version: str = Field(pattern=r"^\d+\.\d+\.\d+(?:-[a-z0-9]+)?$", max_length=30)
    platform: Literal["android", "windows", "ios", "linux", "macos", "unknown"]
    module: Literal["app", "storage", "sync", "mesh", "media", "api", "ai", "central", "update"]
    operation: Literal[
        "initialize",
        "save",
        "send",
        "receive",
        "discover",
        "authenticate",
        "upload",
        "capture",
        "analyze",
        "export",
        "update",
        "connect",
    ]
    code: CODES
    result: Literal["success", "failure", "pending", "recovered"]
    recovery: Literal["none", "queued", "retry", "fallback", "manual"]
    attempt: int = Field(ge=0, le=100)
    duration_ms: int = Field(ge=0, le=3600000)
    network: Literal["online", "offline", "unknown"]
    count: int = Field(ge=1, le=10000)


class DiagnosticReport(StrictModel):
    schema_version: Literal[1]
    report_id: UUID
    created_at: datetime
    events: list[DiagnosticEvent] = Field(max_length=100)
    privacy: Literal["allowlisted-technical-fields-only"]


class DiagnosticUpload(StrictModel):
    serialized: str = Field(max_length=65536)
    credential: str = Field(max_length=3000)
    proof: str = Field(max_length=3000)


def register_diagnostics(api, db, admin):
    with db.connect() as conn:
        conn.executescript("""CREATE TABLE IF NOT EXISTS diagnostic_reports(
          id TEXT PRIMARY KEY, digest TEXT NOT NULL, subject_hash TEXT NOT NULL, received INTEGER NOT NULL, payload TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS diagnostic_events(id TEXT PRIMARY KEY,at INTEGER NOT NULL,payload TEXT NOT NULL);
        """)

    def server_event(code, module, operation, duration=0, result="failure", recovery="none"):
        now = int(time.time())
        event = DiagnosticEvent(
            event_id=uuid4(),
            correlation_id=uuid4(),
            at=datetime.now(timezone.utc),
            last_at=datetime.now(timezone.utc),
            version="0.2.0-test",
            platform="windows"
            if sys.platform == "win32"
            else "linux"
            if sys.platform.startswith("linux")
            else "macos"
            if sys.platform == "darwin"
            else "unknown",
            module=module,
            operation=operation,
            code=code,
            result=result,
            recovery=recovery,
            attempt=0,
            duration_ms=min(3600000, max(0, int(duration))),
            network="unknown",
            count=1,
        )
        try:
            with db.connect() as conn:
                conn.execute("BEGIN IMMEDIATE")
                conn.execute("DELETE FROM diagnostic_events WHERE at<?", (now - 3 * 86400,))
                # Rate-limit identical technical events; do not persist raw request or exception data.
                recent = conn.execute(
                    "SELECT payload FROM diagnostic_events WHERE at>? ORDER BY at DESC LIMIT 50", (now - 30,)
                ).fetchall()
                if any(json.loads(row[0])["code"] == code for row in recent):
                    return
                conn.execute(
                    "INSERT INTO diagnostic_events VALUES(?,?,?)",
                    (str(event.event_id), now, event.model_dump_json()),
                )
                conn.execute(
                    "DELETE FROM diagnostic_events WHERE id NOT IN (SELECT id FROM diagnostic_events ORDER BY at DESC LIMIT 1000)"
                )
        except Exception:
            pass  # Diagnostics must not prevent recording an emergency request.

    api.state.diagnostic_event = server_event

    @api.post("/api/v1/diagnostics")
    def upload(body: DiagnosticUpload):
        authority = api.state.mesh_authority
        if authority is None:
            raise HTTPException(503, "Credenciais de diagnóstico não provisionadas.")
        now = int(time.time())
        try:
            report = DiagnosticReport.model_validate_json(body.serialized)
            if (
                report.created_at.tzinfo is None
                or not now - 86400 - 300 <= report.created_at.timestamp() <= now + 300
            ):
                raise ValueError("time")
            for event in report.events:
                if (
                    event.at.tzinfo is None
                    or event.last_at.tzinfo is None
                    or not now - 7 * 86400 - 300
                    <= event.at.timestamp()
                    <= event.last_at.timestamp()
                    <= now + 300
                ):
                    raise ValueError("time")
            hashed = digest(body.serialized)
            with db.connect() as conn:
                conn.execute("BEGIN IMMEDIATE")
                revoked = [r[0] for r in conn.execute("SELECT subject FROM mesh_revoked")]
                member, key = authority.member(body.credential, revoked, now)
                proof = verify(body.proof, key)
                if (
                    set(proof) != {"kind", "report_id", "digest", "at", "nonce"}
                    or proof["kind"] != "diagnostic-upload"
                    or proof["report_id"] != str(report.report_id)
                    or proof["digest"] != hashed
                    or abs(proof["at"] - now) > 120
                ):
                    raise ValueError("proof")
                UUID(proof["nonce"])
                conn.execute("DELETE FROM diagnostic_reports WHERE received<?", (now - 7 * 86400,))
                old = conn.execute(
                    "SELECT digest FROM diagnostic_reports WHERE id=?", (str(report.report_id),)
                ).fetchone()
                if old:
                    if old[0] != hashed:
                        raise HTTPException(409, "Identificador reutilizado.")
                    return {"report_id": str(report.report_id), "status": "PERSISTED"}
                subject = digest(member["sub"])
                if (
                    conn.execute(
                        "SELECT COUNT(*) FROM diagnostic_reports WHERE subject_hash=? AND received>?",
                        (subject, now - 86400),
                    ).fetchone()[0]
                    >= 10
                ):
                    raise HTTPException(429, "Cota diária de diagnósticos atingida.")
                if conn.execute("SELECT COUNT(*) FROM diagnostic_reports").fetchone()[0] >= 1000:
                    raise HTTPException(507, "Armazenamento de diagnósticos cheio.")
                conn.execute(
                    "INSERT INTO diagnostic_reports VALUES(?,?,?,?,?)",
                    (str(report.report_id), hashed, subject, now, report.model_dump_json()),
                )
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(422, "Relatório técnico ou autorização inválida.") from None
        return {"report_id": str(report.report_id), "status": "PERSISTED"}

    @api.get("/api/v1/diagnostics")
    def listing(actor=Depends(admin)):
        now = int(time.time())
        with db.connect() as conn:
            reports = [
                json.loads(r[0])
                for r in conn.execute(
                    "SELECT payload FROM diagnostic_reports WHERE received>? ORDER BY received DESC LIMIT 20",
                    (now - 7 * 86400,),
                )
            ]
            events = [
                json.loads(r[0])
                for r in conn.execute(
                    "SELECT payload FROM diagnostic_events WHERE at>? ORDER BY at DESC LIMIT 100",
                    (now - 3 * 86400,),
                )
            ]
        all_events = events + [event for report in reports for event in report["events"]]
        frequencies = {}
        for event in all_events:
            frequencies[event["code"]] = frequencies.get(event["code"], 0) + event["count"]
        return {
            "reports": reports,
            "server_events": events,
            "frequencies": frequencies,
            "versions": sorted({e["version"] for e in all_events}),
            "recovered": sum(e["count"] for e in all_events if e["result"] == "recovered"),
            "pending": sum(e["count"] for e in all_events if e["result"] == "pending"),
            "scope": "Últimos 20 relatórios e 100 eventos do servidor dentro da retenção; não é telemetria completa.",
        }
