"""Session endpoints: init, CSV downloads, submit (SPEC 4)."""

from __future__ import annotations

import io
import zipfile

from fastapi import APIRouter, Response

from app.core.errors import ApiError
from app.generator import scenario as sc
from app.generator.brief import get_brief
from app.generator.build import load_dataset
from app.grading.grade import grade
from app.grading.normalise import is_valid_id, normalise_id, try_parse_naira
from app.schemas import (
    FieldStatusMap,
    ScenarioInfo,
    SessionInitRequest,
    SessionInitResponse,
    SessionTables,
    SolveSummary,
    SubmitRequest,
    SubmitResponse,
    TableData,
)
from app.store import sessions as store
from app.tutor.tutor import build_hint

router = APIRouter(prefix="/api/session", tags=["session"])

MAX_HINT_LEVEL = 3


@router.post("/init", response_model=SessionInitResponse)
def init_session(payload: SessionInitRequest) -> SessionInitResponse:
    seed = (payload.seed or "").strip() or store.new_seed()
    candidate_name = payload.candidate_name.strip()
    if not candidate_name:
        raise ApiError("invalid_input", "candidate_name must not be blank.", 422)

    dataset = load_dataset(seed)
    brief = get_brief(seed)
    session = store.create_session(
        seed=seed,
        candidate_name=candidate_name,
        ground_truth=dataset.ground_truth,
        dataset_hash=dataset.dataset_hash,
        brief=brief,
    )

    return SessionInitResponse(
        session_id=session.id,
        scenario=ScenarioInfo(id=sc.SCENARIO_ID, title=sc.SCENARIO_TITLE),
        brief=brief,
        tables=SessionTables(
            **{
                key: TableData(
                    filename=table.filename, columns=table.columns, rows=table.rows
                )
                for key, table in dataset.tables.items()
            }
        ),
        dataset_hash=dataset.dataset_hash,
        max_hint_level=MAX_HINT_LEVEL,
    )


# --------------------------------------------------------------------------- CSVs


def _session_or_404(session_id: str) -> store.SessionRecord:
    session = store.get_session(session_id)
    if session is None:
        raise ApiError("session_not_found", "No such session.", 404)
    return session


@router.get("/{session_id}/csv/{table}", response_class=Response)
def download_table_csv(session_id: str, table: str) -> Response:
    session = _session_or_404(session_id)
    if table not in sc.TABLE_FILENAMES:
        raise ApiError(
            "invalid_table", "Table must be one of: pos, waybills, bank.", 404
        )
    dataset = load_dataset(session.seed)
    return Response(
        content=dataset.canonical_csv[table],
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{sc.TABLE_FILENAMES[table]}"',
            "X-Dataset-Hash": dataset.dataset_hash,
        },
    )


@router.get("/{session_id}/csv.zip", response_class=Response)
def download_all_csvs(session_id: str) -> Response:
    session = _session_or_404(session_id)
    dataset = load_dataset(session.seed)

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for key in ("pos", "waybills", "bank"):
            # Exactly the bytes the dataset hash was computed over.
            archive.writestr(sc.TABLE_FILENAMES[key], dataset.canonical_csv[key])

    filename = f"reconcore_{session_id}_csvs.zip"
    return Response(
        content=buffer.getvalue(),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Dataset-Hash": dataset.dataset_hash,
        },
    )


# ------------------------------------------------------------------------- submit


@router.post("/submit", response_model=SubmitResponse)
def submit(payload: SubmitRequest) -> SubmitResponse:
    session = _session_or_404(payload.session_id)

    tx_id = normalise_id(payload.missing_tx_id)
    wb_id = normalise_id(payload.duplicate_wb_id)
    if not is_valid_id(tx_id) or not is_valid_id(wb_id):
        raise ApiError(
            "invalid_input",
            "Transaction and waybill IDs must be 1–20 letters, digits or hyphens "
            "(e.g. POS-1042, WB-3311).",
            422,
        )

    if session.solved_at is not None:
        raise ApiError(
            "already_solved",
            "This session has already been solved and its credential issued.",
            409,
        )

    amount = try_parse_naira(payload.discrepancy_ngn)
    attempts_so_far = store.attempt_count(session.id)

    # An unparseable amount is not an attempt (SPEC 5.5): report it and let them retry.
    if amount is None:
        field_status = FieldStatusMap(
            discrepancy_ngn="invalid_format",
            missing_tx_id="correct"
            if tx_id == normalise_id(session.ground_truth.missing_tx_id)
            else "incorrect",
            duplicate_wb_id="correct"
            if wb_id == normalise_id(session.ground_truth.duplicate_wb_id)
            else "incorrect",
        )
        return SubmitResponse(
            passed=False,
            attempt_no=attempts_so_far,
            field_status=field_status,
            tutor_hint=build_hint(
                session=session,
                field_status=field_status,
                diagnostics=None,
                attempt_no=max(attempts_so_far, 1),
                invalid_amount=True,
            ),
            badge=None,
            summary=None,
        )

    result = grade(
        truth=session.ground_truth,
        discrepancy_ngn=amount,
        missing_tx_id=tx_id,
        duplicate_wb_id=wb_id,
    )
    attempt_no = attempts_so_far + 1
    field_status = FieldStatusMap(**result.field_status)

    hint = None
    if not result.passed:
        hint = build_hint(
            session=session,
            field_status=field_status,
            diagnostics=result.diagnostics,
            attempt_no=attempt_no,
        )

    store.record_attempt(
        session_id=session.id,
        attempt_no=attempt_no,
        submitted={
            "discrepancy_ngn": payload.discrepancy_ngn,
            "missing_tx_id": tx_id,
            "duplicate_wb_id": wb_id,
        },
        field_status=result.field_status,
        hint_level=hint.level if hint else None,
        hint_source=hint.source if hint else None,
    )

    if not result.passed:
        return SubmitResponse(
            passed=False,
            attempt_no=attempt_no,
            field_status=field_status,
            tutor_hint=hint,
            badge=None,
            summary=None,
        )

    solved_at = store.utc_now()
    store.mark_solved(session.id, solved_at)
    summary = SolveSummary(
        attempts=attempt_no,
        hints_used=store.hints_used(session.id),
        seconds_to_solve=max(
            0, int((solved_at - session.created_at).total_seconds())
        ),
    )

    from app.credentials.badge import issue_badge

    badge = issue_badge(session=session, summary=summary, issued_at=solved_at)

    return SubmitResponse(
        passed=True,
        attempt_no=attempt_no,
        field_status=field_status,
        tutor_hint=None,
        badge=badge,
        summary=summary,
    )
