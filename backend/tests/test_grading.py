"""SPEC 5.9: the four interesting submissions and their diagnostics."""

from __future__ import annotations

from app.generator.build import generate
from app.grading.grade import grade

DATASET = generate("demo")
TRUTH = DATASET.ground_truth


def _grade(amount, tx=None, wb=None):
    return grade(
        truth=TRUTH,
        discrepancy_ngn=amount,
        missing_tx_id=tx or TRUTH.missing_tx_id,
        duplicate_wb_id=wb or TRUTH.duplicate_wb_id,
    )


def test_the_correct_answer_passes():
    result = _grade(TRUTH.discrepancy_ngn)
    assert result.passed
    assert set(result.field_status.values()) == {"correct"}
    assert result.diagnostics.delta == 0
    assert not result.diagnostics.hit_decoy
    assert not result.diagnostics.included_cash


def test_ids_are_case_insensitive():
    result = _grade(
        TRUTH.discrepancy_ngn,
        tx=TRUTH.missing_tx_id.lower(),
        wb=f"  {TRUTH.duplicate_wb_id.lower()}  ",
    )
    assert result.passed


def test_the_decoy_transaction_is_flagged():
    result = _grade(TRUTH.discrepancy_ngn, tx=TRUTH.decoy_tx_id)
    assert not result.passed
    assert result.field_status["missing_tx_id"] == "incorrect"
    assert result.field_status["discrepancy_ngn"] == "correct"
    assert result.diagnostics.hit_decoy
    assert not result.diagnostics.picked_original_waybill


def test_the_original_waybill_is_flagged():
    result = _grade(TRUTH.discrepancy_ngn, wb=TRUTH.original_wb_id)
    assert not result.passed
    assert result.field_status["duplicate_wb_id"] == "incorrect"
    assert result.diagnostics.picked_original_waybill


def test_the_cash_included_total_is_flagged():
    submitted = TRUTH.discrepancy_ngn + TRUTH.cash_total_ngn
    result = _grade(submitted)
    assert not result.passed
    assert result.field_status["discrepancy_ngn"] == "incorrect"
    assert result.diagnostics.included_cash
    assert result.diagnostics.delta == TRUTH.cash_total_ngn


def test_a_plain_wrong_number_has_no_special_diagnosis():
    result = _grade(TRUTH.discrepancy_ngn + 17)
    assert result.diagnostics.delta == 17
    assert not result.diagnostics.included_cash
    assert not result.diagnostics.hit_decoy
