"""Session init, CSV downloads and the failing-submit path."""

from __future__ import annotations

import hashlib
import io
import zipfile

from app.generator.build import generate

DEMO = generate("demo")


def _init(client, seed="demo", name="Ada Okafor"):
    res = client.post(
        "/api/session/init", json={"seed": seed, "candidate_name": name}
    )
    assert res.status_code == 200, res.text
    return res.json()


def test_init_returns_the_contract_shape(client):
    body = _init(client)
    assert body["session_id"].startswith("ses_")
    assert body["scenario"] == {
        "id": "alimosho-q3",
        "title": "Alimosho Retail & Logistics Crisis: Q3 Reconciliation",
    }
    assert set(body["brief"]) == {"from", "body_markdown", "task_definitions"}
    assert body["dataset_hash"] == DEMO.dataset_hash
    assert body["max_hint_level"] == 3
    for key in ("pos", "waybills", "bank"):
        table = body["tables"][key]
        assert table["filename"] == DEMO.tables[key].filename
        assert table["columns"] == DEMO.tables[key].columns
        assert table["rows"] == DEMO.tables[key].rows
        assert all(isinstance(cell, str) for row in table["rows"] for cell in row)


def test_the_brief_states_the_definition_word_for_word(client):
    brief = _init(client)["brief"]
    definition = (
        "discrepancy_ngn = sum(POS sales paid by Transfer) − sum(bank credits). "
        "The duplicate waybill is graded only by its ID."
    )
    assert definition in brief["body_markdown"]
    assert brief["task_definitions"][0] == definition


def test_init_never_leaks_ground_truth(client):
    raw = client.post(
        "/api/session/init", json={"seed": "demo", "candidate_name": "Ada"}
    ).text
    truth = DEMO.ground_truth
    for banned in ("missing_tx_id", "duplicate_wb_id", "ground_truth", "decoy"):
        assert banned not in raw
    # The IDs appear in the tables (they must), but never labelled as the answer.
    assert f'"{truth.missing_tx_id}"' not in raw.replace(f'["{truth.missing_tx_id}"', "")


def test_a_random_seed_is_used_when_none_is_given(client):
    first = client.post("/api/session/init", json={"candidate_name": "A"}).json()
    second = client.post("/api/session/init", json={"candidate_name": "B"}).json()
    assert first["dataset_hash"] != second["dataset_hash"]


def test_candidate_name_is_validated(client):
    assert client.post("/api/session/init", json={"candidate_name": ""}).status_code == 422
    assert (
        client.post("/api/session/init", json={"candidate_name": "x" * 61}).status_code
        == 422
    )


def test_csv_endpoints_serve_the_exact_canonical_bytes(client):
    session_id = _init(client)["session_id"]
    for table, filename in (
        ("pos", "pos_sales_log.csv"),
        ("waybills", "warehouse_waybills.csv"),
        ("bank", "bank_settlement.csv"),
    ):
        res = client.get(f"/api/session/{session_id}/csv/{table}")
        assert res.status_code == 200
        assert res.content == DEMO.canonical_csv[table]
        assert filename in res.headers["content-disposition"]
        assert res.headers["content-type"].startswith("text/csv")


def test_csv_zip_contains_the_same_bytes_and_hashes_to_the_badge_hash(client):
    session_id = _init(client)["session_id"]
    res = client.get(f"/api/session/{session_id}/csv.zip")
    assert res.status_code == 200
    assert f"reconcore_{session_id}_csvs.zip" in res.headers["content-disposition"]

    with zipfile.ZipFile(io.BytesIO(res.content)) as archive:
        assert archive.namelist() == [
            "pos_sales_log.csv",
            "warehouse_waybills.csv",
            "bank_settlement.csv",
        ]
        pos = archive.read("pos_sales_log.csv")
        waybills = archive.read("warehouse_waybills.csv")
        bank = archive.read("bank_settlement.csv")

    assert (pos, waybills, bank) == (
        DEMO.canonical_csv["pos"],
        DEMO.canonical_csv["waybills"],
        DEMO.canonical_csv["bank"],
    )
    digest = hashlib.sha256(pos + b"\x1e" + waybills + b"\x1e" + bank).hexdigest()
    assert f"sha256:{digest}" == DEMO.dataset_hash


