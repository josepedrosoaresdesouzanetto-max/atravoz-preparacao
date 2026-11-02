import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "services/intelligence/src"))
from intelligence.local_models import worker  # noqa: E402

if __name__ == "__main__":
    audio = sys.stdin.buffer.read(4 * 1024 * 1024 + 1)
    if len(audio) > 4 * 1024 * 1024:
        raise SystemExit(2)
    print(json.dumps(worker(sys.argv[1], sys.argv[2], audio), ensure_ascii=True))
