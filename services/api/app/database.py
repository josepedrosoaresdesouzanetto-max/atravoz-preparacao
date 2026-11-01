import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path

SCHEMA = """
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS incidents (
 id TEXT PRIMARY KEY, payload TEXT NOT NULL, key_hash TEXT NOT NULL,
 receipt TEXT NOT NULL, received_at TEXT NOT NULL, status TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS attachments (
 id TEXT PRIMARY KEY, incident_id TEXT NOT NULL REFERENCES incidents(id),
 mime TEXT NOT NULL, sha256 TEXT NOT NULL, bytes BLOB NOT NULL, received_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS history (
 seq INTEGER PRIMARY KEY AUTOINCREMENT, incident_id TEXT NOT NULL REFERENCES incidents(id),
 status TEXT NOT NULL, at TEXT NOT NULL, actor TEXT NOT NULL, note TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS analyses (
 id TEXT PRIMARY KEY, incident_id TEXT NOT NULL REFERENCES incidents(id), result TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit (
 seq INTEGER PRIMARY KEY AUTOINCREMENT, incident_id TEXT, at TEXT NOT NULL,
 actor TEXT NOT NULL, action TEXT NOT NULL
);
PRAGMA user_version=1;
"""


class Database:
    def __init__(self, path: str):
        self.path = path
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as conn:
            version = conn.execute("PRAGMA user_version").fetchone()[0]
            if version not in (0, 1):
                raise RuntimeError("Unsupported database schema; preserve file and migrate explicitly")
            conn.executescript(SCHEMA)

    @contextmanager
    def connect(self):
        conn = sqlite3.connect(self.path, timeout=5)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys=ON")
        try:
            with conn:
                yield conn
        finally:
            conn.close()

    def detail(self, conn, row):
        item = json.loads(row["payload"])
        item.update(
            status=row["status"],
            server_received_at=row["received_at"],
            has_audio=any(a["kind"] == "audio" for a in item["attachments"]),
            has_photo=any(a["kind"] == "photo" for a in item["attachments"]),
        )
        item["received_attachments"] = [
            dict(x)
            for x in conn.execute(
                "SELECT id, mime, sha256, received_at FROM attachments WHERE incident_id=?", (row["id"],)
            )
        ]
        item["history"] = [
            dict(x)
            for x in conn.execute(
                "SELECT status,at,actor,note FROM history WHERE incident_id=? ORDER BY seq", (row["id"],)
            )
        ]
        item["analyses"] = [
            json.loads(x[0])
            for x in conn.execute(
                "SELECT result FROM analyses WHERE incident_id=? ORDER BY rowid DESC LIMIT 5", (row["id"],)
            )
        ]
        return item
