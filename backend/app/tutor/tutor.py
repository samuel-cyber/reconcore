"""Socratic tutor (SPEC 5.7).

The LLM only ever writes prose. If it is slow, missing, or leaks a single digit of the
answer, the matching rung of the hand-written ladder is used instead. The hint source is
reported honestly to the client as "llm" or "template".
"""

from __future__ import annotations

import logging

from app.grading.grade import Diagnostics
from app.schemas import FieldStatusMap, TutorHint
from app.store.sessions import SessionRecord
from app.tutor import templates
from app.tutor.guard import leaks

log = logging.getLogger("reconcore.tutor")


def build_hint(
    *,
    session: SessionRecord,
    field_status: FieldStatusMap,
    diagnostics: Diagnostics | None,
    attempt_no: int,
    invalid_amount: bool = False,
) -> TutorHint:
    level = templates.clamp_level(attempt_no)
    status = field_status.model_dump()

    if invalid_amount:
        return TutorHint(
            level=level, text=templates.INVALID_AMOUNT_HINT, source="template"
        )

    fallback = TutorHint(
        level=level, text=templates.template_text(level, status), source="template"
    )

    text = _llm_hint(
        session=session, status=status, diagnostics=diagnostics, level=level
    )
    if text is None:
        return fallback

    offending = leaks(text, session.ground_truth)
    if offending is not None:
        log.warning(
            "tutor output blocked by the leak guard (session %s, level %s)",
            session.id,
            level,
        )
        return fallback

    return TutorHint(level=level, text=text, source="llm")


def _llm_hint(
    *,
    session: SessionRecord,
    status: dict,
    diagnostics: Diagnostics | None,
    level: int,
) -> str | None:
    """Returns LLM prose, or None to use the template (no key, timeout, leak, error)."""
    try:
        from app.tutor.llm import llm_hint_text

        return llm_hint_text(
            session=session, status=status, diagnostics=diagnostics, level=level
        )
    except Exception as exc:  # pragma: no cover - any failure means templates
        log.warning("tutor fell back to the template: %s", exc)
        return None
