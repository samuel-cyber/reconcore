# ReconCore backend — working rules

FastAPI + Pydantic v2 + SQLite + LiteLLM. Full spec: `../ReconCore — Technical Spec.md`
(sections 1, 3, 4, 5 are binding). The frontend in `../frontend` is already built: where its
expectations differ from the spec prose, **the frontend wins**, unless that would break a
locked decision below.

## Before finishing any task

```bash
cd backend && python3 -m pytest -q
```

Run `pytest` before finishing any task. A phase is not done until its tests pass.

## Locked decisions (do not reopen)

1. **The AI writes the story; code writes the numbers.** A seeded Python generator produces
   every row, amount and planted error. The LLM only writes the manager's brief and the
   tutor hints. **The LLM never grades and never signs.**
2. **Discrepancy definition:** `discrepancy_ngn = sum(POS sales paid by Transfer) − sum(bank credits)`.
   The duplicate waybill is graded only by its ID. This sentence appears word for word in the
   brief shown to students.
3. **Money is an integer number of Naira.** No floats anywhere. Parse with `Decimal`, store `int`.
4. **Ground truth never leaves the backend.** Not in a response body, not in a log line, not in
   a CSV, not in an LLM-authored string that reaches the client (see the leak guard).
5. **Badge format:** Open Badges 3.0–structured credential with an Ed25519 Data Integrity proof
   (`eddsa-jcs-2022`). Describe it as OB 3.0–structured, never as certified conformant.
6. **No login.** The candidate types a display name; that name goes on the badge.
7. **Demo seed:** `seed=demo` always produces identical tables, IDs and answers —
   unsettled transfer of exactly ₦45,000, `POS-1042`, `WB-3311`.

## Hard rules while coding

- `random.Random(seed)` only. The global `random` module is banned in the generator.
- Any new response field must already exist in `frontend/src/lib/api-types.ts`.
- All errors use `{"error": {"code": ..., "message": ...}}` — raise `app.core.errors.ApiError`.
- `/api/credential/verify` always returns HTTP 200, even for garbage input; a parse failure is
  `reason: "malformed"`, never a 500.
- An unparseable amount is **not** an attempt: HTTP 200, `field_status.discrepancy_ngn =
  "invalid_format"`, `attempt_no` unchanged.
- Everything must still work with no LLM API key set (template brief, template hints,
  `/health` reports `"llm": "fallback"`).
- The CSV endpoints serve the exact canonical bytes the dataset hash was computed over.

## Layout

```
app/main.py            app, CORS, routers, exception handlers, /health
app/config.py          pydantic-settings
app/schemas.py         the contract (mirrors frontend/src/lib/api-types.ts)
app/api/               session.py (init, csv, submit), credential.py (verify), issuer.py
app/generator/         scenario.py (constants), build.py (generate), messiness.py, brief.py
app/grading/           normalise.py, grade.py
app/tutor/             prompt.py, tutor.py, guard.py, templates.py
app/credentials/       keys.py, did.py, badge.py, verify.py
app/store/db.py        sqlite3, one connection per request
app/core/              canonical.py (CSV + hash), errors.py
tests/
```

## Run

```bash
uvicorn app.main:app --reload --port 8000     # from backend/
```

## Demo answers (seed=demo)

| Field | Value |
| --- | --- |
| `discrepancy_ngn` | `45000` |
| `missing_tx_id` | `POS-1042` |
| `duplicate_wb_id` | `WB-3311` |
| decoy (same amount, settled) | `POS-1049` |
| original waybill (not the answer) | `WB-3307` |
| cash-included wrong total | `201500` |
| `dataset_hash` | `sha256:272826a68605f14587361d40627e80c9654ba1a4d98c2d46a9a6cbda5e74dc82` |

## Deploy

See [../README.md](../README.md) for the full deploy steps and env tables, and
[../render.yaml](../render.yaml) for the Render blueprint.

- `python3 scripts/generate_issuer_key.py` prints a fresh `ISSUER_PRIVATE_KEY_B64`.
  Set it before issuing any badge you want to verify later — a new key is a new issuer.
- `python3 scripts/make_mocks.py` regenerates the frontend fixtures from the real
  seed=demo dataset.
- Hosted instances have an ephemeral filesystem, so the `badges` table can vanish on a
  restart. Verification therefore re-derives the dataset from the credential's own seed
  rather than depending on a database row (the signature already proves issuance).
