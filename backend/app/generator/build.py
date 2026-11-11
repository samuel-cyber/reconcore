"""generate(seed) -> Dataset (SPEC 5.3).

Three steps, exactly as specified:
  1. build a clean world where every Transfer sale has a matching bank credit;
  2. inject the faults (unsettled transfer, equal-amount decoy, duplicated waybill);
  3. apply messiness to the display strings only.

`random.Random(seed)` is the only source of randomness; the global `random` module is
never used. The ground truth lives on the Dataset and never leaves the backend.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from functools import lru_cache
from datetime import date, timedelta

from app.core.canonical import canonical_csv_bytes, dataset_hash
from app.generator import scenario as sc
from app.generator.messiness import (
    AMOUNT_STYLES,
    BANK_AMOUNT_STYLES,
    DATE_STYLES,
    format_amount,
    format_date,
    messy_payment_method,
    messy_text,
    product_typo,
)

MIN_TRANSFERS = 8
POS_START_DATE = date(2026, 10, 11)
POS_LAST_DATE = date(2026, 10, 20)
WB_START_DATE = date(2026, 10, 10)


# --------------------------------------------------------------------------- types


@dataclass(frozen=True)
class GroundTruth:
    """Never serialised to a client. Stored server-side only."""

    discrepancy_ngn: int
    missing_tx_id: str
    duplicate_wb_id: str
    decoy_tx_id: str
    original_wb_id: str
    cash_total_ngn: int

    def as_dict(self) -> dict:
        return {
            "discrepancy_ngn": self.discrepancy_ngn,
            "missing_tx_id": self.missing_tx_id,
            "duplicate_wb_id": self.duplicate_wb_id,
            "decoy_tx_id": self.decoy_tx_id,
            "original_wb_id": self.original_wb_id,
            "cash_total_ngn": self.cash_total_ngn,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "GroundTruth":
        return cls(
            discrepancy_ngn=int(data["discrepancy_ngn"]),
            missing_tx_id=str(data["missing_tx_id"]),
            duplicate_wb_id=str(data["duplicate_wb_id"]),
            decoy_tx_id=str(data["decoy_tx_id"]),
            original_wb_id=str(data.get("original_wb_id", "")),
            cash_total_ngn=int(data.get("cash_total_ngn", 0)),
        )


@dataclass(frozen=True)
class Table:
    key: str
    filename: str
    columns: list[str]
    rows: list[list[str]]


@dataclass(frozen=True)
class Dataset:
    seed: str
    tables: dict[str, Table]
    ground_truth: GroundTruth
    canonical_csv: dict[str, bytes]
    dataset_hash: str


@dataclass
class _PosRow:
    tx_id: str
    day: date
    cashier: str
    product: str
    qty: int
    amount: int
    payment_method: str
    customer_ref: str


@dataclass
class _BankRow:
    bank_ref: str
    value_day: date
    counterparty: str
    customer_ref: str
    narration_style: str
    credit_amount: int


@dataclass
class _WbRow:
    day: date
    product: str
    qty: int
    driver: str
    wb_id: str = ""
    date_style: str | None = None
    is_duplicate: bool = False
    is_duplicate_source: bool = False


@dataclass
class _Plan:
    n_pos: int
    n_waybills: int
    headline_amount: int
    unsettled_row: int
    decoy_row: int
    unsettled_combo: tuple[str, int]
    decoy_combo: tuple[str, int]
    dup_source_index: int
    dup_insert_index: int
    payment_methods: list[str] = field(default_factory=list)


# ------------------------------------------------------------------------ planning


def _plan(seed: str, rng: random.Random) -> _Plan:
    n_pos = rng.randint(18, 22)
    headline = rng.choice(sc.HEADLINE_AMOUNTS)
    n_wb = rng.randint(14, 16)

    methods = [
        rng.choices(sc.PAYMENT_METHODS, weights=sc.PAYMENT_WEIGHTS, k=1)[0]
        for _ in range(n_pos)
    ]
    non_transfers = [i for i, m in enumerate(methods) if m != "Transfer"]
    rng.shuffle(non_transfers)
    while sum(m == "Transfer" for m in methods) < MIN_TRANSFERS and non_transfers:
        methods[non_transfers.pop()] = "Transfer"

    transfer_rows = [i for i, m in enumerate(methods) if m == "Transfer"]
    unsettled_row, decoy_row = sorted(rng.sample(transfer_rows, 2))

    combos = sc.combos_for_amount(headline)
    unsettled_combo, decoy_combo = rng.sample(combos, 2)

    dup_source = rng.randrange(0, max(1, n_wb - 4))
    dup_insert = min(n_wb, dup_source + rng.randint(3, 5))

    plan = _Plan(
        n_pos=n_pos,
        n_waybills=n_wb,
        headline_amount=headline,
        unsettled_row=unsettled_row,
        decoy_row=decoy_row,
        unsettled_combo=unsettled_combo,
        decoy_combo=decoy_combo,
        dup_source_index=dup_source,
        dup_insert_index=dup_insert,
        payment_methods=methods,
    )

    if seed == "demo":
        _apply_demo_pin(plan)
    return plan


def _apply_demo_pin(plan: _Plan) -> None:
    """Locked decision 7: the demo seed's structure is fixed; its values are not."""
    pin = sc.DEMO_PLAN
    plan.n_pos = int(pin["n_pos"])
    plan.n_waybills = int(pin["n_waybills"])
    plan.headline_amount = int(pin["headline_amount"])
    plan.unsettled_row = int(pin["unsettled_row"])
    plan.decoy_row = int(pin["decoy_row"])
    plan.unsettled_combo = tuple(pin["unsettled_combo"])  # type: ignore[assignment]
    plan.decoy_combo = tuple(pin["decoy_combo"])  # type: ignore[assignment]
    plan.dup_source_index = int(pin["dup_source_index"])
    plan.dup_insert_index = int(pin["dup_insert_index"])

    methods = plan.payment_methods[: plan.n_pos]
    while len(methods) < plan.n_pos:
        methods.append("Cash")
    methods[plan.unsettled_row] = "Transfer"
    methods[plan.decoy_row] = "Transfer"
    plan.payment_methods = methods


