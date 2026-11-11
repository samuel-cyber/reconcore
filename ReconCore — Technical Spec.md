# ReconCore — Technical Spec

Nov 11, 2026 · @Samuel

## 1. Overview and ownership

ReconCore ships tomorrow morning as one Next.js frontend talking to one FastAPI backend over a frozen JSON contract (section 4). Samuel owns the backend; the frontend teammate owns the UI. Both sides build against the contract from hour one, so neither blocks the other.

| Area | Owner | Done when |
| --- | --- | --- |
| Data generator, grading, tutor, badges, storage, deploy | Samuel (backend) | `seed=demo` loop passes end to end on the deployed URL |
| Workspace UI, data viewer, submission form, tutor drawer, badge modal | Teammate (frontend) | Same loop works by clicking, against the deployed backend |
| API contract (`schemas.py` + `/openapi.json`) | Samuel writes, both sign off | Frozen by 18:00 tonight; changes only by agreement |
| Demo script, pitch, submission form | Both | Rehearsed twice on the deployed build |

### Decisions locked (do not reopen tonight)

1. **The AI writes the story; code writes the numbers.** A seeded Python generator produces every row, amount and planted error. The LLM only writes the manager's brief and the tutor hints.
2. **Discrepancy definition:** `discrepancy_ngn = sum(POS sales paid by Transfer) − sum(bank credits)`. The duplicate waybill is graded only by its ID. This sentence appears word for word in the brief shown to students.
3. **Money is an integer number of Naira.** No floats anywhere, backend or frontend.
4. **Ground truth never leaves the backend.** No response body, log line sent to the client, or CSV contains it.
5. **Badge format:** Open Badges 3.0–structured credential with an Ed25519 Data Integrity proof (`eddsa-jcs-2022`). We describe it as OB 3.0–structured, not certified conformant.
6. **No login.** The candidate types a display name on the start screen; that name goes on the badge.
7. **Demo seed:** `seed=demo` always produces identical tables, IDs and answers.

## 2. System architecture

&#91;embedded content: ReconCore architecture · frontend, 6 backend modules, 3 external dependencies\]

The generator builds the tables and the hidden answer; grading decides pass or fail by exact match; a failed attempt goes to the tutor, a passed one to the credential signer. The LLM never touches the grade or the signature.

## 3. Scenario and data spec

The featured scenario is "Alimosho Retail & Logistics Crisis: Q3 Reconciliation": three tables of 15–25 rows, two planted errors, one decoy, and a unique correct answer for every seed.

### Tables (column order is fixed; it is part of the dataset hash)

**`pos_sales_log.csv`**

| Column | Example | Messiness allowed |
| --- | --- | --- |
| `tx_id` | `POS-1042` | none (IDs stay clean) |
| `date` | `14/10/2026`, `2026-10-14`, `Oct 14 2026` | mixed formats |
| `cashier` | `Bisi A.` | trailing spaces, casing |
| `product` | `Peak-Milk-400g` | casing |
| `qty` | `6` | none |
| `amount` | `₦45,000`, `45000`, `45,000.00` | mixed formats |
| `payment_method` | `Transfer`, `Cash`, `POS Card` | casing (`transfer`, `TRANSFER`) |
| `customer_ref` | `TRF-88213` (transfers only) | blank for cash |

**`warehouse_waybills.csv`**

| Column | Example | Messiness allowed |
| --- | --- | --- |
| `wb_id` | `WB-3307` | none |
| `date` | mixed formats | mixed formats |
| `product` | `Peak-Milk-400g` | the one planted typo |
| `qty_dispatched` | `24` | none |
| `destination` | `Alimosho Branch` | casing, spaces |
| `driver` | `Musa K.` | spaces |

**`bank_settlement.csv`**

| Column | Example | Messiness allowed |
| --- | --- | --- |
| `bank_ref` | `GTB-551902` | none |
| `value_date` | mixed formats | mixed formats |
| `narration` | `TRF FROM ADEBAYO/TRF-88213` | uppercase bank style |
| `credit_amount` | `45000.00` | mixed formats |

### Planted errors (the ground truth)

