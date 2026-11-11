"""LiteLLM calls for the tutor and the brief (SPEC 5.7).

Provider order is primary -> optional fallback -> hand-written template. Every call is
a plain chat completion (never the Responses API) with `api_base`, `api_key` and
`reasoning_effort` passed explicitly, a hard `LLM_TIMEOUT_S` deadline and no internal
retries. Nothing here can change a grade.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from app.config import get_settings
from app.grading.grade import Diagnostics
from app.store.sessions import SessionRecord
from app.tutor.guard import leaks
from app.tutor.prompt import STRICTER_REMINDER, SYSTEM_RULES, hint_user_prompt

log = logging.getLogger("reconcore.llm")

MAX_HINT_CHARS = 400

# Flipped off permanently the first time a provider rejects `reasoning_effort`, so we
# pay for that discovery once rather than on every call.
_reasoning_effort_supported = True

# Result of the startup probe: None = not run, True/False = a real call succeeded/failed.
_probe_result: bool | None = None


@dataclass(frozen=True)
class Target:
    role: str  # "primary" | "fallback"
    model: str
    api_base: str
    api_key: str


@dataclass(frozen=True)
class Reply:
    text: str
    model: str


def targets() -> list[Target]:
    settings = get_settings()
    out: list[Target] = []
    if settings.primary_llm_configured:
        out.append(
            Target("primary", settings.llm_model, settings.llm_api_base, settings.llm_api_key)
        )
    if settings.fallback_llm_configured:
        out.append(
            Target(
                "fallback",
                settings.llm_fallback_model,
                settings.llm_fallback_api_base,
                settings.llm_fallback_api_key,
            )
        )
    return out


def _rejects_reasoning_effort(exc: Exception) -> bool:
    message = str(exc).lower()
    return "reasoning_effort" in message or (
        "reasoning" in message and ("unsupported" in message or "unknown" in message)
    )


def _call_once(
    target: Target, messages: list[dict], *, max_tokens: int, with_effort: bool
) -> str | None:
    """Raises on provider failure; returns None only when the reply is empty."""
    import litellm

    settings = get_settings()
    kwargs = {
        "model": target.model,
        "messages": messages,
        "api_base": target.api_base or None,
        "api_key": target.api_key,
        "timeout": settings.llm_timeout_s,
        "request_timeout": settings.llm_timeout_s,
        "max_tokens": max_tokens,
        "temperature": 0.5,
        # LiteLLM retries internally by default, which blows straight through our
        # deadline. One attempt per model, then the next target.
        "num_retries": 0,
    }
    if with_effort and settings.llm_reasoning_effort:
        kwargs["reasoning_effort"] = settings.llm_reasoning_effort

    response = litellm.completion(**kwargs)
    text = response["choices"][0]["message"]["content"]
    return text.strip() if isinstance(text, str) and text.strip() else None


def _call(target: Target, messages: list[dict], *, max_tokens: int) -> str | None:
    """One model, with a single retry if it rejects `reasoning_effort`."""
    global _reasoning_effort_supported

    send_effort = _reasoning_effort_supported
    try:
        return _call_once(target, messages, max_tokens=max_tokens, with_effort=send_effort)
    except Exception as exc:
        if send_effort and _rejects_reasoning_effort(exc):
            log.warning(
                "%s (%s) rejected reasoning_effort=%s; retrying without it and "
                "dropping it for the rest of this process",
                target.role,
                target.model,
                get_settings().llm_reasoning_effort,
            )
            _reasoning_effort_supported = False
            try:
                return _call_once(
                    target, messages, max_tokens=max_tokens, with_effort=False
                )
            except Exception as retry_exc:
                log.warning(
                    "%s (%s) failed without reasoning_effort too: %s",
                    target.role,
                    target.model,
                    retry_exc,
                )
                return None
        log.warning("%s (%s) call failed: %s", target.role, target.model, exc)
        return None


def complete(messages: list[dict], *, max_tokens: int = 160) -> Reply | None:
    """Primary, then the fallback if one is configured. None means use the template."""
    for target in targets():
        text = _call(target, messages, max_tokens=max_tokens)
        if text is not None:
            return Reply(text=text, model=target.model)
    return None


def probe_primary() -> bool:
    """A tiny real call, run once at startup, so /health reports what actually works.

    Takes the same reasoning_effort retry as a real hint, so a provider that simply
    dislikes that parameter is reported as up rather than as broken.
    """
    global _probe_result, _reasoning_effort_supported
    settings = get_settings()
    if not settings.primary_llm_configured:
        _probe_result = False
        return False

    target = targets()[0]
    message = [{"role": "user", "content": "ping"}]
    attempts = [True, False] if _reasoning_effort_supported else [False]

    for with_effort in attempts:
        try:
            _call_once(target, message, max_tokens=1, with_effort=with_effort)
            _probe_result = True
            log.info("LLM health probe succeeded against %s", target.model)
            return True
        except Exception as exc:
            if with_effort and _rejects_reasoning_effort(exc):
                log.warning(
                    "%s (%s) rejected reasoning_effort=%s during the health probe; "
                    "dropping it for the rest of this process",
                    target.role,
                    target.model,
                    settings.llm_reasoning_effort,
                )
                _reasoning_effort_supported = False
                continue
            _probe_result = False
            log.warning(
                "LLM health probe failed against %s (%s); /health will report fallback",
                target.model,
                exc,
            )
            return False

    _probe_result = False
    return False


def llm_is_up() -> bool:
    """True only once a real call to the primary model has succeeded."""
    return _probe_result is True


def reset_probe() -> None:
    global _probe_result
    _probe_result = None


def _tidy(text: str) -> str:
    cleaned = " ".join(text.replace("\n", " ").split()).strip().strip('"').strip()
    return cleaned[:MAX_HINT_CHARS]


def llm_hint_text(
    *,
    session: SessionRecord,
    status: dict,
    diagnostics: Diagnostics | None,
    level: int,
) -> tuple[str, str] | None:
    """Returns (hint text, model that wrote it), or None to use the template."""
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
    text = _tidy(first.text)
    if leaks(text, truth) is None:
        log.info("tutor hint drafted by model=%s (level %s)", first.model, level)
        return text, first.model

    log.warning(
        "tutor draft from model=%s leaked the answer; retrying once with a stricter "
        "reminder",
        first.model,
    )
    messages += [
        {"role": "assistant", "content": text},
        {"role": "system", "content": STRICTER_REMINDER},
    ]
    second = complete(messages)
    if second is None:
        return None
    retried = _tidy(second.text)
    if leaks(retried, truth) is not None:
        return None
    log.info("tutor hint drafted by model=%s after a stricter retry", second.model)
    return retried, second.model