# ------------------------------------------------------------- step 1 + 2: the world


def _pos_dates(rng: random.Random, count: int) -> list[date]:
    day = POS_START_DATE
    days: list[date] = []
    for _ in range(count):
        days.append(day)
        if rng.random() < 0.5 and day < POS_LAST_DATE:
            day += timedelta(days=1)
    return days


def _build_pos(rng: random.Random, plan: _Plan) -> list[_PosRow]:
    days = _pos_dates(rng, plan.n_pos)
    rows: list[_PosRow] = []
    customer_ref = sc.CUSTOMER_REF_BASE
    # The decoy pair must be the *only* two transfers sharing a value, so no other
    # transfer may reuse an amount.
    used_transfer_amounts = {plan.headline_amount}

    for index in range(plan.n_pos):
        method = plan.payment_methods[index]
        if index == plan.unsettled_row:
            product, qty = plan.unsettled_combo
        elif index == plan.decoy_row:
            product, qty = plan.decoy_combo
        else:
            product, qty = _ordinary_line(rng, method, used_transfer_amounts)

        amount = sc.PRODUCTS[product] * qty
        if method == "Transfer":
            used_transfer_amounts.add(amount)
        ref = ""
        if method == "Transfer":
            customer_ref += rng.randint(20, 60)
            ref = f"TRF-{customer_ref}"

        rows.append(
            _PosRow(
                tx_id=f"POS-{sc.TX_ID_BASE + index}",
                day=days[index],
                cashier=rng.choice(sc.CASHIERS),
                product=product,
                qty=qty,
                amount=amount,
                payment_method=method,
                customer_ref=ref,
            )
        )
    return rows