1. **Unsettled transfer:** one POS row with `payment_method = Transfer` has no bank credit whose narration contains its `customer_ref`. Its `tx_id` is `missing_tx_id`.
2. **Fuzzy duplicate waybill:** one waybill row is copied with a one-letter product typo (`Peak-Mlk-400g`) and a different date format. The **second** (later-listed) copy's `wb_id` is `duplicate_wb_id`. The brief states "report the ID of the duplicate entry, not the original".
3. **Decoy (not an error):** a different, legitimately settled transfer has the **same amount** as the unsettled one. Students matching on amount alone pick the wrong `tx_id`; matching on `customer_ref` is correct.

### Ground truth computation

```
discrepancy_ngn = sum(amount for POS rows where payment_method.lower() == "transfer")
                - sum(credit_amount for all bank rows)
```

The generator builds the bank table so that this equals exactly the unsettled transfer's amount. Cash and card sales never appear in the bank table, and the brief says so.

### Generator invariants (each one is a pytest test over 200 random seeds)

- Exactly one transfer sale has no matching bank credit.
- Exactly one pair of waybills differs only by a product-name edit distance of 1–2 and date format.
- The decoy amount equals the unsettled amount, and the decoy's `tx_id` is not `missing_tx_id`.
- `discrepancy_ngn` equals the unsettled sale's amount and is positive.
- All IDs are unique within their table.
- `generate("demo")` returns byte-identical canonical CSVs on every run.

## 4. API contract

All endpoints are JSON under `/api`, served by FastAPI with CORS open to the frontend's origin. The source of truth is `backend/app/schemas.py`; the frontend generates types from `GET /openapi.json` with `npx openapi-typescript <BACKEND_URL>/openapi.json -o src/lib/api-types.ts`. Errors always use `{ "error": { "code": "...", "message": "..." } }`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Liveness check: `{ "ok": true, "llm": "up" or "fallback" }` |
| POST | `/api/session/init` | Start a session and return the brief + tables |
| GET | `/api/session/{session_id}/csv/{table}` | Download one canonical CSV (`pos`, `waybills`, `bank`) |
| GET | `/api/session/{session_id}/csv.zip` | Download all three CSVs |
| POST | `/api/session/submit` | Grade an attempt; returns hint or badge |
| POST | `/api/credential/verify` | Verify a badge's signature and dataset hash |
| GET | `/api/issuer` | Issuer profile and public key |

### POST `/api/session/init`

Request:

```json
{ "seed": "demo", "candidate_name": "Ada Okafor" }
```

`seed` is optional (random when omitted). `candidate_name` is 1–60 characters.

Response `200`:

```json
{
  "session_id": "ses_8f3k2m",
  "scenario": { "id": "alimosho-q3", "title": "Alimosho Retail & Logistics Crisis: Q3 Reconciliation" },
  "brief": { "from": "Mrs. Funke Adeyemi, Store Manager", "body_markdown": "...", "task_definitions": ["Total Net Discrepancy = ..."] },
  "tables": {
    "pos":      { "filename": "pos_sales_log.csv",      "columns": ["tx_id", "date", "..."], "rows": [["POS-1042", "14/10/2026", "..."]] },
    "waybills": { "filename": "warehouse_waybills.csv", "columns": ["..."], "rows": [["..."]] },
    "bank":     { "filename": "bank_settlement.csv",    "columns": ["..."], "rows": [["..."]] }
  },
  "dataset_hash": "sha256:4be1...",
  "max_hint_level": 3
}
```

Rows are arrays of **strings exactly as they appear in the CSV**, including the mess. The frontend never cleans or reformats them.

### POST `/api/session/submit`

Request:

```json
{ "session_id": "ses_8f3k2m", "discrepancy_ngn": "45,000", "missing_tx_id": "POS-1042", "duplicate_wb_id": "WB-3311" }
```

`discrepancy_ngn` is sent as a **string** so the backend owns all parsing (`₦45,000`, `45000`, `45,000.00` all accepted). IDs match `^[A-Za-z0-9-]{1,20}$` after trimming.

Response `200` (failed attempt):

```json
{
  "passed": false,
  "attempt_no": 1,
  "field_status": { "discrepancy_ngn": "incorrect", "missing_tx_id": "incorrect", "duplicate_wb_id": "correct" },
  "tutor_hint": { "level": 1, "text": "Which payment methods should ever reach the bank statement?", "source": "llm" },
  "badge": null
}
```

Response `200` (passed):

```json
{
  "passed": true,
  "attempt_no": 2,
  "field_status": { "discrepancy_ngn": "correct", "missing_tx_id": "correct", "duplicate_wb_id": "correct" },
  "tutor_hint": null,
  "badge": { "...": "full OB 3.0 credential, see section 5.6" },
  "summary": { "attempts": 2, "hints_used": 1, "seconds_to_solve": 412 }
}
```

