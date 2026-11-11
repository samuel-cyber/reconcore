"""SPEC 5.9: the whole demo loop through TestClient.

init(seed=demo) -> wrong submit (decoy tx id, cash-included total) -> hint that does not
leak -> correct submit -> badge -> verify valid -> tamper -> verify invalid.
"""

from __future__ import annotations

import copy
import io
import zipfile

from app.generator.build import generate
from app.tutor.guard import is_safe

DEMO = generate("demo")
TRUTH = DEMO.ground_truth


def test_the_full_demo_loop(client):
    # --- the judge types a name and starts the pinned demo scenario -----------------
    init = client.post(
        "/api/session/init", json={"seed": "demo", "candidate_name": "Ada Okafor"}
    )
    assert init.status_code == 200
    session = init.json()
    session_id = session["session_id"]

    assert session["scenario"]["id"] == "alimosho-q3"
    assert session["dataset_hash"] == DEMO.dataset_hash
    assert session["max_hint_level"] == 3
    assert len(session["tables"]["pos"]["rows"]) == 19
    assert len(session["tables"]["waybills"]["rows"]) == 15
    assert (
        "discrepancy_ngn = sum(POS sales paid by Transfer) − sum(bank credits)"
        in session["brief"]["body_markdown"]
    )

    # The demo answers are the locked ones.
    assert (TRUTH.discrepancy_ngn, TRUTH.missing_tx_id, TRUTH.duplicate_wb_id) == (
        45_000,
        "POS-1042",
        "WB-3311",
    )

    # --- the candidate downloads the CSVs they will be graded against ---------------
    zip_res = client.get(f"/api/session/{session_id}/csv.zip")
    assert zip_res.status_code == 200
    with zipfile.ZipFile(io.BytesIO(zip_res.content)) as archive:
        downloaded = {name: archive.read(name) for name in archive.namelist()}
    assert downloaded["pos_sales_log.csv"] == DEMO.canonical_csv["pos"]

    # --- wrong attempt: the decoy transaction and a total that includes cash ---------
    wrong = client.post(
        "/api/session/submit",
        json={
            "session_id": session_id,
            "discrepancy_ngn": f"₦{TRUTH.discrepancy_ngn + TRUTH.cash_total_ngn:,}",
            "missing_tx_id": TRUTH.decoy_tx_id,  # POS-1049: same amount, already settled
            "duplicate_wb_id": TRUTH.duplicate_wb_id,
        },
    )
    assert wrong.status_code == 200
    first = wrong.json()
    assert first["passed"] is False
    assert first["attempt_no"] == 1
    assert first["field_status"] == {
        "discrepancy_ngn": "incorrect",
        "missing_tx_id": "incorrect",
        "duplicate_wb_id": "correct",
    }
    assert first["badge"] is None

    # --- the hint coaches without ever giving the answer away -----------------------
    hint = first["tutor_hint"]
    assert hint["level"] == 1
    assert hint["source"] in {"llm", "template"}
    assert hint["text"]
    assert is_safe(hint["text"], TRUTH)
    for banned in (
        str(TRUTH.discrepancy_ngn),
        f"{TRUTH.discrepancy_ngn:,}",
        TRUTH.missing_tx_id,
        TRUTH.duplicate_wb_id,
    ):
        assert banned not in wrong.text
    # The hint says nothing about the field they got right.
    assert "waybill" not in hint["text"].lower()

    # --- correct attempt: messy formatting and lowercase IDs are accepted -----------
    right = client.post(
        "/api/session/submit",
        json={
            "session_id": session_id,
            "discrepancy_ngn": "₦45,000.00",
            "missing_tx_id": " pos-1042 ",
            "duplicate_wb_id": "wb-3311",
        },
    )
    assert right.status_code == 200
    passed = right.json()
    assert passed["passed"] is True
    assert passed["attempt_no"] == 2
    assert set(passed["field_status"].values()) == {"correct"}
    assert passed["tutor_hint"] is None
    assert passed["summary"] == {
        "attempts": 2,
        "hints_used": 1,
        "seconds_to_solve": passed["summary"]["seconds_to_solve"],
    }
    assert passed["summary"]["seconds_to_solve"] >= 0

    # --- the badge ------------------------------------------------------------------
    badge = passed["badge"]
    assert badge["type"] == ["VerifiableCredential", "OpenBadgeCredential"]
    assert badge["credentialSubject"]["name"] == "Ada Okafor"
    assert badge["credentialSubject"]["result"][0]["value"] == "3/3 exact"
    evidence = badge["evidence"][0]
    assert evidence["reconcore:datasetHash"] == DEMO.dataset_hash
    assert evidence["reconcore:seed"] == "demo"
    assert evidence["reconcore:attempts"] == 2
    assert evidence["reconcore:hintsUsed"] == 1
    assert badge["proof"]["cryptosuite"] == "eddsa-jcs-2022"

    # The badge is bound to the files the candidate actually downloaded.
    import hashlib

    digest = hashlib.sha256(
        downloaded["pos_sales_log.csv"]
        + b"\x1e"
        + downloaded["warehouse_waybills.csv"]
        + b"\x1e"
        + downloaded["bank_settlement.csv"]
    ).hexdigest()
    assert evidence["reconcore:datasetHash"] == f"sha256:{digest}"

    # Nothing about the answer rides along in the pass response.
    assert TRUTH.missing_tx_id not in right.text
    assert str(TRUTH.discrepancy_ngn) not in right.text

    # --- employer verification: green ------------------------------------------------
    issuer = client.get("/api/issuer").json()
    assert badge["issuer"]["id"] == issuer["id"]
    assert badge["proof"]["verificationMethod"] == issuer["verification_method"]

    good = client.post("/api/credential/verify", json={"badge": badge})
    assert good.status_code == 200
    assert good.json() == {
        "valid": True,
        "signature_verified": True,
        "hash_match": True,
        "issuer_match": True,
        "reason": None,
        "checked_at": good.json()["checked_at"],
    }

    # --- tamper test: red ------------------------------------------------------------
    tampered = copy.deepcopy(badge)
    tampered["credentialSubject"]["name"] = (
        f"{badge['credentialSubject']['name']} (edited)"
    )
    bad = client.post("/api/credential/verify", json={"badge": tampered})
    assert bad.status_code == 200
    bad_body = bad.json()
    assert bad_body["valid"] is False
    assert bad_body["signature_verified"] is False
    assert bad_body["reason"] == "signature_invalid"
    assert bad_body["hash_match"] is True
    assert bad_body["issuer_match"] is True

    # --- and the session is closed ---------------------------------------------------
    again = client.post(
        "/api/session/submit",
        json={
            "session_id": session_id,
            "discrepancy_ngn": "45000",
            "missing_tx_id": "POS-1042",
            "duplicate_wb_id": "WB-3311",
        },
    )
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "already_solved"


