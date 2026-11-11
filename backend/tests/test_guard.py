"""SPEC 5.9: the leak guard blocks anything that gives the answer away."""

from __future__ import annotations

import pytest

from app.generator.build import generate
from app.schemas import FieldStatusMap
from app.store.sessions import SessionRecord
from app.tutor import templates
from app.tutor.guard import is_safe, leaks
from app.tutor.tutor import build_hint

DATASET = generate("demo")
TRUTH = DATASET.ground_truth  # 45000 / POS-1042 / WB-3311, decoy POS-1049


@pytest.mark.parametrize(
    "text",
    [
        "The gap is 45000 naira.",
        "You are looking for ₦45,000.",
        "It is about 45k.",
        "Roughly 45 thousand naira is missing.",
        "Check POS-1042 against the bank.",
        "pos-1042 is the one.",
        "The duplicate is WB-3311.",
        "Not POS-1049 — the other one.",
        "The answer is 45.000",
        "4 5 0 0 0 is the gap.",
        "The original row is WB-3307.",
    ],
)
def test_leaky_hints_are_detected(text):
    assert leaks(text, TRUTH) is not None
    assert not is_safe(text, TRUTH)


@pytest.mark.parametrize(
    "text",
    [
        "Which payment methods should reach the bank at all?",
        "Match on the customer reference, not the amount.",
        "Two transfers share an amount; only one is in the bank.",
        "Compare October dates before you compare product names.",
        "Look at the 2026 waybill dates in a single format first.",
    ],
)
def test_clean_hints_pass(text):
    assert is_safe(text, TRUTH)


def test_every_ladder_rung_is_safe_for_every_seed():
    for seed in ("demo", "seed-1", "seed-2", "seed-3", "seed-77"):
        truth = generate(seed).ground_truth
        for level in templates.LADDER:
            for text in templates.LADDER[level].values():
                assert is_safe(text, truth), (seed, level, text)
        assert is_safe(templates.INVALID_AMOUNT_HINT, truth)


def _session() -> SessionRecord:
    from datetime import datetime, timezone

    from app.generator.brief import template_brief

    return SessionRecord(
        id="ses_test01",
        seed="demo",
        candidate_name="Ada Okafor",
        ground_truth=TRUTH,
        dataset_hash=DATASET.dataset_hash,
        brief=template_brief(),
        created_at=datetime.now(timezone.utc),
        solved_at=None,
    )


def test_a_leaking_llm_hint_is_replaced_by_the_template(monkeypatch):
    import app.tutor.tutor as tutor_module

    monkeypatch.setattr(
        tutor_module, "_llm_hint", lambda **_: "Just submit 45,000 for POS-1042."
    )
    status = FieldStatusMap(
        discrepancy_ngn="incorrect",
        missing_tx_id="incorrect",
        duplicate_wb_id="correct",
    )
    hint = build_hint(
        session=_session(), field_status=status, diagnostics=None, attempt_no=1
    )
    assert hint.source == "template"
    assert hint.text == templates.template_text(1, status.model_dump())
    assert is_safe(hint.text, TRUTH)


def test_a_clean_llm_hint_is_kept_and_labelled_llm(monkeypatch):
    import app.tutor.tutor as tutor_module

    clean = "Which ledger should every bank transfer eventually appear in?"
    monkeypatch.setattr(tutor_module, "_llm_hint", lambda **_: clean)
    status = FieldStatusMap(
        discrepancy_ngn="incorrect", missing_tx_id="incorrect", duplicate_wb_id="correct"
    )
    hint = build_hint(
        session=_session(), field_status=status, diagnostics=None, attempt_no=2
    )
    assert hint.source == "llm"
    assert hint.text == clean
    assert hint.level == 2


def test_hints_only_address_incorrect_fields():
    status = FieldStatusMap(
        discrepancy_ngn="correct", missing_tx_id="incorrect", duplicate_wb_id="correct"
    )
    text = templates.template_text(1, status.model_dump())
    assert text == templates.LADDER[1]["missing_tx_id"]
