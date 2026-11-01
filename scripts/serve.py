"""Um servidor local serve API e build. Sem credencial embutida ou publicação."""

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
os.chdir(ROOT)
sys.path.insert(0, str(ROOT / "services/api"))
sys.path.insert(0, str(ROOT / "services/intelligence/src"))

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="127.0.0.1", port=int(os.environ.get("PORT", "8000")), access_log=False)
