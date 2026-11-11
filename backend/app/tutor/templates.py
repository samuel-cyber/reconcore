"""The hint ladder (SPEC 5.7). These texts are the offline fallback and the floor the
LLM is never allowed to go below: they never contain an amount or an ID.
"""

from __future__ import annotations

MAX_LEVEL = 3

LADDER: dict[int, dict[str, str]] = {
    1: {
        "discrepancy_ngn": "Which payment methods should reach the bank at all?",
        "missing_tx_id": "Which table should every transfer show up in?",
        "duplicate_wb_id": "Which table records physical stock moving?",
    },
    2: {
        "discrepancy_ngn": "Compare transfer sales against credits, not all sales.",
        "missing_tx_id": "Match on the customer reference, not the amount.",
        "duplicate_wb_id": "Look for two rows that are the same delivery written differently.",
    },
    3: {
        "discrepancy_ngn": "Check the dates in October; one transfer has no partner.",
        "missing_tx_id": "Two transfers share an amount; only one is in the bank.",
        "duplicate_wb_id": "Product names can be misspelled; normalise dates before comparing.",
    },
}

FIELD_ORDER = ("discrepancy_ngn", "missing_tx_id", "duplicate_wb_id")

INVALID_AMOUNT_HINT = (
    "Enter the discrepancy as a whole number of Naira — no kobo, no minus sign "
    "(a ₦ sign and commas are fine). Which figure did you mean to type?"
)


def clamp_level(attempt_no: int) -> int:
    return max(1, min(attempt_no, MAX_LEVEL))


def template_text(level: int, field_status: dict[str, str]) -> str:
    """Address only the fields that are wrong, at most two sentences."""
    rung = LADDER[clamp_level(level)]
    parts = [rung[name] for name in FIELD_ORDER if field_status.get(name) != "correct"]
    if not parts:  # pragma: no cover - a hint is only built for a failed attempt
        parts = [rung["discrepancy_ngn"]]
    return " ".join(parts[:2])
