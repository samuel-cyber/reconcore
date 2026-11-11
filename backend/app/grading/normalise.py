"""Submission normalisation (SPEC 5.5). Money is an integer number of Naira."""

from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation

AMOUNT_BODY = re.compile(r"^\d+(?:\.\d+)?$")
ID_PATTERN = re.compile(r"^[A-Za-z0-9-]{1,20}$")

_CURRENCY_PREFIXES = ("₦", "NGN", "N")


class AmountFormatError(ValueError):
    """The submitted amount is not a whole, non-negative number of Naira."""


def parse_naira(text: str) -> int:
    """`₦45,000`, `45000`, `45,000.00`, `NGN 45000` -> 45000.

    Rejects fractional kobo (`45,000.50`), negatives and anything non-numeric.
    """
    if text is None:
        raise AmountFormatError("empty amount")
    cleaned = str(text).strip()
    upper = cleaned.upper()
    for prefix in _CURRENCY_PREFIXES:
        if upper.startswith(prefix):
            cleaned = cleaned[len(prefix) :].strip()
            break
    cleaned = cleaned.replace(",", "")
    if not AMOUNT_BODY.match(cleaned):
        raise AmountFormatError(f"not a plain Naira amount: {text!r}")
    try:
        value = Decimal(cleaned)
    except InvalidOperation as exc:  # pragma: no cover - regex already gated it
        raise AmountFormatError(f"undecodable amount: {text!r}") from exc
    if value != value.to_integral_value():
        raise AmountFormatError(f"not a whole number of Naira: {text!r}")
    if value < 0:
        raise AmountFormatError(f"negative amount: {text!r}")
    return int(value)


def try_parse_naira(text: str) -> int | None:
    try:
        return parse_naira(text)
    except AmountFormatError:
        return None


def normalise_id(text: str) -> str:
    """Trim and uppercase; IDs are compared uppercased on both sides."""
    return str(text or "").strip().upper()


def is_valid_id(text: str) -> bool:
    return bool(ID_PATTERN.match(normalise_id(text)))
