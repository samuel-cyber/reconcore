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

from datetime import datetime, timezone  # noqa: E402

from app.credentials.badge import build_unsigned_credential, sign_credential  # noqa: E402
from app.credentials.did import issuer_profile  # noqa: E402
from app.generator import scenario as sc  # noqa: E402
from app.generator.brief import template_brief  # noqa: E402
from app.generator.build import generate  # noqa: E402
from app.schemas import SolveSummary  # noqa: E402

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

    # Keep the pass fixture and issuer fixture bound to the real dataset hash and
    # signed by the current issuer key so standalone /verify sample buttons work
    # in both mock mode and live backend mode.
    issued_at = datetime(2026, 11, 12, 8, 40, 11, tzinfo=timezone.utc)
    summary = SolveSummary(attempts=2, hints_used=1, seconds_to_solve=412)
    unsigned = build_unsigned_credential(
        candidate_name="Ada Okafor",
        seed="demo",
        dataset_hash=dataset.dataset_hash,
        summary=summary,
        issued_at=issued_at,
        credential_id="urn:uuid:7c1e9b40-8a2d-4f19-9c3b-2d6e8f1a4b90",
    )
    signed_badge = sign_credential(unsigned, created=issued_at)

    pass_path = MOCKS / "submit-pass.json"
    payload = json.loads(pass_path.read_text())
    payload["badge"] = signed_badge
    pass_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {pass_path.relative_to(BACKEND.parent)}")

    issuer_path = MOCKS / "issuer.json"
    issuer_path.write_text(
        json.dumps(issuer_profile().model_dump(), indent=2, ensure_ascii=False) + "\n"
    )
    print(f"wrote {issuer_path.relative_to(BACKEND.parent)}")

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
