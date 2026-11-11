"""SPEC 3 generator invariants over 200 seeds, plus demo determinism."""

from __future__ import annotations

import csv
import io

import pytest

from app.generator.build import generate
from app.generator.messiness import levenshtein, parse_messy_date
from app.grading.normalise import parse_naira

SEEDS = [f"seed-{i}" for i in range(200)]


def _pos_records(dataset):
    table = dataset.tables["pos"]
    return [dict(zip(table.columns, row)) for row in table.rows]


def _wb_records(dataset):
    table = dataset.tables["waybills"]
    return [dict(zip(table.columns, row)) for row in table.rows]


def _bank_records(dataset):
    table = dataset.tables["bank"]
    return [dict(zip(table.columns, row)) for row in table.rows]


def _transfers(dataset):
    return [
        r for r in _pos_records(dataset) if r["payment_method"].strip().lower() == "transfer"
    ]


def _near_duplicate_pairs(dataset):
    """Waybill pairs that are the same delivery written differently."""
    rows = _wb_records(dataset)
    pairs = []
    for i, a in enumerate(rows):
        for b in rows[i + 1 :]:
            if a["qty_dispatched"] != b["qty_dispatched"]:
                continue
            if parse_messy_date(a["date"]) != parse_messy_date(b["date"]):
                continue
            if a["destination"].strip().lower() != b["destination"].strip().lower():
                continue
            if a["driver"].strip().lower() != b["driver"].strip().lower():
                continue
            if 1 <= levenshtein(a["product"], b["product"]) <= 2:
                pairs.append((a["wb_id"], b["wb_id"]))
    return pairs


@pytest.mark.parametrize("seed", SEEDS)
def test_exactly_one_transfer_has_no_bank_credit(seed):
    dataset = generate(seed)
    narrations = " | ".join(r["narration"] for r in _bank_records(dataset))
    unmatched = [
        t for t in _transfers(dataset) if t["customer_ref"] not in narrations
    ]
    assert len(unmatched) == 1
    assert unmatched[0]["tx_id"] == dataset.ground_truth.missing_tx_id


@pytest.mark.parametrize("seed", SEEDS)
def test_exactly_one_fuzzy_duplicate_waybill_pair(seed):
    dataset = generate(seed)
    pairs = _near_duplicate_pairs(dataset)
    assert len(pairs) == 1
    original, duplicate = pairs[0]
    # The *second*, later-listed copy is the answer.
    assert duplicate == dataset.ground_truth.duplicate_wb_id
    assert original == dataset.ground_truth.original_wb_id
    assert duplicate > original


@pytest.mark.parametrize("seed", SEEDS)
def test_decoy_shares_the_amount_but_is_settled(seed):
    dataset = generate(seed)
    truth = dataset.ground_truth
    by_id = {r["tx_id"]: r for r in _pos_records(dataset)}
    unsettled, decoy = by_id[truth.missing_tx_id], by_id[truth.decoy_tx_id]

    assert truth.decoy_tx_id != truth.missing_tx_id
    assert parse_naira(decoy["amount"]) == parse_naira(unsettled["amount"])
    assert decoy["payment_method"].strip().lower() == "transfer"
    narrations = " | ".join(r["narration"] for r in _bank_records(dataset))
    assert decoy["customer_ref"] in narrations
    # ...and amount alone is genuinely ambiguous: exactly two transfers share it.
    sharing = [
        t for t in _transfers(dataset) if parse_naira(t["amount"]) == truth.discrepancy_ngn
    ]
    assert {t["tx_id"] for t in sharing} == {truth.missing_tx_id, truth.decoy_tx_id}


@pytest.mark.parametrize("seed", SEEDS)
def test_discrepancy_equals_the_unsettled_amount_and_is_positive(seed):
    dataset = generate(seed)
    transfer_total = sum(parse_naira(t["amount"]) for t in _transfers(dataset))
    bank_total = sum(parse_naira(r["credit_amount"]) for r in _bank_records(dataset))
    by_id = {r["tx_id"]: r for r in _pos_records(dataset)}
    unsettled_amount = parse_naira(by_id[dataset.ground_truth.missing_tx_id]["amount"])

    assert transfer_total - bank_total == unsettled_amount
    assert dataset.ground_truth.discrepancy_ngn == unsettled_amount
    assert dataset.ground_truth.discrepancy_ngn > 0


@pytest.mark.parametrize("seed", SEEDS)
def test_ids_are_unique_within_each_table(seed):
    dataset = generate(seed)
    for key, column in (("pos", "tx_id"), ("waybills", "wb_id"), ("bank", "bank_ref")):
        table = dataset.tables[key]
        values = [row[table.columns.index(column)] for row in table.rows]
        assert len(values) == len(set(values)), f"{key}.{column} not unique"
    refs = [t["customer_ref"] for t in _transfers(dataset)]
    assert len(refs) == len(set(refs))


@pytest.mark.parametrize("seed", SEEDS)
def test_table_shapes_and_no_cash_or_card_in_the_bank(seed):
    dataset = generate(seed)
    assert 18 <= len(dataset.tables["pos"].rows) <= 22
    assert 15 <= len(dataset.tables["waybills"].rows) <= 17
    assert len(dataset.tables["bank"].rows) == len(_transfers(dataset)) - 1
    for table in dataset.tables.values():
        for row in table.rows:
            assert len(row) == len(table.columns)
    # Only transfers ever reach the bank statement.
    non_transfer_refs = [
        r["customer_ref"]
        for r in _pos_records(dataset)
        if r["payment_method"].strip().lower() != "transfer" and r["customer_ref"]
    ]
    assert non_transfer_refs == []


def test_demo_is_byte_identical_every_run():
    first = generate("demo")
    for _ in range(3):
        again = generate("demo")
        assert again.canonical_csv == first.canonical_csv
        assert again.dataset_hash == first.dataset_hash
        assert again.ground_truth == first.ground_truth


def test_demo_answers_are_the_pinned_ones():
    truth = generate("demo").ground_truth
    assert truth.discrepancy_ngn == 45_000
    assert truth.missing_tx_id == "POS-1042"
    assert truth.duplicate_wb_id == "WB-3311"
    assert truth.decoy_tx_id == "POS-1049"
    assert truth.original_wb_id == "WB-3307"


def test_canonical_csv_is_canonical():
    dataset = generate("demo")
    for key, raw in dataset.canonical_csv.items():
        assert not raw.startswith(b"\xef\xbb\xbf"), "no BOM"
        assert b"\r" not in raw, "LF line endings only"
        assert raw.endswith(b"\n")
        text = raw.decode("utf-8")
        parsed = list(csv.reader(io.StringIO(text)))
        assert parsed[0] == dataset.tables[key].columns
        assert parsed[1:] == dataset.tables[key].rows


def test_dataset_hash_is_sensitive_to_every_table():
    import hashlib

    dataset = generate("demo")
    pos, wb, bank = (dataset.canonical_csv[k] for k in ("pos", "waybills", "bank"))
    expected = hashlib.sha256(pos + b"\x1e" + wb + b"\x1e" + bank).hexdigest()
    assert dataset.dataset_hash == f"sha256:{expected}"
    assert generate("other-seed").dataset_hash != dataset.dataset_hash


def test_the_generator_never_touches_the_global_random():
    """random.Random(seed) only: seeding the global module must change nothing."""
    import random

    random.seed(1)
    first = generate("stability-check").canonical_csv
    random.seed(999)
    [random.random() for _ in range(50)]
    assert generate("stability-check").canonical_csv == first
