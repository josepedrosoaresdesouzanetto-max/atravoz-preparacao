"""Avaliação reproduzível, exclusivamente sintética, do fallback local."""

import json
import sys
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services/intelligence/src"))
from intelligence.contracts import Incident, utcnow  # noqa: E402
from intelligence.pipeline import analyze  # noqa: E402

cases = json.loads(
    (ROOT / "services/intelligence/fixtures/synthetic/evaluation.json").read_text(encoding="utf-8")
)
results = []
for case in cases:
    now = utcnow()
    incident = Incident(
        incident_id=uuid4(),
        created_at=now,
        updated_at=now,
        record_type="witness",
        description=case["text"],
        synthetic=True,
    )
    result = analyze(incident)
    checks = {
        "people_matches": result.extracted_information.people_mentioned == case["people"],
        "category_matches": result.suggested_category == case["category"],
        "original_preserved": result.original_text == case["text"],
        "missing_location_identified": "localização" in result.missing_information,
        "review_required": result.human_review_required and not result.information_confirmed,
    }
    results.append({"case": case["id"], "checks": checks, "analysis": result.model_dump(mode="json")})
passed = sum(all(r["checks"].values()) for r in results)
report = {
    "evaluated_at": utcnow().isoformat(),
    "provider": "deterministic-rules-v1",
    "cases": len(cases),
    "all_checks_passed_cases": passed,
    "limitations": "Conjunto pequeno, escrito junto com as regras. Não mede generalização, acurácia clínica nem qualidade de LLM.",
    "results": results,
}
directory = ROOT / "services/intelligence/reports"
directory.mkdir(exist_ok=True)
(directory / "evaluation.json").write_text(
    json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)
(directory / "EVALUATION.md").write_text(
    f"# Avaliação sintética executada\n\nData UTC: {report['evaluated_at']}.\n\n{passed}/{len(cases)} casos passaram nas cinco verificações. Provedor: regras determinísticas, sem chamada a modelo.\n\n{report['limitations']}\n\nResultados por caso, entradas e saídas completas: `evaluation.json`. Comando: `.venv/Scripts/python scripts/evaluate.py`.\n",
    encoding="utf-8",
)
print(f"{passed}/{len(cases)} casos sintéticos passaram; relatório salvo.")
sys.exit(0 if passed == len(cases) else 1)