def _ordinary_line(
    rng: random.Random, method: str, used_transfer_amounts: set[int]
) -> tuple[str, int]:
    """A normal sale. Two transfers never share a value unless they are the decoy pair."""
    candidates: list[tuple[str, int]] = []
    for _ in range(40):
        product = rng.choice(sc.PRODUCT_NAMES)
        price = sc.PRODUCTS[product]
        max_qty = max(1, min(sc.MAX_QTY, sc.MAX_LINE_AMOUNT // price))
        qty = rng.randint(1, max_qty)
        candidates.append((product, qty))
        if method != "Transfer" or price * qty not in used_transfer_amounts:
            return product, qty
    # Fall back to the first distinct amount we can build from the catalogue.
    for product, price in sc.PRODUCTS.items():
        for qty in range(1, sc.MAX_QTY + 1):
            if price * qty not in used_transfer_amounts:
                return product, qty
    return candidates[0]  # pragma: no cover - catalogue is far larger than row count


def _build_bank(
    rng: random.Random, pos_rows: list[_PosRow], plan: _Plan
) -> list[_BankRow]:
    """One credit per Transfer sale — except the unsettled one, which is simply absent."""
    pool = list(sc.COUNTERPARTIES)
    rng.shuffle(pool)
    rows: list[_BankRow] = []

    for index, pos in enumerate(pos_rows):
        if pos.payment_method != "Transfer" or index == plan.unsettled_row:
            continue
        rows.append(
            _BankRow(
                bank_ref="",
                value_day=pos.day + timedelta(days=rng.choice([0, 0, 1])),
                counterparty=pool[len(rows) % len(pool)],
                customer_ref=pos.customer_ref,
                narration_style=rng.choice(["trf_from", "nip_cr"]),
                credit_amount=pos.amount,
            )
        )

    # A statement is ordered by value date, and its references climb with it.
    rows.sort(key=lambda r: r.value_day)
    bank_ref = sc.BANK_REF_BASE
    for row in rows:
        bank_ref += rng.randint(15, 40)
        row.bank_ref = f"GTB-{bank_ref}"
    return rows


def _build_waybills(rng: random.Random, plan: _Plan) -> list[_WbRow]:
    rows: list[_WbRow] = []
    seen: set[tuple[str, int, date]] = set()
    day = WB_START_DATE

    for _ in range(plan.n_waybills):
        for _attempt in range(24):
            product = rng.choice(sc.PRODUCT_NAMES)
            qty = rng.randrange(8, 42, 2)
            if (product, qty, day) not in seen:
                break
        seen.add((product, qty, day))
        rows.append(_WbRow(day=day, product=product, qty=qty, driver=rng.choice(sc.DRIVERS)))
        if rng.random() < 0.6:
            day += timedelta(days=1)

    # The planted duplicate: the same delivery, re-keyed with a product typo and a
    # different date format, inserted a few rows later.
    source = rows[plan.dup_source_index]
    source.is_duplicate_source = True
    source.date_style = rng.choice(DATE_STYLES)
    other_styles = [s for s in DATE_STYLES if s != source.date_style]
    copy = _WbRow(
        day=source.day,
        product=product_typo(source.product, rng),
        qty=source.qty,
        driver=source.driver,
        date_style=rng.choice(other_styles),
        is_duplicate=True,
    )
    rows.insert(plan.dup_insert_index, copy)

    for index, row in enumerate(rows):
        row.wb_id = f"WB-{sc.WB_ID_BASE + index}"
    return rows


# ------------------------------------------------------------- step 3: display rows


def _render_pos(rng: random.Random, rows: list[_PosRow]) -> list[list[str]]:
    out: list[list[str]] = []
    for row in rows:
        product = row.product.lower() if rng.random() < 0.08 else row.product
        out.append(
            [
                row.tx_id,
                format_date(row.day, rng.choice(DATE_STYLES)),
                messy_text(row.cashier, rng),
                product,
                str(row.qty),
                format_amount(row.amount, rng.choice(AMOUNT_STYLES)),
                messy_payment_method(row.payment_method, rng),
                row.customer_ref,
            ]
        )
    return out


def _render_waybills(rng: random.Random, rows: list[_WbRow]) -> list[list[str]]:
    out: list[list[str]] = []
    for row in rows:
        style = row.date_style or rng.choice(DATE_STYLES)
        out.append(
            [
                row.wb_id,
                format_date(row.day, style),
                row.product,  # the planted typo is the only product messiness here
                str(row.qty),
                messy_text(sc.DESTINATION, rng),
                messy_text(row.driver, rng, allow_case=False),
            ]
        )
    return out


def _render_bank(rng: random.Random, rows: list[_BankRow]) -> list[list[str]]:
    out: list[list[str]] = []
    for row in rows:
        if row.narration_style == "trf_from":
            narration = f"TRF FROM {row.counterparty}/{row.customer_ref}"
        else:
            narration = f"NIP CR/{row.counterparty}/{row.customer_ref}"
        out.append(
            [
                row.bank_ref,
                format_date(row.value_day, rng.choice(DATE_STYLES)),
                narration,
                format_amount(row.credit_amount, rng.choice(BANK_AMOUNT_STYLES)),
            ]
        )
    return out


# ------------------------------------------------------------------------ entrypoint


def generate(seed: str) -> Dataset:
    rng = random.Random(seed)
    plan = _plan(seed, rng)

    pos_rows = _build_pos(rng, plan)
    bank_rows = _build_bank(rng, pos_rows, plan)
    wb_rows = _build_waybills(rng, plan)

    display = {
        "pos": _render_pos(rng, pos_rows),
        "waybills": _render_waybills(rng, wb_rows),
        "bank": _render_bank(rng, bank_rows),
    }

    tables = {
        key: Table(
            key=key,
            filename=sc.TABLE_FILENAMES[key],
            columns=sc.TABLE_COLUMNS[key],
            rows=display[key],
        )
        for key in ("pos", "waybills", "bank")
    }

    canonical = {
        key: canonical_csv_bytes(table.columns, table.rows)
        for key, table in tables.items()
    }

    transfer_total = sum(r.amount for r in pos_rows if r.payment_method == "Transfer")
    bank_total = sum(r.credit_amount for r in bank_rows)
    unsettled = pos_rows[plan.unsettled_row]
    duplicate = next(r for r in wb_rows if r.is_duplicate)
    original = next(r for r in wb_rows if r.is_duplicate_source)

    ground_truth = GroundTruth(
        discrepancy_ngn=transfer_total - bank_total,
        missing_tx_id=unsettled.tx_id,
        duplicate_wb_id=duplicate.wb_id,
        decoy_tx_id=pos_rows[plan.decoy_row].tx_id,
        original_wb_id=original.wb_id,
        cash_total_ngn=sum(r.amount for r in pos_rows if r.payment_method == "Cash"),
    )

    return Dataset(
        seed=seed,
        tables=tables,
        ground_truth=ground_truth,
        canonical_csv=canonical,
        dataset_hash=dataset_hash(
            canonical["pos"], canonical["waybills"], canonical["bank"]
        ),
    )


@lru_cache(maxsize=256)
def load_dataset(seed: str) -> Dataset:
    """Cached `generate` for request handling. Deterministic, so caching is free."""
    return generate(seed)
