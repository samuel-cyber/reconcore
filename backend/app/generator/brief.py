"""The manager's brief: LLM-written with a hand-written template fallback (SPEC 5.3).

`task_definitions` is always hard-coded, never LLM text. The discrepancy definition
appears word for word, exactly as locked decision 2 requires. No number from the answer
is ever passed to the LLM or written into the brief.
"""

from __future__ import annotations

import json
import logging

from app.generator import scenario as sc
from app.schemas import BriefInfo
from app.store.db import db

log = logging.getLogger("reconcore.brief")

DISCREPANCY_DEFINITION = (
    "discrepancy_ngn = sum(POS sales paid by Transfer) − sum(bank credits). "
    "The duplicate waybill is graded only by its ID."
)

# One line per task, in the order the UI lists them (discrepancy, missing transaction,
# duplicate waybill).
TASK_DEFINITIONS = [
    DISCREPANCY_DEFINITION,
    "Report the tx_id of the Transfer sale that has no matching bank credit. Match each "
    "transfer by its customer_ref inside the bank narration, not by its amount. Cash and "
    "POS Card sales never appear in bank_settlement.csv.",
    "Report the ID of the duplicate waybill entry (the second, later-listed copy with "
    "the typo), not the original.",
]

TEMPLATE_BODY = (
    "Welcome to the Alimosho Q3 audit desk. Before we close the October books for head "
    "office, our external auditors flagged two operational anomalies across our cashier "
    "point-of-sale logs, warehouse dispatch waybills, and GTBank settlement statement.\n\n"
    "First, one customer transfer logged at the till never settled into our GTBank "
    "corporate account. Remember that **Cash** and **POS Card** sales are reconciled "
    "through a separate physical till and processor ledger—they never appear in the bank "
    "transfer statement. Be careful: more than one transfer may share the same Naira "
    "value, so verify each transfer using its unique `customer_ref` inside the bank "
    "narration.\n\n"
    "Second, a warehouse clerk accidentally logged the same stock delivery twice under "
    "two different waybill IDs, introducing a slight product-name typo and a different "
    "date format on the second entry. Report the ID of the duplicate entry, not the "
    "original.\n\n" + DISCREPANCY_DEFINITION
)


def template_brief() -> BriefInfo:
    return BriefInfo(
        **{
            "from": sc.MANAGER_FROM,
            "body_markdown": TEMPLATE_BODY,
            "task_definitions": list(TASK_DEFINITIONS),
        }
    )


def _cached_brief(seed: str) -> BriefInfo | None:
    with db() as conn:
        row = conn.execute(
            "SELECT brief_json FROM brief_cache WHERE seed = ?", (seed,)
        ).fetchone()
    if not row:
        return None
    try:
        return BriefInfo.model_validate(json.loads(row["brief_json"]))
    except Exception:  # pragma: no cover - corrupt cache row
        return None


def _cache_brief(seed: str, brief: BriefInfo) -> None:
    with db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO brief_cache (seed, brief_json) VALUES (?, ?)",
            (seed, json.dumps(brief.model_dump(by_alias=True))),
        )


# The LLM-written body carries no seed-specific fact, so it is written once per process
# (at startup, off the request path) and reused for every seed. `/api/session/init`
# never waits on a model.
LLM_BODY_KEY = "__llm_body__"


def _cached_llm_body() -> str | None:
    with db() as conn:
        row = conn.execute(
            "SELECT brief_json FROM brief_cache WHERE seed = ?", (LLM_BODY_KEY,)
        ).fetchone()
    if not row:
        return None
    try:
        body = json.loads(row["brief_json"]).get("body")
    except Exception:  # pragma: no cover - corrupt cache row
        return None
    return body if isinstance(body, str) and body.strip() else None


def prewarm_llm_brief() -> bool:
    """Ask the LLM for the manager's message once and keep it. Safe to call repeatedly;
    returns True when an LLM-written body is available afterwards."""
    if _cached_llm_body() is not None:
        return True
    try:
        from app.generator.llm_brief import llm_brief_body

        body = llm_brief_body()
    except Exception as exc:  # pragma: no cover - any LLM failure keeps the template
        log.warning("brief generation fell back to the template: %s", exc)
        return False
    if not body:
        return False
    with db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO brief_cache (seed, brief_json) VALUES (?, ?)",
            (LLM_BODY_KEY, json.dumps({"body": body})),
        )
    return True


def get_brief(seed: str) -> BriefInfo:
    """Cached per seed in SQLite. Uses the LLM-written body when one is ready and it
    passes the leak guard for this seed; otherwise the hand-written template. Never
    calls a model itself."""
    cached = _cached_brief(seed)
    if cached is not None:
        return cached

    brief = template_brief()
    body = _cached_llm_body()
    if body is not None:
        from app.generator.build import load_dataset
        from app.tutor.guard import leaks

        if leaks(body, load_dataset(seed).ground_truth) is None:
            brief = BriefInfo(
                **{
                    "from": sc.MANAGER_FROM,
                    "body_markdown": body + "\n\n" + DISCREPANCY_DEFINITION,
                    "task_definitions": list(TASK_DEFINITIONS),
                }
            )
        # Only pin the choice once the LLM body exists, so sessions started while the
        # startup call is still running do not freeze the template in for this seed.
        _cache_brief(seed, brief)
    return brief
