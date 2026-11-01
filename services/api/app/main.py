import hashlib
import hmac
import os
import sqlite3
import sys
from pathlib import Path
from typing import Literal
from uuid import UUID

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import Field

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "services/intelligence/src"))
from intelligence.contracts import Incident, ServerReceipt, StrictModel, Submission, utcnow  # noqa: E402
from intelligence.pipeline import analyze  # noqa: E402
from intelligence.providers import OllamaProvider  # noqa: E402
from app.database import Database  # noqa: E402
from app.media import validate_media  # noqa: E402
from app.security import RequestLimits, key_hash, require_operator  # noqa: E402


class Review(StrictModel):
    status: Literal["EM_VERIFICACAO", "VERIFICADO", "CORRIGIDO", "INVALIDADO"]
    note: str = Field(min_length=5, max_length=2000)
    expected_status: str


TRANSITIONS = {
    "RECEBIDO_SERVIDOR": {"EM_VERIFICACAO", "CORRIGIDO", "INVALIDADO"},
    "EM_VERIFICACAO": {"VERIFICADO", "CORRIGIDO", "INVALIDADO"},
    "VERIFICADO": {"EM_VERIFICACAO", "CORRIGIDO", "INVALIDADO"},
    "CORRIGIDO": {"EM_VERIFICACAO", "INVALIDADO"},
    "INVALIDADO": {"EM_VERIFICACAO", "CORRIGIDO"},
}