`tutor_hint.source` is `llm` or `template` (the UI may show a small "offline hint" tag for `template`). Errors: `404 session_not_found`, `409 already_solved`, `422 invalid_input`.

### POST `/api/credential/verify`

Request: `{ "badge": { ...the credential JSON... } }`

Response `200` (always 200, even when invalid):

```json
{ "valid": false, "signature_verified": false, "hash_match": true, "issuer_match": true, "reason": "signature_invalid", "checked_at": "2026-11-12T08:40:11Z" }
```

`reason` is one of `null`, `signature_invalid`, `hash_unknown`, `issuer_unknown`, `malformed`. `valid` is true only when all three checks pass.

### GET `/api/issuer`

```json
{ "id": "did:key:z6Mk...", "name": "ReconCore", "public_key_multibase": "z6Mk...", "verification_method": "did:key:z6Mk...#z6Mk..." }
```

### Mock mode for the frontend

Until the real backend is deployed, the frontend reads fixtures from `frontend/src/mocks/` (`init.json`, `submit-fail.json`, `submit-pass.json`, `verify-valid.json`, `verify-invalid.json`). Samuel generates these from the real schemas by 18:00 and commits them. A single env flag `NEXT_PUBLIC_USE_MOCKS=true` switches the API client to fixtures.

## 5. Backend spec (Samuel)

The backend is Python 3.11+, FastAPI, Pydantic v2, SQLite and LiteLLM, split into six modules that each have their own tests. Claude Code builds it phase by phase from a `CLAUDE.md` holding sections 1, 3 and 4 of this doc.

### 5.1 Layout and dependencies

```
backend/
  app/
    main.py            # app, CORS, routers, exception handlers
    config.py          # pydantic-settings, reads .env
    schemas.py         # every request/response model (the contract)
    api/session.py     # init, csv, submit
    api/credential.py  # verify
    api/issuer.py      # issuer profile
    generator/scenario.py  # Alimosho constants: products, prices, cashiers, drivers
    generator/build.py     # generate(seed) -> Dataset
    generator/messiness.py # date/amount/casing formatters
    generator/brief.py     # LLM brief + cached template fallback
    grading/normalise.py
    grading/grade.py
    tutor/prompt.py
    tutor/tutor.py
    tutor/guard.py
    tutor/templates.py
    credentials/keys.py
    credentials/did.py
    credentials/badge.py
    credentials/verify.py
    store/db.py
    core/canonical.py
  tests/
  keys/              # gitignored
  pyproject.toml
  .env.example
  CLAUDE.md
```

Dependencies: `fastapi`, `uvicorn[standard]`, `pydantic>=2`, `pydantic-settings`, `litellm`, `cryptography`, `base58`, `pytest`, `httpx` (test client).

### 5.2 Config (`.env`)

| Variable | Example | Purpose |
| --- | --- | --- |
| `LLM_MODEL` | `gemini/gemini-2.5-flash` | LiteLLM model string |
| `GEMINI_API_KEY` | `...` | LLM key (or `OPENAI_API_KEY`) |
| `LLM_TIMEOUT_S` | `5` | Hard timeout before template fallback |
| `ISSUER_PRIVATE_KEY_B64` | `...` | Ed25519 private key, raw 32 bytes, base64 |
| `DB_PATH` | `./reconcore.db` | SQLite file |
| `CORS_ORIGINS` | `http://localhost:3000,https://reconcore.vercel.app` | Allowed frontend origins |
| `PUBLIC_BASE_URL` | `https://reconcore-api.onrender.com` | Used in badge `id` and issuer URLs |

### 5.3 Generator

- `generate(seed: str) -> Dataset` uses `rng = random.Random(seed)` only; the global `random` is banned.
- Step 1 builds a clean world: 18–22 POS sales across about 6 products with fixed prices; every Transfer sale gets a matching bank credit carrying its `customer_ref` in the narration.
- Step 2 injects faults: remove one transfer's bank credit; pick a second transfer with the same amount as the decoy (adjust its qty/price to match); copy one waybill with a product typo and a reformatted date, inserted a few rows later.
- Step 3 applies messiness to the display strings only. Internal values stay typed (`int` Naira, `date`).
- `Dataset` holds `tables` (columns + string rows), `ground_truth` (`discrepancy_ngn: int`, `missing_tx_id: str`, `duplicate_wb_id: str`, `decoy_tx_id: str`) and `canonical_csv` bytes per table.
- `brief.py` asks the LLM for a 120–180 word manager's message given the scenario facts (no numbers from the answer). The result is cached per seed in SQLite; on any failure it uses a hand-written template. The `task_definitions` list is always hard-coded, never LLM text.

