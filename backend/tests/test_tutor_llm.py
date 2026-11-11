"""The LLM layer: Meta Model API primary, optional fallback, templates underneath.

Everything must still work with no keys set.
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.config import get_settings
from app.generator.brief import TEMPLATE_BODY, get_brief, template_brief
from app.generator.build import generate
from app.schemas import FieldStatusMap
from app.store.sessions import SessionRecord
from app.tutor import llm as llm_module
from app.tutor import templates
from app.tutor.guard import is_safe
from app.tutor.tutor import build_hint

DEMO = generate("demo")
STATUS = FieldStatusMap(
    discrepancy_ngn="incorrect", missing_tx_id="incorrect", duplicate_wb_id="correct"
)
PRIMARY = "openai/muse-spark-1.1"
FALLBACK = "openai/featherless-fallback-7b"


def _session() -> SessionRecord:
    return SessionRecord(
        id="ses_llm001",
        seed="demo",
        candidate_name="Ada Okafor",
        ground_truth=DEMO.ground_truth,
        dataset_hash=DEMO.dataset_hash,
        brief=template_brief(),
        created_at=datetime.now(timezone.utc),
        solved_at=None,
    )


@pytest.fixture(autouse=True)
def _clean_llm_state(monkeypatch):
    """Each test starts with no provider configured and a fresh probe."""
    settings = get_settings()
    for field, value in (
        ("llm_model", PRIMARY),
        ("llm_api_base", "https://api.meta.ai/v1"),
        ("llm_api_key", ""),
        ("llm_reasoning_effort", "minimal"),
        ("llm_fallback_model", ""),
        ("llm_fallback_api_base", "https://api.featherless.ai/v1"),
        ("llm_fallback_api_key", ""),
        ("llm_timeout_s", 5.0),
    ):
        monkeypatch.setattr(settings, field, value, raising=False)
    monkeypatch.setattr(llm_module, "_reasoning_effort_supported", True, raising=False)
    llm_module.reset_probe()
    yield
    llm_module.reset_probe()


@pytest.fixture
def primary(monkeypatch):
    monkeypatch.setattr(get_settings(), "llm_api_key", "meta-test-key", raising=False)
    return get_settings()


@pytest.fixture
def with_fallback(monkeypatch, primary):
    monkeypatch.setattr(get_settings(), "llm_fallback_model", FALLBACK, raising=False)
    monkeypatch.setattr(
        get_settings(), "llm_fallback_api_key", "feather-test-key", raising=False
    )
    return get_settings()


def fake_completion(behaviour, calls):
    """`behaviour` maps model -> str (reply) or Exception (raise)."""

    def _call(**kwargs):
        calls.append(kwargs)
        outcome = behaviour(kwargs) if callable(behaviour) else behaviour[kwargs["model"]]
        if isinstance(outcome, Exception):
            raise outcome
        return {"choices": [{"message": {"content": outcome}}]}

    return _call


def install(monkeypatch, behaviour, calls):
    import litellm

    monkeypatch.setattr(litellm, "completion", fake_completion(behaviour, calls))


# ------------------------------------------------------------------ no keys at all


def test_no_provider_configured_means_template_hints():
    assert get_settings().llm_available is False
    hint = build_hint(
        session=_session(), field_status=STATUS, diagnostics=None, attempt_no=1
    )
    assert hint.source == "template"
    assert hint.text == templates.template_text(1, STATUS.model_dump())


def test_no_provider_configured_keeps_the_template_brief():
    assert get_brief("demo").body_markdown == TEMPLATE_BODY


def test_no_provider_means_no_call_is_ever_attempted(monkeypatch):
    calls: list[dict] = []
    install(monkeypatch, lambda _k: "should never run", calls)
    build_hint(session=_session(), field_status=STATUS, diagnostics=None, attempt_no=1)
    assert calls == []


# ------------------------------------------------------- the primary provider call


def test_a_clean_hint_from_the_primary_is_used(primary, monkeypatch):
    calls: list[dict] = []
    install(monkeypatch, {PRIMARY: "Which ledger should every bank transfer appear in?"}, calls)
    hint = build_hint(
        session=_session(), field_status=STATUS, diagnostics=None, attempt_no=1
    )
    assert hint.source == "llm"
    assert hint.text == "Which ledger should every bank transfer appear in?"
    assert len(calls) == 1


def test_the_call_carries_api_base_key_effort_timeout_and_no_retries(primary, monkeypatch):
    calls: list[dict] = []
    install(monkeypatch, {PRIMARY: "Which table?"}, calls)
    build_hint(session=_session(), field_status=STATUS, diagnostics=None, attempt_no=1)

    kwargs = calls[0]
    assert kwargs["model"] == PRIMARY
    assert kwargs["api_base"] == "https://api.meta.ai/v1"
    assert kwargs["api_key"] == "meta-test-key"
    assert kwargs["reasoning_effort"] == "minimal"
    assert kwargs["timeout"] == get_settings().llm_timeout_s
    assert kwargs["request_timeout"] == get_settings().llm_timeout_s
    assert kwargs["num_retries"] == 0
    # Chat completions, not the Responses API.
    assert isinstance(kwargs["messages"], list)
    assert {m["role"] for m in kwargs["messages"]} <= {"system", "user", "assistant"}
    assert "input" not in kwargs


def test_a_provider_that_rejects_reasoning_effort_is_retried_without_it(
    primary, monkeypatch, caplog
):
    calls: list[dict] = []

    def behaviour(kwargs):
        if "reasoning_effort" in kwargs:
            raise Exception(
                "litellm.BadRequestError: Unrecognized request argument: reasoning_effort"
            )
        return "Which column ties a till transfer to a bank narration?"

    with caplog.at_level("WARNING"):
        install(monkeypatch, behaviour, calls)
        hint = build_hint(
            session=_session(), field_status=STATUS, diagnostics=None, attempt_no=1
        )

    assert len(calls) == 2
    assert "reasoning_effort" in calls[0]
    assert "reasoning_effort" not in calls[1]
    assert hint.source == "llm"
    assert any("rejected reasoning_effort" in r.message for r in caplog.records)

    # And the discovery sticks: later calls skip the doomed parameter.
    calls.clear()
    build_hint(session=_session(), field_status=STATUS, diagnostics=None, attempt_no=2)
    assert len(calls) == 1
    assert "reasoning_effort" not in calls[0]


def test_an_ordinary_provider_error_is_not_retried(primary, monkeypatch):
    calls: list[dict] = []
    install(monkeypatch, {PRIMARY: Exception("503 upstream unavailable")}, calls)
    hint = build_hint(
        session=_session(), field_status=STATUS, diagnostics=None, attempt_no=1
    )
    assert len(calls) == 1
    assert hint.source == "template"


def test_a_timeout_falls_back_to_the_template(primary, monkeypatch):
    calls: list[dict] = []
    install(monkeypatch, {PRIMARY: TimeoutError("too slow")}, calls)
    hint = build_hint(
        session=_session(), field_status=STATUS, diagnostics=None, attempt_no=1
    )
    assert hint.source == "template"


# ------------------------------------------------------------- the fallback provider


def test_the_fallback_is_only_tried_after_the_primary_fails(with_fallback, monkeypatch):
    calls: list[dict] = []
    install(
        monkeypatch,
        {
            PRIMARY: Exception("502 bad gateway"),
            FALLBACK: "Which table records money actually arriving?",
        },
        calls,
    )
    hint = build_hint(
        session=_session(), field_status=STATUS, diagnostics=None, attempt_no=1
    )
    assert [c["model"] for c in calls] == [PRIMARY, FALLBACK]
    assert calls[1]["api_base"] == "https://api.featherless.ai/v1"
    assert calls[1]["api_key"] == "feather-test-key"
    assert hint.source == "llm"
    assert hint.text == "Which table records money actually arriving?"


def test_the_fallback_is_skipped_when_the_primary_answers(with_fallback, monkeypatch):
    calls: list[dict] = []
    install(
        monkeypatch,
        {PRIMARY: "Which payment methods settle into a bank?", FALLBACK: "unused"},
        calls,
    )
    build_hint(session=_session(), field_status=STATUS, diagnostics=None, attempt_no=1)
    assert [c["model"] for c in calls] == [PRIMARY]


def test_both_providers_failing_lands_on_the_template(with_fallback, monkeypatch):
    calls: list[dict] = []
    install(
        monkeypatch,
        {PRIMARY: Exception("down"), FALLBACK: Exception("also down")},
        calls,
    )
    hint = build_hint(
        session=_session(), field_status=STATUS, diagnostics=None, attempt_no=2
    )
    assert [c["model"] for c in calls] == [PRIMARY, FALLBACK]
    assert hint.source == "template"
    assert hint.text == templates.template_text(2, STATUS.model_dump())


def test_an_unconfigured_fallback_is_never_called(primary, monkeypatch):
    calls: list[dict] = []
    install(monkeypatch, {PRIMARY: Exception("down")}, calls)
    build_hint(session=_session(), field_status=STATUS, diagnostics=None, attempt_no=1)
    assert [c["model"] for c in calls] == [PRIMARY]


# ------------------------------------------------------- the guard, on either model


def test_the_guard_runs_on_whichever_model_answered(with_fallback, monkeypatch):
    calls: list[dict] = []
    install(
        monkeypatch,
        {PRIMARY: Exception("down"), FALLBACK: "The gap is ₦45,000 — check POS-1042."},
        calls,
    )
    hint = build_hint(
        session=_session(), field_status=STATUS, diagnostics=None, attempt_no=1
    )
    assert hint.source == "template"
    assert is_safe(hint.text, DEMO.ground_truth)


def test_a_leak_triggers_exactly_one_stricter_retry(primary, monkeypatch):
    calls: list[dict] = []

    def behaviour(kwargs):
        return (
            "The answer is 45000 at POS-1042."
            if len(calls) == 1
            else "Which reference ties a till transfer to its credit?"
        )

    install(monkeypatch, behaviour, calls)
    hint = build_hint(
        session=_session(), field_status=STATUS, diagnostics=None, attempt_no=2
    )
    assert len(calls) == 2
    assert hint.source == "llm"
    assert is_safe(hint.text, DEMO.ground_truth)


def test_two_leaks_fall_back_to_the_template(primary, monkeypatch):
    calls: list[dict] = []
    install(monkeypatch, {PRIMARY: "It is 45000, see POS-1042."}, calls)
    hint = build_hint(
        session=_session(), field_status=STATUS, diagnostics=None, attempt_no=3
    )
    assert len(calls) == 2  # one stricter retry, no more
    assert hint.source == "template"


def test_the_model_is_logged_but_never_returned(primary, monkeypatch, caplog):
    calls: list[dict] = []
    install(monkeypatch, {PRIMARY: "Which ledger shows money arriving?"}, calls)
    with caplog.at_level("INFO"):
        hint = build_hint(
            session=_session(), field_status=STATUS, diagnostics=None, attempt_no=1
        )
    logged = [r.getMessage() for r in caplog.records]
    assert any(f"model={PRIMARY}" in line for line in logged), logged
    assert set(hint.model_dump()) == {"level", "text", "source"}
    assert PRIMARY not in hint.model_dump_json()


def test_the_prompt_never_contains_free_candidate_text(primary, monkeypatch):
    calls: list[dict] = []
    install(monkeypatch, {PRIMARY: "Which table?"}, calls)
    build_hint(session=_session(), field_status=STATUS, diagnostics=None, attempt_no=1)
    prompt = calls[0]["messages"][1]["content"]
    assert "<submission>" in prompt and "</submission>" in prompt
    assert "Ada Okafor" not in prompt


# ------------------------------------------------------------------------- the brief


def test_the_brief_uses_the_llm_when_it_is_clean(primary, monkeypatch):
    calls: list[dict] = []
    body = " ".join(["The October books close on Friday and auditors flagged two issues."] * 14)
    install(monkeypatch, {PRIMARY: body}, calls)
    brief = get_brief("demo")

    from app.generator.brief import DISCREPANCY_DEFINITION, TASK_DEFINITIONS

    assert body.split(".")[0] in brief.body_markdown
    assert brief.body_markdown.endswith(DISCREPANCY_DEFINITION)
    assert brief.task_definitions == TASK_DEFINITIONS


def test_a_leaking_brief_is_discarded(primary, monkeypatch):
    calls: list[dict] = []
    body = " ".join(["Find the missing ₦45,000 transfer from the till today please."] * 14)
    install(monkeypatch, {PRIMARY: body}, calls)
    assert get_brief("demo").body_markdown == TEMPLATE_BODY


def test_a_too_short_brief_is_discarded(primary, monkeypatch):
    calls: list[dict] = []
    install(monkeypatch, {PRIMARY: "Too short."}, calls)
    assert get_brief("demo").body_markdown == TEMPLATE_BODY


def test_the_brief_is_cached_per_seed(primary, monkeypatch):
    calls: list[dict] = []
    body = " ".join(["We are closing the October books for head office this week."] * 14)
    install(monkeypatch, {PRIMARY: body}, calls)
    assert get_brief("cache-me") == get_brief("cache-me")
    assert len(calls) == 1  # the second came from SQLite


def test_the_brief_can_come_from_the_fallback(with_fallback, monkeypatch):
    calls: list[dict] = []
    body = " ".join(["Head office wants the October reconciliation closed by Friday."] * 14)
    install(monkeypatch, {PRIMARY: Exception("down"), FALLBACK: body}, calls)
    assert body.split(".")[0] in get_brief("fallback-seed").body_markdown


# -------------------------------------------------------------------------- /health


def test_health_is_fallback_before_any_probe_runs(client):
    assert client.get("/health").json() == {"ok": True, "llm": "fallback"}


def test_health_is_fallback_when_the_probe_fails(primary, monkeypatch, client):
    calls: list[dict] = []
    install(monkeypatch, {PRIMARY: Exception("401 unauthorized")}, calls)
    assert llm_module.probe_primary() is False
    assert len(calls) == 1
    assert client.get("/health").json() == {"ok": True, "llm": "fallback"}


def test_health_is_up_only_after_a_real_call_succeeds(primary, monkeypatch, client):
    calls: list[dict] = []
    install(monkeypatch, {PRIMARY: "pong"}, calls)
    assert llm_module.probe_primary() is True
    assert calls[0]["max_tokens"] == 1
    assert calls[0]["model"] == PRIMARY
    assert client.get("/health").json() == {"ok": True, "llm": "up"}


def test_the_probe_does_not_run_without_a_key(monkeypatch):
    calls: list[dict] = []
    install(monkeypatch, lambda _k: "never", calls)
    assert llm_module.probe_primary() is False
    assert calls == []


def test_the_probe_survives_a_provider_that_dislikes_reasoning_effort(
    primary, monkeypatch, client
):
    """Rejecting the parameter is not the same as being down."""
    calls: list[dict] = []

    def behaviour(kwargs):
        if "reasoning_effort" in kwargs:
            raise Exception("Unrecognized request argument supplied: reasoning_effort")
        return "pong"

    install(monkeypatch, behaviour, calls)
    assert llm_module.probe_primary() is True
    assert len(calls) == 2
    assert client.get("/health").json() == {"ok": True, "llm": "up"}

    # The hint path then skips the parameter from the start.
    calls.clear()
    build_hint(session=_session(), field_status=STATUS, diagnostics=None, attempt_no=1)
    assert len(calls) == 1 and "reasoning_effort" not in calls[0]
