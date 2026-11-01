"""Execute da raiz: .venv/Scripts/python scripts/export_contracts.py."""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services/intelligence/src"))
from intelligence.contracts import AIAnalysis, Incident, ServerReceipt  # noqa: E402

for model in (Incident, AIAnalysis, ServerReceipt):
    (ROOT / f"packages/contracts/{model.__name__}.schema.json").write_text(
        json.dumps(model.model_json_schema(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
