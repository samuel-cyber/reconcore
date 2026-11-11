"""Display-string messiness (SPEC 3, step 3 of SPEC 5.3).

Internal values stay typed (int Naira, datetime.date); only the strings that reach the
CSV and the API get messy. Everything here takes an explicit `random.Random`.
"""

from __future__ import annotations

import random
from datetime import date, datetime

DATE_STYLES = ("dmy_slash", "iso", "mon_dmy")

_DATE_FORMATS = {
    "dmy_slash": "%d/%m/%Y",
    "iso": "%Y-%m-%d",
    "mon_dmy": "%b %d %Y",
}

_PARSE_FORMATS = ("%d/%m/%Y", "%Y-%m-%d", "%b %d %Y", "%d-%m-%Y", "%d/%m/%y")

AMOUNT_STYLES = (
    "plain",
    "comma",
    "comma_decimal",
    "naira_comma",
    "naira_comma_decimal",
)
# Bank statements print raw machine amounts too, e.g. `45000.00`.
BANK_AMOUNT_STYLES = AMOUNT_STYLES + ("plain_decimal",)


def format_date(value: date, style: str) -> str:
    return value.strftime(_DATE_FORMATS[style])


def parse_messy_date(text: str) -> date | None:
    """Parse any date format the generator can emit. Used by tests and invariants."""
    cleaned = " ".join(text.strip().split())
    for fmt in _PARSE_FORMATS:
        try:
            return datetime.strptime(cleaned, fmt).date()
        except ValueError:
            continue
    return None


def format_amount(amount: int, style: str) -> str:
    """Render an integer Naira amount in one of the messy on-screen styles."""
    if style == "plain":
        return str(amount)
    if style == "comma":
        return f"{amount:,}"
    if style == "comma_decimal":
        return f"{amount:,}.00"
    if style == "naira_comma":
        return f"₦{amount:,}"
    if style == "naira_comma_decimal":
        return f"₦{amount:,}.00"
    if style == "plain_decimal":
        return f"{amount}.00"
    raise ValueError(f"unknown amount style: {style}")


def messy_text(value: str, rng: random.Random, *, allow_case: bool = True) -> str:
    """Trailing spaces and casing wobble, the way humans actually type into a till."""
    roll = rng.random()
    if allow_case and roll < 0.12:
        return value.lower()
    if allow_case and roll < 0.18:
        return value.upper()
    if roll < 0.35:
        return value + " "
    return value


def messy_payment_method(value: str, rng: random.Random) -> str:
    """Casing only: `Transfer`, `transfer`, `TRANSFER` all mean the same thing."""
    roll = rng.random()
    if roll < 0.18:
        return value.lower()
    if roll < 0.30:
        return value.upper()
    return value


def levenshtein(a: str, b: str) -> int:
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    previous = list(range(len(b) + 1))
    for i, ca in enumerate(a, start=1):
        current = [i]
        for j, cb in enumerate(b, start=1):
            current.append(
                min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (ca != cb))
            )
        previous = current
    return previous[-1]


def product_typo(name: str, rng: random.Random) -> str:
    """Drop one letter from the product name: edit distance 1, still clearly the same item.

    Only alphabetic characters that are not the first character of a word are eligible,
    so `Peak-Milk-400g` becomes something like `Peak-Mlk-400g` and never loses a digit.
    """
    eligible = [
        i
        for i, ch in enumerate(name)
        if ch.isalpha() and i > 0 and name[i - 1].isalpha()
    ]
    if not eligible:  # pragma: no cover - every catalogue name has eligible letters
        return name + "."
    index = rng.choice(eligible)
    return name[:index] + name[index + 1 :]
