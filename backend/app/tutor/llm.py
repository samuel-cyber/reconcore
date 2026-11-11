"""LiteLLM calls for the tutor (SPEC 5.7).

Hard timeout, one stricter retry when the leak guard fires, then None so the caller
falls back to the ladder template. Nothing here can change a grade.
"""

from __future__ import annotations

import logging

from app.config import get_settings
from app.grading.grade import Diagnostics
from app.store.sessions import SessionRecord
from app.tutor.guard import leaks
from app.tutor.prompt import STRICTER_REMINDER, SYSTEM_RULES, hint_user_prompt

log = logging.getLogger("reconcore.llm")

MAX_HINT_CHARS = 400


def complete(messages: list[dict], *, max_tokens: int = 160) -> str | None:
    """One LiteLLM call with a hard timeout. Returns None on any failure."""
    settings = get_settings()
    if not settings.llm_available:
        return None

    import litellm

    try:
        response = litellm.completion(
            model=settings.llm_model,
            messages=messages,
            timeout=settings.llm_timeout_s,
            request_timeout=settings.llm_timeout_s,
            max_tokens=max_tokens,
            temperature=0.5,
        )
        text = response["choices"][0]["message"]["content"]
    except Exception as exc:
        log.warning("LLM call failed (%s): %s", settings.llm_model, exc)
        return None

    return text.strip() if isinstance(text, str) and text.strip() else None


def _tidy(text: str) -> str:
    cleaned = " ".join(text.replace("\n", " ").split()).strip().strip('"').strip()
    return cleaned[:MAX_HINT_CHARS]


def llm_hint_text(
    *,
    session: SessionRecord,
    status: dict,
    diagnostics: Diagnostics | None,
    level: int,
) -> str | None:
    truth = session.ground_truth
    # SPEC 5.7 lists the ground truth as a prompt input; the leak guard below is what
    # keeps it out of the response.
    seed_facts = (
        "Internal context, strictly for your own reasoning — revealing any of it is a "
        "failure: there is exactly one unsettled transfer, and exactly one other "
        "transfer carrying the same amount that IS settled."
    )
    submitted = {
        "discrepancy_ngn": "(an amount the candidate typed)",
        "missing_tx_id": "(an ID the candidate typed)",
        "duplicate_wb_id": "(an ID the candidate typed)",
    }

    messages = [
        {"role": "system", "content": SYSTEM_RULES},
        {
            "role": "user",
            "content": hint_user_prompt(
                seed_facts=seed_facts,
                level=level,
                attempt_no=level,
                status=status,
                diagnostics=diagnostics,
                submitted=submitted,
            ),
        },
    ]

    first = complete(messages)
    if first is None:
        return None
    text = _tidy(first)
    if leaks(text, truth) is None:
        return text

    log.warning("tutor draft leaked the answer; retrying once with a stricter reminder")
    messages += [
        {"role": "assistant", "content": text},
        {"role": "system", "content": STRICTER_REMINDER},
    ]
    second = complete(messages)
    if second is None:
        return None
    retried = _tidy(second)
    return retried if leaks(retried, truth) is None else None
