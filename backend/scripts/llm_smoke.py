#!/usr/bin/env python3
"""Ten real hint generations against the demo wrong answers (steps 4 and 7).

Measures p50/max latency at the configured reasoning effort and asserts that not one
hint leaks the demo answers (45000 / 45,000 / POS-1042 / WB-3311 / POS-1049).

    cd backend
    LLM_API_KEY=<your Meta MODEL_API_KEY> python3 scripts/llm_smoke.py
    LLM_API_KEY=... LLM_FALLBACK_MODEL=openai/<id> LLM_FALLBACK_API_KEY=... \
        python3 scripts/llm_smoke.py --runs 10

Exits non-zero if any hint leaks, or if no hint came from a model at all.
"""

from __future__ import annotations

import argparse
import statistics
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import get_settings  # noqa: E402
from app.generator.brief import template_brief  # noqa: E402
from app.generator.build import generate  # noqa: E402
from app.grading.grade import grade  # noqa: E402
from app.schemas import FieldStatusMap  # noqa: E402
from app.store.db import init_db  # noqa: E402
from app.store.sessions import SessionRecord  # noqa: E402
from app.tutor.guard import leaks  # noqa: E402
from app.tutor.llm import llm_hint_text, probe_primary  # noqa: E402

DEMO = generate("demo")
TRUTH = DEMO.ground_truth
BANNED = ["45000", "45,000", "POS-1042", "WB-3311", "POS-1049"]

# The wrong answers from the demo script: the decoy transaction, the original waybill,
# and a total that includes cash.
WRONG_SUBMISSIONS = [
    (TRUTH.discrepancy_ngn + TRUTH.cash_total_ngn, TRUTH.decoy_tx_id, TRUTH.duplicate_wb_id),
    (TRUTH.discrepancy_ngn + TRUTH.cash_total_ngn, TRUTH.decoy_tx_id, TRUTH.original_wb_id),
    (TRUTH.discrepancy_ngn, TRUTH.decoy_tx_id, TRUTH.original_wb_id),
    (TRUTH.discrepancy_ngn * 2, "POS-9999", "WB-9999"),
    (TRUTH.discrepancy_ngn + 500, TRUTH.missing_tx_id, TRUTH.original_wb_id),
]


def session() -> SessionRecord:
    return SessionRecord(
        id="ses_smoke0",
        seed="demo",
        candidate_name="Smoke Test",
        ground_truth=TRUTH,
        dataset_hash=DEMO.dataset_hash,
        brief=template_brief(),
        created_at=datetime.now(timezone.utc),
        solved_at=None,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--runs", type=int, default=10)
    args = parser.parse_args()

    init_db()
    settings = get_settings()
    if not settings.llm_available:
        print("No LLM provider configured. Set LLM_API_KEY (and optionally the")
        print("LLM_FALLBACK_* variables) and run again.")
        raise SystemExit(2)

    print(f"primary   : {settings.llm_model} @ {settings.llm_api_base}")
    print(
        f"fallback  : {settings.llm_fallback_model or '(none)'}"
        + (f" @ {settings.llm_fallback_api_base}" if settings.fallback_llm_configured else "")
    )
    print(f"effort    : {settings.llm_reasoning_effort}")
    print(f"timeout_s : {settings.llm_timeout_s}")

    probe_start = time.perf_counter()
    up = probe_primary()
    print(f"probe     : {'up' if up else 'FAILED'} in {time.perf_counter() - probe_start:.2f}s")
    print()

    record = session()
    latencies: list[float] = []
    leaked: list[tuple[int, str, str]] = []
    hints: list[tuple[int, str, str, float]] = []
    template_fallbacks = 0

    for i in range(args.runs):
        amount, tx_id, wb_id = WRONG_SUBMISSIONS[i % len(WRONG_SUBMISSIONS)]
        result = grade(
            truth=TRUTH, discrepancy_ngn=amount, missing_tx_id=tx_id, duplicate_wb_id=wb_id
        )
        level = (i % 3) + 1

        started = time.perf_counter()
        drafted = llm_hint_text(
            session=record,
            status=FieldStatusMap(**result.field_status).model_dump(),
            diagnostics=result.diagnostics,
            level=level,
        )
        elapsed = time.perf_counter() - started
        latencies.append(elapsed)

        if drafted is None:
            template_fallbacks += 1
            print(f"{i + 1:2}. [{elapsed:5.2f}s] (no model hint — template would be served)")
            continue

        text, model = drafted
        hints.append((level, model, text, elapsed))
        offending = leaks(text, TRUTH) or next((b for b in BANNED if b in text), None)
        if offending:
            leaked.append((i + 1, offending, text))
        flag = f"LEAK<{offending}>" if offending else "clean"
        print(f"{i + 1:2}. [{elapsed:5.2f}s] L{level} {model} {flag}: {text}")

    print()
    print(f"runs                : {args.runs}")
    print(f"hints from a model  : {len(hints)}")
    print(f"template fallbacks  : {template_fallbacks}")
    if latencies:
        ordered = sorted(latencies)
        print(f"latency p50         : {statistics.median(ordered):.2f}s")
        print(f"latency p95         : {ordered[max(0, int(len(ordered) * 0.95) - 1)]:.2f}s")
        print(f"latency max         : {max(ordered):.2f}s")
        print(f"latency mean        : {statistics.fmean(ordered):.2f}s")
        over = [round(v, 2) for v in ordered if v > settings.llm_timeout_s]
        print(f"over LLM_TIMEOUT_S  : {len(over)} {over if over else ''}")
    print(f"leaks               : {len(leaked)}")
    for index, term, text in leaked:
        print(f"  call {index}: leaked {term!r} -> {text}")

    if hints:
        print("\n--- three sample hints ---")
        for level, model, text, elapsed in hints[:3]:
            print(f"[level {level} · {model} · {elapsed:.2f}s] {text}")

    if leaked:
        raise SystemExit(1)
    if not hints:
        print("\nNo model produced a hint; nothing was exercised.")
        raise SystemExit(3)


if __name__ == "__main__":
    main()