def create_app(db_path=None, operator_token=None, provider=None, rate_limit=120):
    api = FastAPI(title="Resilient communications", version="1.0.0", docs_url=None, redoc_url=None)
    db = Database(str(db_path or os.environ.get("DATABASE_PATH", ROOT / "runtime/incidents.sqlite3")))
    api.state.db = db
    api.state.provider = provider
    if provider is None and os.environ.get("AI_PROVIDER") == "ollama":
        try:
            api.state.provider = OllamaProvider(
                os.environ.get("OLLAMA_MODEL", ""), os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
            )
        except ValueError:

            class MisconfiguredProvider:
                name = "misconfigured-model"

                def extract(self, text):
                    raise RuntimeError("Model configuration unavailable")

            api.state.provider = MisconfiguredProvider()
    admin = require_operator(
        operator_token if operator_token is not None else os.environ.get("OPERATOR_TOKEN", "")
    )
    api.add_middleware(RequestLimits, per_minute=rate_limit)

    @api.middleware("http")
    async def security_headers(request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'"
        )
        response.headers["Cache-Control"] = "no-store" if request.url.path.startswith("/api") else "no-cache"
        return response

    @api.exception_handler(sqlite3.Error)
    async def database_failure(request, exc):
        return JSONResponse(
            {"detail": "Armazenamento indisponível. Preserve o registro e tente novamente."}, 503
        )

    @api.get("/api/v1/health")
    def health():
        return {"status": "ok", "mode": "synthetic-demo", "schema_version": 1}

    @api.get("/api/v1/config")
    def config():
        return {"app_name": os.environ.get("APP_NAME", "ATRAVOZ"), "mode": "synthetic-demo"}

    @api.get("/api/v1/ready")
    def ready():
        with db.connect() as conn:
            conn.execute("SELECT 1 FROM incidents LIMIT 1")
        return {"status": "ready", "ai_required": False}

    def get_row(conn, incident_id):
        row = conn.execute("SELECT * FROM incidents WHERE id=?", (str(incident_id),)).fetchone()
        if row is None:
            raise HTTPException(404, "Ocorrência não encontrada.")
        return row

    def owned(row, authorization):
        token = authorization.removeprefix("Bearer ")
        if not hmac.compare_digest(row["key_hash"], key_hash(token)):
            raise HTTPException(401, "Chave de envio inválida.")

    @api.post("/api/v1/incidents", response_model=ServerReceipt)
    def submit(submission: Submission):
        incident = submission.incident
        payload = incident.model_dump_json()
        iid, hashed = str(incident.incident_id), key_hash(submission.write_key)
        with db.connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            old = conn.execute("SELECT * FROM incidents WHERE id=?", (iid,)).fetchone()
            if old:
                owned(old, "Bearer " + submission.write_key)
                if old["payload"] != payload:
                    raise HTTPException(
                        409, "Mesmo identificador com conteúdo diferente. Preserve e revise; não sobrescreva."
                    )
                return ServerReceipt.model_validate_json(old["receipt"])
            if conn.execute("SELECT COUNT(*) FROM incidents").fetchone()[0] >= 5000:
                raise HTTPException(507, "Limite demonstrativo de ocorrências atingido.")
            receipt = ServerReceipt(incident_id=incident.incident_id)
            at = receipt.server_received_at.isoformat()
            conn.execute(
                "INSERT INTO incidents VALUES(?,?,?,?,?,?)",
                (iid, payload, hashed, receipt.model_dump_json(), at, receipt.status),
            )
            conn.execute(
                "INSERT INTO history(incident_id,status,at,actor,note) VALUES(?,?,?,?,?)",
                (iid, receipt.status, at, "api", "Persistência técnica; sem confirmação de atendimento."),
            )
            conn.execute(
                "INSERT INTO audit(incident_id,at,actor,action) VALUES(?,?,?,?)", (iid, at, "api", "created")
            )
        return receipt

    @api.get("/api/v1/incidents")
    def listing(
        actor=Depends(admin),
        limit: int = Query(default=100, ge=1, le=200),
        offset: int = Query(default=0, ge=0),
    ):
        with db.connect() as conn:
            rows = conn.execute(
                "SELECT * FROM incidents ORDER BY received_at DESC LIMIT ? OFFSET ?", (limit, offset)
            )
            items = [db.detail(conn, row) for row in rows.fetchall()]
            total = conn.execute("SELECT COUNT(*) FROM incidents").fetchone()[0]
        return {"items": items, "total": total, "limit": limit, "offset": offset}

    @api.get("/api/v1/incidents/{incident_id}")
    def detail(incident_id: UUID, actor=Depends(admin)):
        with db.connect() as conn:
            return db.detail(conn, get_row(conn, incident_id))

    @api.get("/api/v1/incidents/{incident_id}/status")
    def status(incident_id: UUID, authorization: str = Header(default="")):
        with db.connect() as conn:
            row = get_row(conn, incident_id)
            owned(row, authorization)
            receipt = ServerReceipt.model_validate_json(row["receipt"])
            receipt.attachment_ids_received = [
                UUID(r[0])
                for r in conn.execute("SELECT id FROM attachments WHERE incident_id=?", (str(incident_id),))
            ]
            return {"receipt": receipt, "verification_status": row["status"]}

    @api.post("/api/v1/incidents/{incident_id}/attachments")
    async def upload(
        incident_id: UUID,
        request: Request,
        x_attachment_id: UUID = Header(),
        authorization: str = Header(default=""),
    ):
        data = await request.body()
        with db.connect() as conn:
            row = get_row(conn, incident_id)
            owned(row, authorization)
            incident = Incident.model_validate_json(row["payload"])
        manifest = next((a for a in incident.attachments if a.attachment_id == x_attachment_id), None)
        if manifest is None:
            raise HTTPException(422, "Anexo não declarado nesta ocorrência.")
        if len(data) != manifest.byte_size or hashlib.sha256(data).hexdigest() != manifest.sha256:
            raise HTTPException(422, "Tamanho ou integridade do anexo inválidos.")
        if request.headers.get("content-type", "").split(";")[0] != manifest.mime_type:
            raise HTTPException(415, "Tipo diferente do manifesto.")
        validate_media(data, manifest.mime_type)
        with db.connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            old = conn.execute("SELECT * FROM attachments WHERE id=?", (str(x_attachment_id),)).fetchone()
            if old and (old["incident_id"] != str(incident_id) or old["sha256"] != manifest.sha256):
                raise HTTPException(409, "Identificador de anexo em conflito.")
            at = old["received_at"] if old else utcnow().isoformat()
            if not old:
                total = conn.execute("SELECT COALESCE(SUM(length(bytes)),0) FROM attachments").fetchone()[0]
                if total + len(data) > 200 * 1024 * 1024:
                    raise HTTPException(507, "Limite demonstrativo de mídia atingido.")
                conn.execute(
                    "INSERT INTO attachments VALUES(?,?,?,?,?,?)",
                    (str(x_attachment_id), str(incident_id), manifest.mime_type, manifest.sha256, data, at),
                )
                conn.execute(
                    "INSERT INTO audit(incident_id,at,actor,action) VALUES(?,?,?,?)",
                    (str(incident_id), at, "api", "attachment_received"),
                )
        return {
            "attachment_id": str(x_attachment_id),
            "incident_id": str(incident_id),
            "sha256": manifest.sha256,
            "status": "RECEBIDO_SERVIDOR",
            "received_at": at,
        }

    @api.get("/api/v1/incidents/{incident_id}/attachments/{attachment_id}")
    def download(incident_id: UUID, attachment_id: UUID, actor=Depends(admin)):
        with db.connect() as conn:
            row = conn.execute(
                "SELECT * FROM attachments WHERE id=? AND incident_id=?",
                (str(attachment_id), str(incident_id)),
            ).fetchone()
            if not row:
                raise HTTPException(404, "Anexo ainda não recebido.")
            return Response(
                row["bytes"],
                media_type=row["mime"],
                headers={"Content-Disposition": f'attachment; filename="{attachment_id}"'},
            )

    @api.post("/api/v1/incidents/{incident_id}/analysis")
    def analysis(incident_id: UUID, actor=Depends(admin)):
        with db.connect() as conn:
            row = get_row(conn, incident_id)
            candidates = [
                Incident.model_validate_json(r[0])
                for r in conn.execute("SELECT payload FROM incidents ORDER BY received_at DESC LIMIT 200")
            ]
        result = analyze(Incident.model_validate_json(row["payload"]), api.state.provider, candidates)
        with db.connect() as conn:
            conn.execute(
                "INSERT INTO analyses VALUES(?,?,?)",
                (str(result.analysis_id), str(incident_id), result.model_dump_json()),
            )
            conn.execute(
                "INSERT INTO audit(incident_id,at,actor,action) VALUES(?,?,?,?)",
                (str(incident_id), utcnow().isoformat(), actor, "analysis_requested"),
            )
        return result

    @api.post("/api/v1/incidents/{incident_id}/review")
    def review(incident_id: UUID, change: Review, actor=Depends(admin)):
        if not change.note.strip():
            raise HTTPException(422, "Justificativa obrigatória.")
        with db.connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            row = get_row(conn, incident_id)
            if change.expected_status != row["status"]:
                raise HTTPException(409, "Estado mudou; atualize antes de revisar.")
            if change.status not in TRANSITIONS.get(row["status"], set()):
                raise HTTPException(409, "Transição de estado não permitida.")
            at = utcnow().isoformat()
            conn.execute("UPDATE incidents SET status=? WHERE id=?", (change.status, str(incident_id)))
            conn.execute(
                "INSERT INTO history(incident_id,status,at,actor,note) VALUES(?,?,?,?,?)",
                (str(incident_id), change.status, at, actor, change.note),
            )
            conn.execute(
                "INSERT INTO audit(incident_id,at,actor,action) VALUES(?,?,?,?)",
                (str(incident_id), at, actor, "status:" + change.status),
            )
        return {"incident_id": str(incident_id), "status": change.status, "at": at}

    if (ROOT / "dist").exists():
        api.mount("/", StaticFiles(directory=ROOT / "dist", html=True), name="web")
    return api


app = create_app()
