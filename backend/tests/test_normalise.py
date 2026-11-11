"""SPEC 5.9: amount parsing and ID normalisation."""

from __future__ import annotations

import pytest

from app.grading.normalise import (
    AmountFormatError,
    is_valid_id,
    normalise_id,
    parse_naira,
    try_parse_naira,
)


@pytest.mark.parametrize(
    "text",
    ["₦45,000", "45000", "45,000.00", "NGN 45000", "N45,000", "  ₦45,000  ", "45000.00",
     "ngn45,000", "₦ 45,000"],
)
def test_accepted_amount_forms_all_mean_45000(text):
    assert parse_naira(text) == 45_000


@pytest.mark.parametrize(
    "text", ["45,000.50", "-45000", "abc", "", "   ", "45 000", "4.5e4", "₦", "45,0 00"]
)
def test_rejected_amount_forms(text):
    with pytest.raises(AmountFormatError):
        parse_naira(text)
    assert try_parse_naira(text) is None


def test_money_is_an_integer():
    value = parse_naira("45,000.00")
    assert isinstance(value, int) and not isinstance(value, bool)


def test_normalise_id_trims_and_uppercases():
    assert normalise_id("  pos-1042 ") == "POS-1042"
    assert normalise_id(None) == ""


@pytest.mark.parametrize("text", ["POS-1042", "wb-3311", " WB-3311 ", "A", "1" * 20])
def test_valid_ids(text):
    assert is_valid_id(text)


@pytest.mark.parametrize("text", ["", "POS 1042", "POS_1042", "1" * 21, "pos;1042", "₦"])
def test_invalid_ids(text):
    assert not is_valid_id(text)
