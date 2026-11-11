# ReconCore

A HackerRank for business operations. A seeded Python generator builds three messy
company spreadsheets with planted errors, deterministic code grades the candidate's
exact findings, and a pass mints an Open Badges 3.0–structured credential signed with
Ed25519 that anyone can verify.

**AI generates the scenario and coaches you. Code grades you and signs the proof.
No LLM decides whether you passed.**

- `backend/` — FastAPI, Pydantic v2, SQLite, LiteLLM ([working rules](backend/CLAUDE.md))
- `frontend/` — Next.js (App Router), TypeScript, Tailwind
- `ReconCore — Technical Spec.md` — the binding spec

## Quick start

Two terminals, from the repository root.

```bash
# 1. backend  ->  http://localhost:8000
cd backend
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000

# 2. frontend ->  http://localhost:3000
cd frontend
npm install
cp .env.example .env.local      # then set NEXT_PUBLIC_USE_MOCKS=false
npm run dev
```

Open <http://localhost:3000/?seed=demo>. No API key is needed: with none set the
backend serves the hand-written brief and the template hint ladder, and `/health`
reports `{"ok":true,"llm":"fallback"}`.

### The demo loop

1. Type a name, start the `seed=demo` scenario.
2. Submit the decoy transaction and a total that includes cash → red fields and a
   Socratic hint that never names the answer.
3. Submit `₦45,000`, `POS-1042`, `WB-3311` → badge modal.
4. "Simulate employer verification" → green. "Tamper test" → red, `signature_invalid`.

## Tests

```bash
cd backend && python3 -m pytest -q     # 1320 tests
cd frontend && npx tsc --noEmit        # frontend typecheck
```

The backend suite covers the §3 generator invariants over 200 seeds, amount parsing,
grading diagnostics, the leak guard, credential sign/verify/tamper, and the full demo
loop end to end.

## Environment variables

### Backend (`backend/.env` locally, Render → Environment in production)

| Variable | Required | Example | Purpose |
| --- | --- | --- | --- |
| `ISSUER_PRIVATE_KEY_B64` | **in production** | `ARXsqw…r78=` | Ed25519 issuer key, raw 32 bytes, base64. Unset → a key is generated into `backend/keys/issuer.key` and a warning is logged. |
| `CORS_ORIGINS` | yes | `https://<your-project>.vercel.app,http://localhost:3000` | Comma-separated allowed origins, no trailing slashes |
| `PUBLIC_BASE_URL` | no | `https://reconcore-api.onrender.com` | Public URL of this API |
| `DB_PATH` | no | `/tmp/reconcore.db` | SQLite file (default `./reconcore.db`) |
| `LLM_MODEL` | no | `gemini/gemini-2.5-flash` | LiteLLM model string |
| `GEMINI_API_KEY` / `OPENAI_API_KEY` | no | `…` | Provider key. Absent → template brief and template hints |
| `LLM_TIMEOUT_S` | no | `5` | Hard deadline before falling back to a template |

### Frontend (`frontend/.env.local` locally, Vercel → Environment Variables)

| Variable | Required | Example | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | yes | `https://reconcore-api.onrender.com` | Backend base URL, no trailing slash |
| `NEXT_PUBLIC_USE_MOCKS` | yes | `false` | `true` serves `src/mocks/*.json` instead of calling the API |

## Deploy

### 1. Mint the issuer key first

```bash
cd backend && python3 scripts/generate_issuer_key.py
```

It prints `ISSUER_PRIVATE_KEY_B64=…` and the `did:key` that key issues under. Do this
**before** issuing any badge you want to verify later — changing the key changes the
issuer identity and invalidates every credential already in circulation.

### 2. Backend → Render

Blueprint: Render → New → Blueprint → select this repo; [`render.yaml`](render.yaml)
sets everything except the two secrets. Or create a Web Service by hand:

| Setting | Value |
| --- | --- |
| Root directory | `backend` |
| Runtime | Python 3 (`PYTHON_VERSION=3.11.9`) |
| Build command | `pip install -r requirements.txt` |
| Start command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Health check path | `/health` |
| Environment | the backend table above; set `ISSUER_PRIVATE_KEY_B64` and any LLM key as secrets |

Then check:

```bash
curl https://reconcore-api.onrender.com/health      # {"ok":true,"llm":"fallback"|"up"}
curl https://reconcore-api.onrender.com/api/issuer  # the did:key your badges carry
```

### 3. Frontend → Vercel

| Setting | Value |
| --- | --- |
| Root directory | `frontend` |
| Framework preset | Next.js (build and output settings are auto-detected) |
| Environment variables | `NEXT_PUBLIC_API_URL=https://reconcore-api.onrender.com`, `NEXT_PUBLIC_USE_MOCKS=false` |

After the first deploy, put the real Vercel URL into the backend's `CORS_ORIGINS` and
redeploy the backend. Vercel preview deployments get their own URLs, so add any preview
origin you plan to demo from.

### 4. Before presenting

- Hit `/health` about two minutes early; a sleeping free instance takes 30–50 s to wake.
- Re-run the loop once on the deployed URLs with `?seed=demo`.
- Keep a local backend ready as the venue-WiFi fallback: point
  `NEXT_PUBLIC_API_URL` at `http://localhost:8000` and restart `npm run dev`.

## Notes on the hosted setup

- Free Render instances have an **ephemeral filesystem**. Sessions and the badge table
  live only as long as the instance, so finish a session in one sitting. Issued badges
  keep verifying across restarts: verification re-derives the dataset from the seed
  inside the credential rather than trusting a database row.
- `backend/keys/` is gitignored. In production the key must come from
  `ISSUER_PRIVATE_KEY_B64`, not from disk.
- Regenerate the frontend fixtures from the real generator with
  `cd backend && python3 scripts/make_mocks.py`.
