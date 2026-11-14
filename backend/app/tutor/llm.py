"""LiteLLM calls for the tutor and the brief (SPEC 5.7).

Provider order is primary -> optional fallback -> hand-written template. Every call is
a plain chat completion (never the Responses API) with `api_base`, `api_key` and
`reasoning_effort` passed explicitly, a hard `LLM_TIMEOUT_S` deadline and no internal
retries. Nothing here can change a grade.

Muse Spark is a reasoning model: even at `reasoning_effort=minimal` it spends a few
hundred tokens thinking before it writes a word. A small `max_tokens` therefore starves
the answer (empty content, or a provider error), so by default we send no cap at all and
trim the reply ourselves. We also send no `temperature`, which reasoning models commonly
reject. The last real outcome is kept so `/health` can say *why* it reports fallback.
"""

from __future__ import annotations

import logging
import time
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

# Outcome of the most recent real call to the primary model (the startup probe is one
# such call): None = no call yet, True/False = it succeeded/failed.
_probe_result: bool | None = None
_last_reason: str = "no call made yet"


class EmptyReply(RuntimeError):
    """The provider answered but the message had no text (usually a starved budget)."""


def _scrub(text: object) -> str:
    """An error message that is safe to log and to show in /health: no keys, one line."""
    settings = get_settings()
    out = " ".join(str(text).split())
    for secret in (settings.llm_api_key, settings.llm_fallback_api_key):
        if secret:
            out = out.replace(secret, "***")
    return out[:240]


def _record(target: "Target", ok: bool, reason: str = "") -> None:
    """Only the primary drives /health; the fallback is a courtesy."""
    global _probe_result, _last_reason
    if target.role != "primary":
        return
    _probe_result = ok
    _last_reason = "ok" if ok else (reason or "unknown error")


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
    target: Target,
    messages: list[dict],
    *,
    with_effort: bool,
    timeout: float | None = None,
) -> str:
    """One request. Raises on provider failure and on an empty reply."""
    import litellm

    settings = get_settings()
    deadline = timeout if timeout is not None else settings.llm_timeout_s
    kwargs = {
        "model": target.model,
        "messages": messages,
        "api_base": target.api_base or None,
        "api_key": target.api_key,
        "timeout": deadline,
        "request_timeout": deadline,
        # LiteLLM retries internally by default, which blows straight through our
        # deadline. One attempt per model, then the next target.
        "num_retries": 0,
    }
    # No cap unless one is configured: reasoning tokens count against it.
    if settings.llm_max_tokens > 0:
        kwargs["max_tokens"] = settings.llm_max_tokens
    if with_effort and settings.llm_reasoning_effort:
        kwargs["reasoning_effort"] = settings.llm_reasoning_effort

    response = litellm.completion(**kwargs)
    choice = response["choices"][0]
    text = choice["message"]["content"]
    if not (isinstance(text, str) and text.strip()):
        finish = choice.get("finish_reason") if hasattr(choice, "get") else None
        raise EmptyReply(f"model returned no text (finish_reason={finish})")
    return text.strip()


def _call(
    target: Target, messages: list[dict], *, timeout: float | None = None
) -> str | None:
    """One model, with a single retry if it rejects `reasoning_effort`."""
    global _reasoning_effort_supported

    send_effort = _reasoning_effort_supported
    try:
        text = _call_once(target, messages, with_effort=send_effort, timeout=timeout)
        _record(target, True)
        return text
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
                text = _call_once(target, messages, with_effort=False, timeout=timeout)
                _record(target, True)
                return text
            except Exception as retry_exc:
                reason = f"{type(retry_exc).__name__}: {_scrub(retry_exc)}"
                log.warning(
                    "%s (%s) failed without reasoning_effort too: %s",
                    target.role,
                    target.model,
                    reason,
                )
                _record(target, False, reason)
                return None
        reason = f"{type(exc).__name__}: {_scrub(exc)}"
        log.warning("%s (%s) call failed: %s", target.role, target.model, reason)
        _record(target, False, reason)
        return None


def complete(messages: list[dict], *, timeout: float | None = None) -> Reply | None:
    """Primary, then the fallback if one is configured. None means use the template."""
    for target in targets():
        text = _call(target, messages, timeout=timeout)
        if text is not None:
            return Reply(text=text, model=target.model)
    return None


def probe_primary() -> bool:
    """A small real call, run once at startup, so /health reports what actually works.

    It goes through exactly the same code path and parameters as a real hint, so a
    green probe means hints will work and a red one carries the real reason.
    """
    global _probe_result, _last_reason
    settings = get_settings()
    if not settings.primary_llm_configured:
        _probe_result = False
        _last_reason = "LLM_API_KEY is not set"
        return False

    target = targets()[0]
    started = time.monotonic()
    text = _call(target, [{"role": "user", "content": "Reply with the single word: ok"}])
    elapsed = time.monotonic() - started
    if text is None:
        log.warning(
            "LLM health probe failed against %s after %.1fs (%s); /health will report "
            "fallback until a real call succeeds",
            target.model,
            elapsed,
            _last_reason,
        )
        return False
    log.info("LLM health probe succeeded against %s in %.1fs", target.model, elapsed)
    return True


def llm_is_up() -> bool:
    """True when the most recent real call to the primary model succeeded."""
    return _probe_result is True


def llm_reason() -> str:
    """Why /health says what it says. Never contains a key."""
    if not get_settings().primary_llm_configured:
        return "LLM_API_KEY is not set"
    return _last_reason


def reset_probe() -> None:
    global _probe_result, _last_reason
    _probe_result = None
    _last_reason = "no call made yet"


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

    budget = get_settings().llm_timeout_s
    started = time.monotonic()
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
    # The retry only gets whatever is left of the budget; a candidate should never wait
    # two full timeouts for one hint.
    remaining = budget - (time.monotonic() - started)
    if remaining < 2:
        return None
    second = complete(messages, timeout=remaining)
    if second is None:
        return None
    retried = _tidy(second.text)
    if leaks(retried, truth) is not None:
        return None
    log.info("tutor hint drafted by model=%s after a stricter retry", second.model)
    return retried, second.model
