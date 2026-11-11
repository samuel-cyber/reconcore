"""Alimosho scenario constants (SPEC 3).

Prices are integer Naira and chosen so that qty x price lands on round headline
amounts that more than one product can reach — that is what makes the decoy work.
"""

from __future__ import annotations

SCENARIO_ID = "alimosho-q3"
SCENARIO_TITLE = "Alimosho Retail & Logistics Crisis: Q3 Reconciliation"

MANAGER_FROM = "Mrs. Funke Adeyemi, Store Manager (Alimosho Branch)"

# name -> unit price in Naira
PRODUCTS: dict[str, int] = {
    "Peak-Milk-400g": 3750,
    "Milo-Refill-800g": 6000,
    "Indomie-Carton-70g": 7500,
    "Golden-Penny-Semovita-10kg": 12000,
    "Devon-Kings-Oil-5L": 15000,
    "Dangote-Sugar-50kg": 65000,
}
PRODUCT_NAMES = list(PRODUCTS)

CASHIERS = ["Bisi A.", "Chinedu O.", "Fatima S.", "Ngozi E."]
DRIVERS = ["Musa K.", "Tunde B.", "Sani M."]
DESTINATION = "Alimosho Branch"

# Counterparties used in bank narrations only (never part of grading).
COUNTERPARTIES = [
    "ADEWALE STORES",
    "NKECHI ENT",
    "IYABO CATERING",
    "ADEBAYO BAKERY",
    "OKONKWO TRADERS",
    "OLUWASEUN MART",
    "BALOGUN FOODS",
    "KEMI SUPERSTORE",
    "DANJUMA PROVISIONS",
    "EZEKIEL MINI MART",
    "CHIOMA VENTURES",
    "YUSUF GENERAL GOODS",
    "FOLAKE FOODS",
    "OBINNA SUPPLIES",
]

PAYMENT_METHODS = ["Transfer", "Cash", "POS Card"]
PAYMENT_WEIGHTS = [0.5, 0.3, 0.2]

TX_ID_BASE = 1038  # POS-1038 ...
WB_ID_BASE = 3301  # WB-3301 ...
BANK_REF_BASE = 551810  # GTB-551810 ...
CUSTOMER_REF_BASE = 88104  # TRF-88104 ...

TABLE_COLUMNS: dict[str, list[str]] = {
    "pos": [
        "tx_id",
        "date",
        "cashier",
        "product",
        "qty",
        "amount",
        "payment_method",
        "customer_ref",
    ],
    "waybills": [
        "wb_id",
        "date",
        "product",
        "qty_dispatched",
        "destination",
        "driver",
    ],
    "bank": ["bank_ref", "value_date", "narration", "credit_amount"],
}

TABLE_FILENAMES: dict[str, str] = {
    "pos": "pos_sales_log.csv",
    "waybills": "warehouse_waybills.csv",
    "bank": "bank_settlement.csv",
}

MAX_QTY = 8
MAX_LINE_AMOUNT = 90_000


def _headline_candidates() -> list[int]:
    """Amounts at least two different products can hit exactly, within sane bounds."""
    by_amount: dict[int, set[str]] = {}
    for name, price in PRODUCTS.items():
        for qty in range(1, 13):
            amount = price * qty
            if 12_000 <= amount <= MAX_LINE_AMOUNT:
                by_amount.setdefault(amount, set()).add(name)
    return sorted(a for a, names in by_amount.items() if len(names) >= 2)


HEADLINE_AMOUNTS = _headline_candidates()


def combos_for_amount(amount: int) -> list[tuple[str, int]]:
    """(product, qty) pairs whose line total is exactly `amount`, in catalogue order."""
    out: list[tuple[str, int]] = []
    for name, price in PRODUCTS.items():
        if amount % price == 0:
            qty = amount // price
            if 1 <= qty <= 12:
                out.append((name, qty))
    return out


# --- Demo pin (locked decision 7) -------------------------------------------------
# seed="demo" must always yield the same tables, IDs and answers: an unsettled transfer
# of exactly N45,000 as POS-1042, duplicate waybill WB-3311, decoy POS-1049. Only these
# structural choices are pinned; every value in the tables still comes from
# random.Random("demo"), and every other seed is fully random.
DEMO_PLAN = {
    "n_pos": 19,
    "n_waybills": 14,  # + the planted copy = 15 rows
    "headline_amount": 45_000,
    "unsettled_row": 4,  # -> POS-1042
    "decoy_row": 11,  # -> POS-1049
    "unsettled_combo": ("Peak-Milk-400g", 12),
    "decoy_combo": ("Devon-Kings-Oil-5L", 3),
    "dup_source_index": 6,  # -> WB-3307
    "dup_insert_index": 10,  # -> WB-3311
}