### 5.4 Canonical CSV and dataset hash

- Fixed column order, comma separator, `\n` line endings, UTF-8 without BOM, minimal quoting (`csv.QUOTE_MINIMAL`).
- `dataset_hash = "sha256:" + sha256(pos_bytes + b"\x1e" + waybills_bytes + b"\x1e" + bank_bytes).hexdigest()`.
- The CSV download endpoints serve these exact bytes, so the hash in the badge provably matches the files the candidate downloaded.

### 5.5 Grading and normalisation

- `parse_naira(s)`: strip whitespace, `₦`, `NGN`, `N` prefix, commas; parse with `Decimal`; reject if not a whole number or negative; return `int`. Failure returns field status `invalid_format`, which is not counted as an attempt.
- `normalise_id(s)`: strip, uppercase. Compare to the ground-truth ID uppercased.
- `grade()` returns per-field `correct | incorrect` plus private diagnostics for the tutor: `delta = submitted − truth`, `hit_decoy` (submitted tx is the decoy), `picked_original_waybill` (submitted the first copy), `included_cash` (submitted equals the transfer gap plus cash total).
- Every attempt is written to `attempts` before responding.

### 5.6 Credentials

**Keys and identity.** On startup, load `ISSUER_PRIVATE_KEY_B64`; if missing, generate a key, write it to `keys/issuer.key`, and log a warning to copy it into the host's env. The issuer is a `did:key`: multibase `z` + base58btc of bytes `0xed 0x01` + the 32-byte public key.

**Credential shape (unsigned):**

```json
{
  "@context": ["https://www.w3.org/ns/credentials/v2", "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json"],
  "id": "urn:uuid:7c1e...",
  "type": ["VerifiableCredential", "OpenBadgeCredential"],
  "issuer": { "id": "did:key:z6Mk...", "type": ["Profile"], "name": "ReconCore" },
  "validFrom": "2026-11-12T08:40:11Z",
  "name": "Multi-Source Financial Reconciliation",
  "credentialSubject": {
    "type": ["AchievementSubject"],
    "name": "Ada Okafor",
    "achievement": {
      "id": "urn:reconcore:achievement:reconciliation-l1",
      "type": ["Achievement"],
      "name": "Multi-Source Financial Reconciliation — Level 1",
      "description": "Reconciled POS, warehouse and bank records to find an unsettled transfer and a duplicate waybill.",
      "criteria": { "narrative": "Exact match on discrepancy amount, missing transaction ID and duplicate waybill ID, graded by deterministic code." }
    },
    "result": [{ "type": ["Result"], "value": "3/3 exact" }]
  },
  "evidence": [{
    "type": ["Evidence"],
    "name": "Alimosho Q3 reconciliation attempt",
    "description": "Solved in 2 attempts with 1 hint in 412 seconds.",
    "reconcore:datasetHash": "sha256:4be1...",
    "reconcore:seed": "demo",
    "reconcore:attempts": 2,
    "reconcore:hintsUsed": 1
  }]
}
```

**Signing (`eddsa-jcs-2022`).**

1. Build the `proof` options: `type: "DataIntegrityProof"`, `cryptosuite: "eddsa-jcs-2022"`, `created`, `verificationMethod: "<did>#<multibase>"`, `proofPurpose: "assertionMethod"`.
2. Canonicalise the options and the unsigned credential with JCS. For our data (strings, ints, nested objects; no floats) this is `json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()`.
3. `hash_data = sha256(canon(options)) + sha256(canon(credential))`.
4. `proofValue = "z" + base58btc(ed25519_sign(hash_data))`; attach `proof` with `proofValue`.

**Verification.** Remove `proof`, recompute `hash_data` with the proof options minus `proofValue`, verify with the public key resolved from `verificationMethod` (only our own did:key is trusted, otherwise `issuer_unknown`). Then `hash_match`: the evidence hash exists in the `badges` table **and** `generate(seed)` still hashes to it. Any parse error returns `malformed`, never a 500.

