"""Deterministic grading (SPEC 5.5). No LLM is involved in any of this."""

from __future__ import annotations

from dataclasses import dataclass, field

from app.generator.build import GroundTruth
from app.grading.normalise import normalise_id


@dataclass(frozen=True)
class Diagnostics:
    """Private tutor input. Never serialised to a client."""

    delta: int
    hit_decoy: bool
    picked_original_waybill: bool
    included_cash: bool

    def as_dict(self) -> dict:
        return {
            "delta": self.delta,
            "hit_decoy": self.hit_decoy,
            "picked_original_waybill": self.picked_original_waybill,
            "included_cash": self.included_cash,
        }


@dataclass(frozen=True)
class GradeResult:
    passed: bool
    field_status: dict[str, str]
    diagnostics: Diagnostics = field(repr=False)


def grade(
    *,
    truth: GroundTruth,
    discrepancy_ngn: int,
    missing_tx_id: str,
    duplicate_wb_id: str,
) -> GradeResult:
    submitted_tx = normalise_id(missing_tx_id)
    submitted_wb = normalise_id(duplicate_wb_id)

    field_status = {
        "discrepancy_ngn": "correct"
        if discrepancy_ngn == truth.discrepancy_ngn
        else "incorrect",
        "missing_tx_id": "correct"
        if submitted_tx == normalise_id(truth.missing_tx_id)
        else "incorrect",
        "duplicate_wb_id": "correct"
        if submitted_wb == normalise_id(truth.duplicate_wb_id)
        else "incorrect",
    }

    diagnostics = Diagnostics(
        delta=discrepancy_ngn - truth.discrepancy_ngn,
        hit_decoy=submitted_tx == normalise_id(truth.decoy_tx_id),
        picked_original_waybill=submitted_wb == normalise_id(truth.original_wb_id),
        included_cash=discrepancy_ngn == truth.discrepancy_ngn + truth.cash_total_ngn,
    )

    return GradeResult(
        passed=all(status == "correct" for status in field_status.values()),
        field_status=field_status,
        diagnostics=diagnostics,
    )
