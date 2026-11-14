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


# Sharper openers for the three mistakes the grader can recognise. Like the ladder they
# are fixed text: no amount, no ID, nothing seed-specific.
DIAGNOSTIC_HINTS: dict[str, str] = {
    "included_cash": (
        "Your total is too high, and it looks like cash sales were counted. Does cash "
        "ever reach the bank statement?"
    ),
    "hit_decoy": (
        "That transfer shares its amount with another one, and only one of them is "
        "missing. Which of the two has its customer reference in a bank narration?"
    ),
    "picked_original_waybill": (
        "You found the right delivery, but that is the original entry. Which copy was "
        "logged second, with the product name misspelled?"
    ),
}


def _field_text(name: str, level: int, diagnostics) -> str:
    """The diagnostic opener when the grader recognised the mistake, else the ladder."""
    if diagnostics is not None:
        if name == "discrepancy_ngn" and diagnostics.included_cash:
            return DIAGNOSTIC_HINTS["included_cash"]
        if name == "missing_tx_id" and diagnostics.hit_decoy:
            return DIAGNOSTIC_HINTS["hit_decoy"]
        if name == "duplicate_wb_id" and diagnostics.picked_original_waybill:
            return DIAGNOSTIC_HINTS["picked_original_waybill"]
    return LADDER[clamp_level(level)][name]


def template_text(level: int, field_status: dict[str, str], diagnostics=None) -> str:
    """Address only the fields that are wrong, two fields at most.

    `diagnostics` is the grader's private read of the mistake (decoy picked, cash
    included, original waybill picked). When it recognises one, the hint speaks to that
    mistake; it still never names an amount or an ID.
    """
    parts = [
        _field_text(name, level, diagnostics)
        for name in FIELD_ORDER
        if field_status.get(name) != "correct"
    ]
    if not parts:  # pragma: no cover - a hint is only built for a failed attempt
        parts = [LADDER[clamp_level(level)]["discrepancy_ngn"]]
    return " ".join(parts[:2])
