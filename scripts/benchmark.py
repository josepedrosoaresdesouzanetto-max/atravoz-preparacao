"""Microbenchmark local, sintético; não representa celular nem consumo de bateria."""

import gzip
import json
import platform
import statistics
import sys
import time
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "services/api"), str(ROOT / "services/intelligence/src")]
from fastapi.testclient import TestClient  # noqa: E402
from app.main import create_app  # noqa: E402
from intelligence.contracts import Incident, utcnow  # noqa: E402
from intelligence.pipeline import analyze  # noqa: E402

samples = []
now = utcnow()
incident = Incident(
    incident_id=uuid4(),
    created_at=now,
    updated_at=now,
    record_type="help",
    description="Três pessoas ilhadas no telhado. Água subindo.",
    synthetic=True,
)
for _ in range(100):
    started = time.perf_counter()
    analyze(incident)
    samples.append((time.perf_counter() - started) * 1000)
client = TestClient(
    create_app(ROOT / "runtime" / f"benchmark-{uuid4()}.sqlite", "benchmark-only-" + "x" * 32)
)
api_samples = []
for _ in range(50):
    item = incident.model_copy(update={"incident_id": uuid4()})
    started = time.perf_counter()
    result = client.post(
        "/api/v1/incidents", json={"incident": item.model_dump(mode="json"), "write_key": "a" * 64}
    )
    if result.status_code != 200:
        raise RuntimeError(f"Benchmark failed: HTTP {result.status_code}")
    api_samples.append((time.perf_counter() - started) * 1000)


def stats(values):
    return {
        "samples": len(values),
        "median_ms": round(statistics.median(values), 3),
        "p95_ms": round(sorted(values)[int(len(values) * 0.95) - 1], 3),
    }


assets = [
    {
        "file": str(p.relative_to(ROOT / "dist")).replace("\\", "/"),
        "bytes": p.stat().st_size,
        "gzip_bytes": len(gzip.compress(p.read_bytes())),
    }
    for p in (ROOT / "dist").rglob("*")
    if p.is_file()
]
report = {
    "recorded_at": utcnow().isoformat(),
    "system": platform.platform(),
    "python": platform.python_version(),
    "rules": stats(samples),
    "api_in_process_sqlite": stats(api_samples),
    "build_assets": assets,
    "limitations": "Processo local desktop, sem rede física; sem medição de bateria, aparelho modesto, carga concorrente ou usabilidade.",
}
(ROOT / "docs/evidence").mkdir(exist_ok=True)
(ROOT / "docs/evidence/benchmark.json").write_text(
    json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)
print(json.dumps({k: report[k] for k in ["rules", "api_in_process_sqlite"]}, ensure_ascii=False))
