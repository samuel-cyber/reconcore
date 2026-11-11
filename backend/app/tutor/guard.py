"""Leak guard (SPEC 5.7).

Reject any hint that contains the truth amount in any form, the correct tx_id or wb_id,
or the decoy's ID. Ground truth must never reach the client, not even inside LLM prose.
"""

from __future__ import annotations

import re

from app.generator.build import GroundTruth


def _amount_forms(amount: int) -> list[str]:
    forms = {
        str(amount),
        f"{amount:,}",
        f"{amount:,}".replace(",", " "),
        f"{amount:,}".replace(",", "."),
    }
    if amount >= 1000 and amount % 1000 == 0:
        thousands = amount // 1000
        forms |= {
            f"{thousands}k",
            f"{thousands} k",
            f"{thousands}thousand",
            f"{thousands} thousand",
        }
        if amount % 1_000_000 == 0:
            millions = amount // 1_000_000
            forms |= {f"{millions}m", f"{millions} million"}
    return sorted(forms)


def leak_terms(truth: GroundTruth) -> list[str]:
    terms = _amount_forms(truth.discrepancy_ngn)
    terms += [
        truth.missing_tx_id,
        truth.duplicate_wb_id,
        truth.decoy_tx_id,
        truth.original_wb_id,
    ]
    return [t for t in terms if t]


def _normalise(text: str) -> str:
    # Collapse separators so "4 5 , 0 0 0" cannot smuggle the amount past us.
    return re.sub(r"[\s ,._-]+", "", text).lower()


def leaks(text: str, truth: GroundTruth) -> str | None:
    """Return the offending term, or None when the text is safe to show."""
    haystack = _normalise(text)
    for term in leak_terms(truth):
        if _normalise(term) and _normalise(term) in haystack:
            return term
    # Digit runs that contain the amount (e.g. "about 45000 naira" written oddly).
    for run in re.findall(r"\d[\d,. ]*", text):
        digits = re.sub(r"\D", "", run)
        if digits and digits == str(truth.discrepancy_ngn):
            return run.strip()
    return None


def is_safe(text: str, truth: GroundTruth) -> bool:
    return leaks(text, truth) is None
