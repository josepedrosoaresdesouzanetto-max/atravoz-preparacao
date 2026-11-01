from fastapi import FastAPI

app = FastAPI(title="Resilient communications", version="0.1.0")


@app.get("/api/v1/health")
def health():
    return {"status": "ok", "mode": "synthetic-demo", "schema_version": 1}