### 5.7 Socratic tutor

- **Prompt inputs:** scenario summary, task definitions, ground truth, submitted values, field status, diagnostics, attempt number, hint level, and the hint ladder below.
- **Hint ladder:**

| Level (attempt) | Discrepancy | Missing tx | Duplicate waybill |
| --- | --- | --- | --- |
| 1 | Which payment methods should reach the bank at all? | Which table should every transfer show up in? | Which table records physical stock moving? |
| 2 | Compare transfer sales against credits, not all sales. | Match on the customer reference, not the amount. | Look for two rows that are the same delivery written differently. |
| 3+ | Check the dates in October; one transfer has no partner. | Two transfers share an amount; only one is in the bank. | Product names can be misspelled; normalise dates before comparing. |

- **System rules:** never state the correct amount, never state any correct ID, at most 2 sentences, end with one question, only address fields marked incorrect, English that a Nigerian undergraduate reads easily.
- **Leak guard (`guard.py`):** reject the LLM output if it contains the truth amount in any form (`45000`, `45,000`, `45k`, `45 thousand`), the correct `tx_id` or `wb_id` (case-insensitive), or the decoy's ID. On rejection, retry once with a stricter reminder, then fall back to the matching template from the ladder.
- **Timeout:** `LLM_TIMEOUT_S`; any exception goes to the template with `source: "template"`.
- **Injection surface:** only one amount string and two IDs constrained by regex reach the prompt, wrapped in `<submission>` tags, so free-text injection is designed out.

### 5.8 Storage (SQLite)

| Table | Columns |
| --- | --- |
| `sessions` | `id`, `seed`, `candidate_name`, `ground_truth_json`, `dataset_hash`, `brief_json`, `created_at`, `solved_at` |
| `attempts` | `id`, `session_id`, `attempt_no`, `submitted_json`, `field_status_json`, `hint_level`, `hint_source`, `created_at` |
| `badges` | `id` (urn), `session_id`, `dataset_hash`, `seed`, `credential_json`, `issued_at` |
| `brief_cache` | `seed`, `brief_json` |

Use plain `sqlite3` with one connection per request; create tables on startup.

### 5.9 Tests (must pass before each phase is marked done)

- `test_generator.py`: all invariants from section 3 over 200 seeds, plus demo determinism.
- `test_normalise.py`: `₦45,000`, `45000`, `45,000.00`, `NGN 45000` → 45000; `45,000.50`, `-45000`, `abc` rejected.
- `test_grading.py`: correct answer, decoy answer, original-waybill answer, cash-included answer each give the right status and diagnostics.
- `test_credentials.py`: sign then verify is valid; changing one character of `name` gives `signature_invalid`; an unknown hash gives `hash_unknown`; key survives restart.
- `test_guard.py`: a hint containing "45,000" or the tx ID is blocked and replaced by a template.
- `test_api.py`: full demo loop through `TestClient`: init → wrong submit → hint → right submit → badge → verify valid → tamper → verify invalid.

### 5.10 Working with Claude Code

1. Put sections 1, 3, 4 and 5 into `backend/CLAUDE.md`, plus: "run `pytest` before finishing any task; never put ground truth in a response; money is int".
2. Turn off co-author attribution in `.claude/settings.json` before the first commit.
3. Phase order: scaffold + schemas + mocks → generator + canonical → grading → credentials → tutor → storage + CSV endpoints → deploy. Use plan mode for generator and credentials.
4. After each phase: run tests, commit, push. Never let a phase sit uncommitted overnight.

## 6. Frontend spec (teammate)

The frontend is a single-page Next.js app (App Router, TypeScript, Tailwind, Lucide) with one start screen and one workspace; all logic lives in the backend, so the UI only renders and sends what the contract defines.

### 6.1 Layout

```
frontend/src/
  app/page.tsx              # start screen
  app/workspace/page.tsx    # split-pane workspace (session from context)
  app/verify/page.tsx       # standalone verifier: paste or upload badge JSON
  lib/api.ts                # typed client; switches to mocks via NEXT_PUBLIC_USE_MOCKS
  lib/api-types.ts          # generated from /openapi.json, never hand-edited
  mocks/*.json              # fixtures from Samuel
  components/BriefPanel.tsx
  components/SubmissionForm.tsx
  components/DataViewer.tsx
  components/TutorDrawer.tsx
  components/BadgeModal.tsx
  components/VerifyResult.tsx
```

