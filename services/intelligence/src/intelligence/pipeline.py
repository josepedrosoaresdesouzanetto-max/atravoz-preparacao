import time

from intelligence.contracts import AIAnalysis, Incident, ModelOutput
from intelligence.deduplication import suggest_duplicates
from intelligence.extraction import INJECTION, extract_rules, folded, validate_evidence
from intelligence.normalization import normalize
from intelligence.providers import Provider


def analyze(
    incident: Incident, provider: Provider | None = None, candidates: list[Incident] | None = None
) -> AIAnalysis:
    start = time.perf_counter()
    text = normalize(incident.description)
    output = extract_rules(text)
    status, model, raw, error = "rules", "deterministic-rules-v1", None, None
    if provider is not None:
        try:
            if INJECTION.search(folded(text)):
                raise ValueError("instruction-like content")
            raw = provider.extract(text)
            if len(raw) > 16000:
                raw = raw[:16000]
                raise ValueError("oversized output")
            output = ModelOutput.model_validate_json(raw)
            validate_evidence(output, text)
            status, model = "model", provider.name
        except Exception as exc:
            # Provider failures are isolated here. No input, URL or secret goes into logs.
            output = extract_rules(text)
            status, model, error = (
                "fallback",
                f"{provider.name} -> deterministic-rules-v1",
                type(exc).__name__,
            )
            output.limitations.append(
                "Modelo indisponível ou saída rejeitada; aplicada contingência por regras."
            )
    missing = ["confirmação humana", "horário do fato (criação do registro não é horário do evento)"]
    if incident.location is None:
        missing.append("localização")
    if output.extracted_information.people_mentioned is None:
        missing.append("quantidade de pessoas")
    return AIAnalysis(
        incident_id=incident.incident_id,
        model_name=model,
        original_text=incident.description,
        normalized_text=text,
        suggested_category=output.suggested_category,
        extracted_information=output.extracted_information,
        missing_information=missing,
        possible_duplicates=suggest_duplicates(incident, candidates or []),
        limitations=output.limitations + ["Resultado exige revisão; não determina prioridade de resgate."],
        confidence=output.confidence,
        processing_status=status,
        raw_output=raw,
        error_code=error,
        duration_ms=round((time.perf_counter() - start) * 1000, 3),
    )
