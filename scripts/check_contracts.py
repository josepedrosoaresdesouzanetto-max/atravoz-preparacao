"""Falha se o esquema publicado divergir dos modelos canônicos."""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services/intelligence/src"))
from intelligence.contracts import AIAnalysis, Incident, ServerReceipt  # noqa: E402

for model in (Incident, AIAnalysis, ServerReceipt):
    saved = json.loads(
        (ROOT / f"packages/contracts/{model.__name__}.schema.json").read_text(encoding="utf-8")
    )
    if saved != model.model_json_schema():
        raise SystemExit(
            f"Contrato desatualizado: {model.__name__}. Execute export_contracts.py e revise clientes."
        )
print("3 contratos JSON correspondem aos modelos Python.")