Env: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_USE_MOCKS`.

### 6.2 Screens

**Start screen (`/`).** Product name, one-line pitch, a name field, a "Start simulation" button. A hidden "demo mode" toggle (or `/?seed=demo`) sends `seed: "demo"`. On success, store the init response in state and route to `/workspace`.

**Workspace (`/workspace`).** Three columns at ≥1280 px; on narrower screens the tutor becomes a bottom sheet.

| Panel | Contents | Behaviour |
| --- | --- | --- |
| Left (about 28%) | `BriefPanel` (from, body markdown, task definitions in a highlighted box) above `SubmissionForm` | Brief scrolls; form stays pinned at the bottom |
| Centre (about 52%) | `DataViewer`: tabs POS Logs, Warehouse Waybills, Bank Statements; search box; row count; "Download CSVs" | Table shows raw strings, monospace for IDs and amounts, sticky header, zebra rows |
| Right (about 20%) | `TutorDrawer`: attempt counter, list of hints newest first, field status chips | Opens automatically on a failed attempt |

**Verifier (`/verify`).** A textarea plus file upload for badge JSON and a "Verify" button; renders `VerifyResult`. This is the "employer" view and must work without a session.

### 6.3 Component rules

- **DataViewer:** search filters rows where any cell contains the query, case-insensitive. Never reformat dates or amounts; the mess is the task. Download calls `GET /api/session/{id}/csv.zip` (one button) and also offers per-table links.
- **SubmissionForm:** three inputs (`Total net discrepancy (₦)`, `Missing bank settlement transaction ID`, `Duplicated warehouse waybill ID`). The amount field is a text input, sent as typed. Submit is disabled while a request is in flight. After a response, each field shows a green or red border from `field_status`; correct fields lock.
- **TutorDrawer:** each hint shows level and text; `source: "template"` adds a small grey "offline hint" tag. Never show a hint before the first failed attempt.
- **BadgeModal (on `passed: true`):**
  - Badge card: achievement name, candidate name, issued date, attempts and hints from `summary`, short dataset hash.
  - "View raw credential" toggle showing pretty-printed JSON with a copy button and a "Download badge.json" button.
  - "Simulate employer verification" button: posts the badge to `/api/credential/verify` and shows `VerifyResult`.
  - "Tamper test" button: changes `credentialSubject.name` in a copy (for example appends " (edited)"), verifies it, and shows the red result beside the green one.
- **VerifyResult:** green panel "Cryptographically verified — tamper proof" when `valid`; red panel naming the failed check from `reason` otherwise. Show the three checks (signature, dataset hash, issuer) as separate ticks.

### 6.4 State and API client

- One React context holds `session` (init response), `attempts[]`, `badge`. No global store library needed.
- `lib/api.ts` exports `initSession`, `submitAttempt`, `verifyBadge`, `getIssuer`, `csvZipUrl`. Each returns the generated type or throws an `ApiError` with `code` and `message`.
- Show backend errors as a toast; `409 already_solved` reopens the badge modal.
- First load on Render's free tier can take 30–50 s; the start button shows "Waking the server…" after 3 s of waiting.

### 6.5 Look

- Calm, finance-tool feel: neutral greys, one accent colour (green for verified, red only for failed checks), Inter or Geist font, tabular numerals for amounts.
- Must read cleanly on a projector at 1280×720: minimum 14 px body text in tables.

### 6.6 Frontend done checklist

- [ ] Start → workspace with mocks
- [ ] Tables, tabs, search, downloads
- [ ] Submit with fail mock → field colours + hint
- [ ] Pass mock → badge modal, raw JSON, download
- [ ] Verify + tamper results
- [ ] `/verify` standalone page
- [ ] Switched to the real backend URL and full demo loop passes
- [ ] Deployed on Vercel

## 7. Overnight timeline (Wed 16:00 → Thu 09:00)

We integrate on real endpoints by 23:00 and freeze features at 04:00, leaving the morning for deploy, rehearsal and submission. Times are Lagos time; the plan assumes a 09:00 deadline, so shift every row if it is earlier.

| Time | Samuel (backend) | Teammate (frontend) | Sync checkpoint |
| --- | --- | --- | --- |
| 16:00–18:00 | Repo, `CLAUDE.md`, scaffold, `schemas.py`, stub routes, mock JSON fixtures | Next.js scaffold, Tailwind, start screen, workspace skeleton | **18:00** contract frozen; mocks pushed |
| 18:00–21:00 | Generator + canonical CSV + invariant tests; demo seed gives ₦45,000 | DataViewer, BriefPanel, SubmissionForm on mocks | **21:00** real `/session/init` live locally |
| 21:00–23:00 | Grading + normalisation; submit endpoint without tutor (template hints) | TutorDrawer, field status states, API client with error handling | **23:00** frontend runs on real backend: init + submit |
| 23:00–01:30 | Credentials: keys, did:key, sign, verify, tamper test; badge on pass | BadgeModal, raw JSON view, download, VerifyResult, tamper button | **01:30** full loop works locally |
| 01:30–03:00 | LLM tutor + leak guard + LLM brief; SQLite persistence; CSV download endpoints | `/verify` page, responsive tutor sheet, loading and wake-up states | — |
| 03:00–04:00 | Deploy backend to Render; key in env; `/health` | Deploy to Vercel against the live backend | **04:00** feature freeze on deployed URLs |
| 04:00–06:30 | Sleep in shifts, or fix only bugs found in the deployed loop | Visual polish on the demo path only | — |
| 06:30–07:30 | Record backup demo video; write submission text | Screenshots for the submission; final UI fixes | **07:30** video recorded |
| 07:30–08:30 | Rehearse demo twice on deployed build | Rehearse demo twice | **08:30** submission sent |

If anything slips, cut in this order: LLM-written brief (use the template), `/verify` standalone page, zip download (keep per-table CSVs), responsive layout. Never cut the tamper test or the hint guard; they carry the pitch.

## 8. Demo, deploy, risks and submission

The demo runs on deployed URLs with `seed=demo`, and every failure point has a fallback we have already rehearsed.

### 8.1 Three-minute demo script

1. **Problem (20 s):** "A degree says what you studied. It doesn't prove you can find ₦45,000 that went missing between a till and a bank."
2. **Start (15 s):** type a judge's name, start the Alimosho scenario, show the brief and the three messy tables.
3. **Wrong attempt (40 s):** submit the decoy transaction ID and a total that includes cash. Show red fields and the Socratic hint, and point out it never reveals the answer.
4. **Right attempt (30 s):** submit the correct three values. All fields go green and the badge appears.
5. **Verify (40 s):** open the raw credential, click "Simulate employer verification" (green), then "Tamper test" (red, signature invalid).
6. **Thesis (35 s):** "AI generates the work and coaches you. Code grades you and signs the proof. No LLM decides whether you passed."

### 8.2 Deploy

| Piece | Host | Notes |
| --- | --- | --- |
| Backend | Render web service (or Railway) | Start command `uvicorn app.main:app --host 0.0.0.0 --port $PORT`; set `ISSUER_PRIVATE_KEY_B64` in env so the key survives restarts |
| Frontend | Vercel | Set `NEXT_PUBLIC_API_URL` to the backend URL, `NEXT_PUBLIC_USE_MOCKS=false` |
| Warm-up | Both | Hit `/health` 2 minutes before presenting to wake the free-tier backend |

### 8.3 Risks and fallbacks

| Risk | Fallback |
| --- | --- |
| LLM down or slow during demo | Template hints from the ladder; `/health` shows `fallback` |
| Backend sleeps or crashes | Warm-up ping; local backend on the laptop with the frontend pointed at it |
| Venue Wi-Fi fails | Run both locally; record a 3-minute screen capture by 07:30 as a last resort |
| Integration breaks late | Contract frozen at 18:00; mocks are generated from real schemas, so drift is caught early |
| Key regenerated on deploy | Key lives in env, not on the container disk |
| Judge asks about AI-grading bias | LLM never grades; it only writes text, and its output is leak-checked |

### 8.4 Submission checklist

- [ ] Project name and Track 2
- [ ] Problem and intended users (finance, accounting and business students and fresh graduates)
- [ ] Live frontend link, backend link, repo link, demo video
- [ ] Testing instructions: open the link, use `?seed=demo`, answers listed for judges in a private note
- [ ] AI tools disclosed: Claude Code (built most of the code), Gemini via LiteLLM (brief and hints)
- [ ] Pre-existing components disclosed: open-source libraries only
- [ ] Team names and contributions: Samuel (backend), teammate (frontend)
- [ ] Limitations stated: one scenario, synthetic data, not yet tested with students, OB 3.0–structured but not certified
