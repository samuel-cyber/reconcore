# Product Requirements Document (PRD): ReconCore

## 1. Executive Summary & Core Thesis
* **Product Name:** ReconCore (Reconciliation Core)
* **Hackathon Track:** Wale Lab NextGen AI Hackathon — Track 2 (Bridging the University-to-Work Gap)
* **One-Sentence Pitch:** ReconCore is a "HackerRank for Business Operations" that gives students messy, AI-generated company spreadsheets to reconcile, grades their exact numerical answers using strict code (not biased AI), and mints a cryptographically verifiable skill badge for employers.
* **The Core Thesis:** Using an LLM as a judge to grade open-ended student text responses is fundamentally broken due to verbosity bias, hallucination, and prompt injection. ReconCore separates **probabilistic AI** (generating realistic messy datasets and giving Socratic hints) from **deterministic code** (strict mathematical grading and cryptographic badge signing).

---

## 2. Target Users
1. **Primary User (The Candidate):** University students and fresh graduates in Finance, Accounting, Business Administration, and Systems Engineering looking to prove real-world data and operational readiness.
2. **Secondary User (The Verifier):** SME owners, HR managers, and corporate recruiters who need instant, unforgeable proof that a candidate can handle messy real-world data.

---

## 3. Core User Journey (The 3-Minute Live Demo Loop)

1. **Launch Scenario:** The user opens ReconCore and starts the featured simulation: *"Alimosho Retail & Logistics Crisis: Q3 Reconciliation."*
2. **Inspect Messy Data:** The app displays a short story brief from a store manager alongside three messy tables:
   * `pos_sales_log.csv` (Cashier point-of-sale logs)
   * `warehouse_waybills.csv` (Stock dispatch logs)
   * `bank_settlement.csv` (Actual bank credit alerts)
   The user can view/search the tables right inside the browser or download the CSV files to inspect in Excel/Python.
3. **Attempt 1 (Fail + AI Tutor Hint):** The user types in their calculation for the missing money and the bad Transaction IDs. If the numbers are wrong, the Python backend rejects the answer and triggers the **Socratic AI Tutor**, which gives a targeted hint pointing them to the right table without spoiling the answer.
4. **Attempt 2 (Pass):** The user spots the typo/duplicate row, recalculates, and submits the exact Naira discrepancy and Transaction IDs. The backend confirms a 100% mathematical match.
5. **Mint & Verify Badge:** The app generates a W3C Open Badge 3.0 (a JSON-LD file signed with an `Ed25519` cryptographic key). The user or judge clicks **"Simulate Employer Verification"**, running a live public-key check that flashes green: **"Cryptographically Verified — Tamper Proof."**

---

## 4. Functional Modules (What We Are Building)

### Module 1: Synthetic Messy Data Generator (Backend)
* **What it does:** Generates three small, realistic tables (15–25 rows each) with planted operational errors.
* **Planted Errors (The Ground Truth):**
  1. **Unsettled Transfer:** A POS sale marked "Paid via Transfer" (e.g., ₦45,000) that never showed up in the Bank Settlement table.
  2. **Fuzzy Duplicate Waybill:** A warehouse stock entry logged twice with a slight typo in the product name (e.g., `Peak-Milk-400g` vs. `Peak-Mlk-400g`) and messy date formats (`14/10/2026` vs. `2026-10-14`).
* **Demo Seed Lock:** Includes a `?seed=demo` toggle so that during the live hackathon pitch, the exact numbers and row IDs are predictable for the presenter.

### Module 2: Split-Pane Workspace UI (Frontend)
* **Left Panel (Context & Submission):** Displays the store manager's problem brief and the 3-field submission form:
  * *Total Net Discrepancy Amount ($NGN$)*
  * *Missing Bank Settlement Transaction ID*
  * *Duplicated Warehouse Waybill ID*
* **Center Panel (Data Viewer):** A clean, tabbed table component (`POS Logs` | `Warehouse Waybills` | `Bank Statements`) with a search bar and a **Download CSVs** button.
* **Right Drawer (Socratic AI Tutor):** A compact chat panel that automatically explains *why* an attempt failed and nudges the user toward the anomaly.

### Module 3: Deterministic Grading Engine (Backend)
* **What it does:** Compares the user's submitted numbers and IDs against the session's ground truth using strict Python equality (`==`).
* **Output:** Returns which specific fields passed or failed, plus the exact mathematical difference (`delta`) to feed privately to the AI Tutor.

### Module 4: Context-Aware Socratic AI Tutor (Backend)
* **What it does:** Uses an LLM API (via LiteLLM) to guide the student when they submit a wrong answer.
* **System Prompt Rule:** The AI receives the hidden ground truth and the user's wrong input. It is strictly forbidden from stating the final Naira amount or exact ID; it must ask a guiding question about the specific table the user missed.

### Module 5: W3C Open Badges 3.0 Minter & Verifier (Backend + Modal UI)
* **What it does:** When all three inputs match 100%, generates an Open Badges 3.0 JSON-LD object containing the candidate's name, the SHA-256 hash of the dataset they solved, and an `Ed25519` digital signature.
* **Interactive Verifier:** A modal showing the visual badge card, a toggle to inspect the raw cryptographic JSON-LD, and a **"Verify Signature"** button that proves if the badge is authentic or tampered with.

---

## 5. Technical Stack

* **Frontend:** Next.js (React, TypeScript), Tailwind CSS, Lucide Icons.
* **Backend:** Python FastAPI, Pydantic (strict input validation).
* **AI Integration:** LiteLLM (connecting to Gemini / OpenAI for the Socratic Tutor).
* **Cryptography:** Python `cryptography` library (`Ed25519PrivateKey` for signing, `Ed25519PublicKey` for verification) + `hashlib` (`SHA-256` for hashing the CSV data).
* **State Storage:** Lightweight SQLite or in-memory session store.

---

## 6. API Endpoints

| Method | Endpoint | Purpose | Input Payload | Output Payload |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/session/init` | Creates a new test session & messy tables | `{"seed": "demo"}` | `session_id`, `brief`, `tables` (JSON arrays), `dataset_hash` |
| `POST` | `/api/session/submit` | Grades the 3 form inputs deterministically | `session_id`, `discrepancy_ngn`, `missing_tx_id`, `duplicate_wb_id` | `passed` (bool), `field_status`, `tutor_hint` (if failed), `badge_json` (if passed) |
| `POST` | `/api/credential/verify` | Verifies the badge's cryptographic signature | `badge_json` | `valid` (bool), `signature_verified`, `hash_match` |

---

## 7. What We Are Skipping (Out of Scope for 48 Hours)
* **No Login/Signup Screens:** Boot straight into the active workspace as a Guest Candidate so judges can test it in one click.
* **No Live Blockchain Gas Fees:** W3C Open Badges 3.0 uses standard public/private key cryptography (`Ed25519`), which verifies instantly offline or via API without slow wallet popups.
* **No Full Excel Clone:** Users view and filter the tables in the browser or download the CSVs; we do not need to build complex spreadsheet cell formulas inside the web app.