def test_unknown_session_and_table(client):
    assert client.get("/api/session/ses_nope/csv/pos").json()["error"][
        "code"
    ] == "session_not_found"
    session_id = _init(client)["session_id"]
    res = client.get(f"/api/session/{session_id}/csv/ledger")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "invalid_table"


def test_a_wrong_submit_returns_statuses_and_a_safe_hint(client):
    truth = DEMO.ground_truth
    session_id = _init(client)["session_id"]
    res = client.post(
        "/api/session/submit",
        json={
            "session_id": session_id,
            "discrepancy_ngn": f"{truth.discrepancy_ngn + truth.cash_total_ngn:,}",
            "missing_tx_id": truth.decoy_tx_id,
            "duplicate_wb_id": truth.duplicate_wb_id,
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["passed"] is False
    assert body["attempt_no"] == 1
    assert body["field_status"] == {
        "discrepancy_ngn": "incorrect",
        "missing_tx_id": "incorrect",
        "duplicate_wb_id": "correct",
    }
    assert body["badge"] is None
    assert body["summary"] is None

    hint = body["tutor_hint"]
    assert hint["level"] == 1
    assert hint["source"] in {"llm", "template"}

    from app.tutor.guard import is_safe

    assert is_safe(hint["text"], truth)
    assert str(truth.discrepancy_ngn) not in res.text
    assert truth.missing_tx_id not in res.text


def test_hint_level_climbs_with_attempts(client):
    session_id = _init(client)["session_id"]
    levels = []
    for _ in range(4):
        body = client.post(
            "/api/session/submit",
            json={
                "session_id": session_id,
                "discrepancy_ngn": "1",
                "missing_tx_id": "POS-0001",
                "duplicate_wb_id": "WB-0001",
            },
        ).json()
        levels.append(body["tutor_hint"]["level"])
    assert levels == [1, 2, 3, 3]


def test_an_unparseable_amount_is_not_an_attempt(client):
    truth = DEMO.ground_truth
    session_id = _init(client)["session_id"]
    payload = {
        "session_id": session_id,
        "discrepancy_ngn": "45,000.50",
        "missing_tx_id": truth.missing_tx_id,
        "duplicate_wb_id": truth.duplicate_wb_id,
    }
    body = client.post("/api/session/submit", json=payload).json()
    assert body["passed"] is False
    assert body["attempt_no"] == 0
    assert body["field_status"]["discrepancy_ngn"] == "invalid_format"
    assert body["field_status"]["missing_tx_id"] == "correct"
    assert body["tutor_hint"]["source"] == "template"

    # Still attempt 1 afterwards: the bad format cost them nothing.
    payload["discrepancy_ngn"] = "1"
    assert client.post("/api/session/submit", json=payload).json()["attempt_no"] == 1


def test_bad_ids_are_rejected_as_invalid_input(client):
    session_id = _init(client)["session_id"]
    res = client.post(
        "/api/session/submit",
        json={
            "session_id": session_id,
            "discrepancy_ngn": "45000",
            "missing_tx_id": "POS 1042;drop",
            "duplicate_wb_id": "WB-3311",
        },
    )
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "invalid_input"
    # The error must not hand out the demo answers as "examples".
    message = res.json()["error"]["message"]
    assert "1042" not in message and "3311" not in message


def test_there_is_one_task_definition_per_task_in_ui_order(client):
    definitions = _init(client)["brief"]["task_definitions"]
    assert len(definitions) == 3
    assert "discrepancy_ngn" in definitions[0]
    assert "tx_id" in definitions[1] and "customer_ref" in definitions[1]
    assert "duplicate waybill" in definitions[2]


def test_submit_on_an_unknown_session_is_404(client):
    res = client.post(
        "/api/session/submit",
        json={
            "session_id": "ses_missing",
            "discrepancy_ngn": "45000",
            "missing_tx_id": "POS-1042",
            "duplicate_wb_id": "WB-3311",
        },
    )
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "session_not_found"
