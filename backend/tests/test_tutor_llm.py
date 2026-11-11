"""Phase 6: the LLM layer. Everything must still work with no API key set."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.config import get_settings
from app.generator.brief import TEMPLATE_BODY, get_brief, template_brief
from app.generator.build import generate
from app.schemas import FieldStatusMap
from app.store.sessions import SessionRecord
from app.tutor import templates
from app.tutor.guard import is_safe
from app.tutor.tutor import build_hint

DEMO = generate("demo")
STATUS = FieldStatusMap(
    discrepancy_ngn="incorrect", missing_tx_id="incorrect", duplicate_wb_id="correct"
)


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


@pytest.fixture
def with_key(monkeypatch):
    monkeypatch.setattr(get_settings(), "gemini_api_key", "test-key", raising=False)
    monkeypatch.setattr(get_settings(), "llm_timeout_s", 1.0, raising=False)
    return get_settings()


def _fake_completion(text, *, calls=None):
    def _call(**kwargs):
        if calls is not None:
            calls.append(kwargs)
        value = text(len(calls or [])) if callable(text) else text
        return {"choices": [{"message": {"content": value}}]}

    return _call


def test_no_api_key_means_template_hints(monkeypatch):
    monkeypatch.setattr(get_settings(), "gemini_api_key", "", raising=False)
    monkeypatch.setattr(get_settings(), "openai_api_key", "", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)

    hint = build_hint(
        session=_session(), field_status=STATUS, diagnostics=None, attempt_no=1
    )
    assert hint.source == "template"
    assert hint.text == templates.template_text(1, STATUS.model_dump())


def test_a_clean_llm_hint_is_used(with_key, monkeypatch):
    import litellm

    monkeypatch.setattr(
        litellm,
        "completion",
        _fake_completion("Which ledger should every bank transfer appear in?"),
    )
    hint = build_hint(
        session=_session(), field_status=STATUS, diagnostics=None, attempt_no=1
    )
    assert hint.source == "llm"
    assert hint.text == "Which ledger should every bank transfer appear in?"


def test_a_leak_triggers_exactly_one_retry_then_is_kept_if_clean(with_key, monkeypatch):
    import litellm

    calls: list[dict] = []
    monkeypatch.setattr(
        litellm,
        "completion",
        _fake_completion(
            lambda n: "The answer is ₦45,000 on POS-1042."
            if n == 1
            else "Which column links a till transfer to a bank narration?",
            calls=calls,
        ),
    )
    hint = build_hint(
        session=_session(), field_status=STATUS, diagnostics=None, attempt_no=2
    )
    assert len(calls) == 2
    assert hint.source == "llm"
    assert is_safe(hint.text, DEMO.ground_truth)


def test_two_leaks_fall_back_to_the_template(with_key, monkeypatch):
    import litellm

    calls: list[dict] = []
    monkeypatch.setattr(
        litellm, "completion", _fake_completion("It is 45000, see POS-1042.", calls=calls)
    )
    hint = build_hint(
        session=_session(), field_status=STATUS, diagnostics=None, attempt_no=3
    )
    assert len(calls) == 2  # one retry, no more
    assert hint.source == "template"
    assert hint.text == templates.template_text(3, STATUS.model_dump())


def test_a_timeout_falls_back_to_the_template(with_key, monkeypatch):
    import litellm

    def _boom(**_kwargs):
        raise TimeoutError("too slow")

    monkeypatch.setattr(litellm, "completion", _boom)
    hint = build_hint(
        session=_session(), field_status=STATUS, diagnostics=None, attempt_no=1
    )
    assert hint.source == "template"


def test_the_timeout_is_actually_passed_to_litellm(with_key, monkeypatch):
    import litellm

    calls: list[dict] = []
    monkeypatch.setattr(litellm, "completion", _fake_completion("Which table?", calls=calls))
    build_hint(session=_session(), field_status=STATUS, diagnostics=None, attempt_no=1)
    assert calls[0]["timeout"] == get_settings().llm_timeout_s
    assert calls[0]["model"] == get_settings().llm_model


def test_the_prompt_never_contains_free_candidate_text(with_key, monkeypatch):
    """Only regex-constrained values reach the model, inside <submission> tags."""
    import litellm

    calls: list[dict] = []
    monkeypatch.setattr(litellm, "completion", _fake_completion("Which table?", calls=calls))
    build_hint(session=_session(), field_status=STATUS, diagnostics=None, attempt_no=1)
    prompt = calls[0]["messages"][1]["content"]
    assert "<submission>" in prompt and "</submission>" in prompt
    assert "Ada Okafor" not in prompt
    assert "duplicate_wb_id" in prompt


def test_the_brief_uses_the_llm_when_it_is_clean(with_key, monkeypatch):
    import litellm

    body = " ".join(["The October books close on Friday and auditors flagged two issues."] * 14)
    monkeypatch.setattr(litellm, "completion", _fake_completion(body))
    brief = get_brief("demo")
    assert body.split(".")[0] in brief.body_markdown
    # The definition and the task list are ours, never the model's.
    from app.generator.brief import DISCREPANCY_DEFINITION, TASK_DEFINITIONS

    assert brief.body_markdown.endswith(DISCREPANCY_DEFINITION)
    assert brief.task_definitions == TASK_DEFINITIONS


def test_a_leaking_brief_is_discarded(with_key, monkeypatch):
    import litellm

    body = " ".join(["Find the missing ₦45,000 transfer from the till today please."] * 14)
    monkeypatch.setattr(litellm, "completion", _fake_completion(body))
    assert get_brief("demo").body_markdown == TEMPLATE_BODY


def test_a_too_short_brief_is_discarded(with_key, monkeypatch):
    import litellm

    monkeypatch.setattr(litellm, "completion", _fake_completion("Too short."))
    assert get_brief("demo").body_markdown == TEMPLATE_BODY


def test_the_brief_is_cached_per_seed(with_key, monkeypatch):
    import litellm

    calls: list[dict] = []
    body = " ".join(["We are closing the October books for head office this week."] * 14)
    monkeypatch.setattr(litellm, "completion", _fake_completion(body, calls=calls))
    first = get_brief("cache-me")
    second = get_brief("cache-me")
    assert first == second
    assert len(calls) == 1  # the second call came from SQLite


def test_health_reports_the_llm_state(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "gemini_api_key", "", raising=False)
    monkeypatch.setattr(get_settings(), "openai_api_key", "", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    assert client.get("/health").json() == {"ok": True, "llm": "fallback"}

    monkeypatch.setattr(get_settings(), "gemini_api_key", "test-key", raising=False)
    assert client.get("/health").json() == {"ok": True, "llm": "up"}