def test_a_random_seed_also_completes_the_loop(client):
    """Nothing in the loop is demo-specific."""
    init = client.post("/api/session/init", json={"candidate_name": "Judge"}).json()
    csv_res = client.get(f"/api/session/{init['session_id']}/csv/pos")
    assert csv_res.headers["x-dataset-hash"] == init["dataset_hash"]

    # Grade against the backend's own truth for whatever seed it picked.
    from app.store.sessions import get_session

    truth = get_session(init["session_id"]).ground_truth
    passed = client.post(
        "/api/session/submit",
        json={
            "session_id": init["session_id"],
            "discrepancy_ngn": f"{truth.discrepancy_ngn:,}",
            "missing_tx_id": truth.missing_tx_id,
            "duplicate_wb_id": truth.duplicate_wb_id,
        },
    ).json()
    assert passed["passed"] is True
    assert passed["summary"]["attempts"] == 1
    assert passed["summary"]["hints_used"] == 0
    assert client.post(
        "/api/credential/verify", json={"badge": passed["badge"]}
    ).json()["valid"] is True


def test_the_hint_ladder_climbs_and_never_leaks_across_a_whole_session(client):
    init = client.post(
        "/api/session/init", json={"seed": "demo", "candidate_name": "Judge"}
    ).json()
    seen = []
    for _ in range(5):
        body = client.post(
            "/api/session/submit",
            json={
                "session_id": init["session_id"],
                "discrepancy_ngn": "171500",
                "missing_tx_id": TRUTH.decoy_tx_id,
                "duplicate_wb_id": TRUTH.original_wb_id,
            },
        ).json()
        seen.append(body["tutor_hint"])
    assert [h["level"] for h in seen] == [1, 2, 3, 3, 3]
    for h in seen:
        assert is_safe(h["text"], TRUTH)
