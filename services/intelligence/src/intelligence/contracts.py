"""Contratos canônicos. Dados recebidos nunca carregam autoridade operacional."""

from datetime import datetime, timezone
from typing import Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Location(StrictModel):
    source: Literal["gps", "last_known", "manual"]
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    reference: str = Field(default="", max_length=240)
    accuracy_m: float | None = Field(default=None, ge=0, le=100000)
    timestamp: datetime
    confirmed: bool = False

    @field_validator("timestamp")
    @classmethod
    def aware(cls, v):
        if v.tzinfo is None:
            raise ValueError("timezone required")
        return v

    @model_validator(mode="after")
    def coherent(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("coordinates must be a pair")
        if self.source in ("gps", "last_known") and self.latitude is None:
            raise ValueError("coordinates required for sensor location")
        if self.source == "manual" and not self.reference.strip():
            raise ValueError("manual reference required")
        return self


class AttachmentManifest(StrictModel):
    attachment_id: UUID
    kind: Literal["audio", "photo"]
    mime_type: Literal[
        "image/jpeg", "image/png", "image/webp", "audio/webm", "audio/ogg", "audio/mp4", "audio/wav"
    ]
    byte_size: int = Field(ge=1, le=4 * 1024 * 1024, strict=True)
    sha256: str = Field(pattern=r"^[a-f0-9]{64}$")

    @model_validator(mode="after")
    def kind_matches(self):
        if (self.kind == "photo") != self.mime_type.startswith("image/"):
            raise ValueError("kind and mime mismatch")
        return self


class Incident(StrictModel):
    schema_version: Literal[1] = 1
    incident_id: UUID
    created_at: datetime
    updated_at: datetime
    record_type: Literal["help", "witness"]
    description: str = Field(default="", max_length=4000)
    location: Location | None = None
    origin_device_id: UUID | None = None
    attachments: list[AttachmentManifest] = Field(default_factory=list, max_length=2)
    synthetic: Literal[True]

    @field_validator("synthetic", mode="before")
    @classmethod
    def synthetic_boolean(cls, v):
        if v is not True:
            raise ValueError("synthetic must be the boolean true")
        return v

    @field_validator("created_at", "updated_at")
    @classmethod
    def aware(cls, v):
        if v.tzinfo is None:
            raise ValueError("timezone required")
        return v

    @model_validator(mode="after")
    def coherent(self):
        if self.updated_at < self.created_at:
            raise ValueError("updated_at precedes creation")
        if len({a.attachment_id for a in self.attachments}) != len(self.attachments):
            raise ValueError("duplicate attachment id")
        if len({a.kind for a in self.attachments}) != len(self.attachments):
            raise ValueError("one attachment per kind")
        return self


class Submission(StrictModel):
    incident: Incident
    write_key: str = Field(pattern=r"^[a-f0-9]{64}$")


class ServerReceipt(StrictModel):
    receipt_id: UUID = Field(default_factory=uuid4)
    incident_id: UUID
    status: Literal["RECEBIDO_SERVIDOR"] = "RECEBIDO_SERVIDOR"
    server_received_at: datetime = Field(default_factory=utcnow)
    code: Literal["PERSISTED"] = "PERSISTED"
    message: str = "Recebido pelo protótipo. Isso não confirma atendimento."
    attachment_ids_received: list[UUID] = Field(default_factory=list)


Category = Literal["pessoas_ilhadas", "alagamento", "deslizamento", "incendio", "indeterminado"]


class ExtractedInformation(StrictModel):
    people_mentioned: int | None = Field(default=None, ge=0, le=10000, strict=True)
    people_evidence: str | None = Field(default=None, max_length=200)
    conditions: list[str] = Field(default_factory=list, max_length=8)
    category_evidence: str | None = Field(default=None, max_length=200)


class ModelOutput(StrictModel):
    suggested_category: Category = "indeterminado"
    extracted_information: ExtractedInformation = Field(default_factory=ExtractedInformation)
    confidence: Literal["low", "medium"] = "low"
    limitations: list[str] = Field(default_factory=list, max_length=10)


class DuplicateSuggestion(StrictModel):
    incident_id: UUID
    score: float = Field(ge=0, le=1)
    reasons: list[str]


class AIAnalysis(StrictModel):
    analysis_id: UUID = Field(default_factory=uuid4)
    incident_id: UUID
    model_name: str
    processed_at: datetime = Field(default_factory=utcnow)
    original_text: str
    normalized_text: str
    suggested_category: Category
    extracted_information: ExtractedInformation
    missing_information: list[str]
    possible_duplicates: list[DuplicateSuggestion] = Field(default_factory=list)
    limitations: list[str]
    confidence: Literal["low", "medium"]
    human_review_required: Literal[True] = True
    information_confirmed: Literal[False] = False
    processing_status: Literal["model", "rules", "fallback"]
    raw_output: str | None = None
    error_code: str | None = None
    duration_ms: float
