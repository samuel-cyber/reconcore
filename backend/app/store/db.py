"""SQLite persistence (SPEC 5.8). Plain sqlite3, one connection per request."""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from typing import Iterator

from app.config import get_settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS sessions (
    id                TEXT PRIMARY KEY,
    seed              TEXT NOT NULL,
    candidate_name    TEXT NOT NULL,
    ground_truth_json TEXT NOT NULL,
    dataset_hash      TEXT NOT NULL,
    brief_json        TEXT NOT NULL,
    created_at        TEXT NOT NULL,
    solved_at         TEXT
);
CREATE TABLE IF NOT EXISTS attempts (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id        TEXT NOT NULL,
    attempt_no        INTEGER NOT NULL,
    submitted_json    TEXT NOT NULL,
    field_status_json TEXT NOT NULL,
    hint_level        INTEGER,
    hint_source       TEXT,
    created_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attempts_session ON attempts(session_id);
CREATE TABLE IF NOT EXISTS badges (
    id              TEXT PRIMARY KEY,
    session_id      TEXT NOT NULL,
    dataset_hash    TEXT NOT NULL,
    seed            TEXT NOT NULL,
    credential_json TEXT NOT NULL,
    issued_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_badges_hash ON badges(dataset_hash);
CREATE TABLE IF NOT EXISTS brief_cache (
    seed       TEXT PRIMARY KEY,
    brief_json TEXT NOT NULL
);
"""


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(get_settings().db_path, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


@contextmanager
def db() -> Iterator[sqlite3.Connection]:
    conn = connect()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with db() as conn:
        conn.executescript(SCHEMA)
