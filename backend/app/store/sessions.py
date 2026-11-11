"""Session, attempt and badge persistence (SPEC 5.8)."""

from __future__ import annotations

import json
import secrets
from dataclasses import dataclass
from datetime import datetime, timezone

from app.generator.build import GroundTruth
from app.schemas import BriefInfo
from app.store.db import db

SESSION_ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789"


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_z(moment: datetime) -> str:
    """RFC 3339 with a Z suffix, the way the contract shows timestamps."""
    return moment.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def new_session_id() -> str:
    return "ses_" + "".join(secrets.choice(SESSION_ID_ALPHABET) for _ in range(6))


def new_seed() -> str:
    return secrets.token_hex(4)


@dataclass(frozen=True)
class SessionRecord:
    id: str
    seed: str
    candidate_name: str
    ground_truth: GroundTruth
    dataset_hash: str
    brief: BriefInfo
    created_at: datetime
    solved_at: datetime | None


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value)


def create_session(
    *,
    seed: str,
    candidate_name: str,
    ground_truth: GroundTruth,
    dataset_hash: str,
    brief: BriefInfo,
) -> SessionRecord:
    session_id = new_session_id()
    created_at = utc_now()
    with db() as conn:
        conn.execute(
            """INSERT INTO sessions
                   (id, seed, candidate_name, ground_truth_json, dataset_hash,
                    brief_json, created_at, solved_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, NULL)""",
            (
                session_id,
                seed,
                candidate_name,
                json.dumps(ground_truth.as_dict()),
                dataset_hash,
                json.dumps(brief.model_dump(by_alias=True)),
                created_at.isoformat(),
            ),
        )
    return SessionRecord(
        id=session_id,
        seed=seed,
        candidate_name=candidate_name,
        ground_truth=ground_truth,
        dataset_hash=dataset_hash,
        brief=brief,
        created_at=created_at,
        solved_at=None,
    )


def get_session(session_id: str) -> SessionRecord | None:
    with db() as conn:
        row = conn.execute(
            "SELECT * FROM sessions WHERE id = ?", (session_id,)
        ).fetchone()
    if row is None:
        return None
    return SessionRecord(
        id=row["id"],
        seed=row["seed"],
        candidate_name=row["candidate_name"],
        ground_truth=GroundTruth.from_dict(json.loads(row["ground_truth_json"])),
        dataset_hash=row["dataset_hash"],
        brief=BriefInfo.model_validate(json.loads(row["brief_json"])),
        created_at=_parse_dt(row["created_at"]),  # type: ignore[arg-type]
        solved_at=_parse_dt(row["solved_at"]),
    )


def attempt_count(session_id: str) -> int:
    with db() as conn:
        row = conn.execute(
            "SELECT COUNT(*) AS n FROM attempts WHERE session_id = ?", (session_id,)
        ).fetchone()
    return int(row["n"])


def hints_used(session_id: str) -> int:
    with db() as conn:
        row = conn.execute(
            "SELECT COUNT(*) AS n FROM attempts WHERE session_id = ? AND hint_level IS NOT NULL",
            (session_id,),
        ).fetchone()
    return int(row["n"])


def record_attempt(
    *,
    session_id: str,
    attempt_no: int,
    submitted: dict,
    field_status: dict,
    hint_level: int | None,
    hint_source: str | None,
) -> None:
    with db() as conn:
        conn.execute(
            """INSERT INTO attempts
                   (session_id, attempt_no, submitted_json, field_status_json,
                    hint_level, hint_source, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                session_id,
                attempt_no,
                json.dumps(submitted),
                json.dumps(field_status),
                hint_level,
                hint_source,
                utc_now().isoformat(),
            ),
        )


def mark_solved(session_id: str, when: datetime) -> None:
    with db() as conn:
        conn.execute(
            "UPDATE sessions SET solved_at = ? WHERE id = ?",
            (when.isoformat(), session_id),
        )


def save_badge(
    *,
    badge_id: str,
    session_id: str,
    dataset_hash: str,
    seed: str,
    credential_json: str,
) -> None:
    with db() as conn:
        conn.execute(
            """INSERT OR REPLACE INTO badges
                   (id, session_id, dataset_hash, seed, credential_json, issued_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                badge_id,
                session_id,
                dataset_hash,
                seed,
                credential_json,
                utc_now().isoformat(),
            ),
        )


def badge_for_session(session_id: str) -> dict | None:
    import json as _json

    with db() as conn:
        row = conn.execute(
            "SELECT credential_json FROM badges WHERE session_id = ? ORDER BY issued_at DESC LIMIT 1",
            (session_id,),
        ).fetchone()
    return _json.loads(row["credential_json"]) if row else None


def badge_seeds_for_hash(dataset_hash: str) -> list[str]:
    """Seeds of every badge issued against this dataset hash (used by verification)."""
    with db() as conn:
        rows = conn.execute(
            "SELECT DISTINCT seed FROM badges WHERE dataset_hash = ?", (dataset_hash,)
        ).fetchall()
    return [r["seed"] for r in rows]
