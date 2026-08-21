"""Persisted analytics / session logging for fused fraud-risk verdicts.

Stores only verdict metadata (scores, risk level, which modalities were
evaluated) — never raw audio, images, or documents. This is intentionally
distinct from the debug audio recordings in routes/voice.py: it logs the
outcome of a decision, not the biometric material that produced it, so it
does not conflict with the fresh-analysis / no-stored-reference principle
(see CLAUDE.md).
"""

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "session_log.db"

_SCHEMA = """
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp_utc TEXT NOT NULL,
    fraud_risk_score REAL,
    liveness_index REAL,
    risk_level TEXT,
    recommendation TEXT,
    borderline INTEGER,
    escalated INTEGER,
    evaluated_modalities TEXT,
    unchecked_modalities TEXT,
    modality_scores TEXT
);
"""


@contextmanager
def _connect():
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute(_SCHEMA)
        yield conn
        conn.commit()
    finally:
        conn.close()


def log_session(fusion_result: dict) -> None:
    """Append one fused-verdict record. Never raises — logging must not
    break the real /risk-score response if it fails."""
    try:
        with _connect() as conn:
            conn.execute(
                """INSERT INTO sessions
                   (timestamp_utc, fraud_risk_score, liveness_index, risk_level,
                    recommendation, borderline, escalated, evaluated_modalities,
                    unchecked_modalities, modality_scores)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    datetime.now(timezone.utc).isoformat(),
                    fusion_result.get("fraud_risk_score"),
                    fusion_result.get("liveness_index"),
                    fusion_result.get("risk_level"),
                    fusion_result.get("recommendation"),
                    int(bool(fusion_result.get("borderline"))),
                    int(bool(fusion_result.get("escalated"))),
                    json.dumps(fusion_result.get("evaluated_modalities", [])),
                    json.dumps(fusion_result.get("unchecked_modalities", [])),
                    # Informational-only scores (e.g. the ESP32-S3's TinyML
                    # inference — see utils/scoring.py) ride along in this
                    # same blob rather than getting their own column, since
                    # they're just along for the ride for display/logging and
                    # never affect fraud_risk_score/risk_level.
                    json.dumps({
                        **fusion_result.get("modalities", {}),
                        **fusion_result.get("informational", {}),
                    }),
                ),
            )
    except Exception as exc:
        print(f"[session_log] failed to log session: {exc}")


def recent_sessions(limit: int = 50) -> list[dict]:
    """Return the most recent verdicts, newest first."""
    with _connect() as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT * FROM sessions ORDER BY id DESC LIMIT ?", (limit,)
        ).fetchall()
        return [dict(r) for r in rows]
