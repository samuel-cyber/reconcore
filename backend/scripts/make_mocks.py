#!/usr/bin/env python3
"""Regenerate frontend/src/mocks/init.json from the real seed=demo dataset.

The frontend's mock mode must show exactly what the real backend serves, so the
fixtures are generated from the live schemas rather than hand-written (SPEC 4,
"Mock mode for the frontend").

    python3 scripts/make_mocks.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app.generator import scenario as sc  # noqa: E402
from app.generator.brief import template_brief  # noqa: E402
from app.generator.build import generate  # noqa: E402

MOCKS = BACKEND.parent / "frontend" / "src" / "mocks"
# The fixture keeps a stable, recognisable session id.
FIXTURE_SESSION_ID = "ses_8f3k2m"


def build_init() -> dict:
    dataset = generate("demo")
    brief = template_brief().model_dump(by_alias=True)
    return {
        "session_id": FIXTURE_SESSION_ID,
        "scenario": {"id": sc.SCENARIO_ID, "title": sc.SCENARIO_TITLE},
        "brief": brief,
        "tables": {
            key: {
                "filename": table.filename,
                "columns": table.columns,
                "rows": table.rows,
            }
            for key, table in dataset.tables.items()
        },
        "dataset_hash": dataset.dataset_hash,
        "max_hint_level": 3,
    }


def main() -> None:
    dataset = generate("demo")
    init_path = MOCKS / "init.json"
    init_path.write_text(json.dumps(build_init(), indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {init_path.relative_to(BACKEND.parent)}")

    # Keep the pass fixture bound to the same dataset, so mock-mode verification's
    # hash check still matches.
    pass_path = MOCKS / "submit-pass.json"
    payload = json.loads(pass_path.read_text())
    payload["badge"]["evidence"][0]["reconcore:datasetHash"] = dataset.dataset_hash
    pass_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {pass_path.relative_to(BACKEND.parent)}")

    truth = dataset.ground_truth
    print(
        "demo answers: "
        f"discrepancy={truth.discrepancy_ngn} missing={truth.missing_tx_id} "
        f"duplicate={truth.duplicate_wb_id} decoy={truth.decoy_tx_id} "
        f"original={truth.original_wb_id} "
        f"cash_included_total={truth.discrepancy_ngn + truth.cash_total_ngn}"
    )


if __name__ == "__main__":
    main()
