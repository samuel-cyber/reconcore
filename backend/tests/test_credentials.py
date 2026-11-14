"""SPEC 5.9: sign/verify, tamper, unknown hash, key survives restart."""

from __future__ import annotations

import base64
import copy
import json
from datetime import datetime, timezone

import pytest

from app.credentials.badge import build_unsigned_credential, issue_badge, sign_credential
from app.credentials.did import issuer_did, verification_method
from app.credentials.verify import verify_credential
from app.generator.brief import template_brief
from app.generator.build import generate
from app.schemas import SolveSummary
from app.store import sessions as store

DEMO = generate("demo")
SUMMARY = SolveSummary(attempts=2, hints_used=1, seconds_to_solve=412)


@pytest.fixture
def session_record():
    return store.create_session(
        seed="demo",
        candidate_name="Ada Okafor",
        ground_truth=DEMO.ground_truth,
        dataset_hash=DEMO.dataset_hash,
        brief=template_brief(),
    )


@pytest.fixture
def badge(session_record):
    return issue_badge(
        session=session_record,
        summary=SUMMARY,
        issued_at=datetime.now(timezone.utc),
    )


def test_the_credential_has_the_ob3_shape(badge):
    assert badge["@context"] == [
        "https://www.w3.org/ns/credentials/v2",
        "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json",
    ]
    assert badge["id"].startswith("urn:uuid:")
    assert badge["type"] == ["VerifiableCredential", "OpenBadgeCredential"]
    assert badge["issuer"] == {"id": issuer_did(), "type": ["Profile"], "name": "ReconCore"}
    assert badge["credentialSubject"]["name"] == "Ada Okafor"
    assert badge["credentialSubject"]["result"][0]["value"] == "3/3 exact"
    evidence = badge["evidence"][0]
    assert evidence["reconcore:datasetHash"] == DEMO.dataset_hash
    assert evidence["reconcore:seed"] == "demo"
    assert evidence["reconcore:attempts"] == 2
    assert evidence["reconcore:hintsUsed"] == 1
    assert evidence["description"] == "Solved in 2 attempts with 1 hint in 412 seconds."
    assert badge["proof"]["type"] == "DataIntegrityProof"
    assert badge["proof"]["cryptosuite"] == "eddsa-jcs-2022"
    assert badge["proof"]["proofPurpose"] == "assertionMethod"
    assert badge["proof"]["verificationMethod"] == verification_method()
    assert badge["proof"]["proofValue"].startswith("z")


def test_sign_then_verify_is_valid(badge):
    result = verify_credential(badge)
    assert result.valid
    assert (result.signature_verified, result.hash_match, result.issuer_match) == (
        True,
        True,
        True,
    )
    assert result.reason is None
    assert result.checked_at.endswith("Z")


def test_the_credential_contains_no_ground_truth(badge):
    raw = json.dumps(badge)
    truth = DEMO.ground_truth
    assert str(truth.discrepancy_ngn) not in raw
    assert truth.missing_tx_id not in raw
    assert truth.duplicate_wb_id not in raw
    assert truth.decoy_tx_id not in raw


def test_changing_one_character_of_the_name_breaks_the_signature(badge):
    tampered = copy.deepcopy(badge)
    tampered["credentialSubject"]["name"] = "Ada Okafor (edited)"
    result = verify_credential(tampered)
    assert result.valid is False
    assert result.signature_verified is False
    assert result.reason == "signature_invalid"
    # The other two checks are untouched, which is what the demo shows.
    assert result.hash_match is True
    assert result.issuer_match is True


@pytest.mark.parametrize(
    "mutate",
    [
        lambda c: c.update({"name": "Something Else"}),
        lambda c: c["evidence"][0].update({"reconcore:attempts": 1}),
        lambda c: c["credentialSubject"]["achievement"].update({"name": "Level 9"}),
        lambda c: c.update({"validFrom": "2020-01-01T00:00:00Z"}),
        lambda c: c["proof"].update({"created": "2020-01-01T00:00:00Z"}),
    ],
)
def test_any_edit_anywhere_breaks_the_signature(badge, mutate):
    tampered = copy.deepcopy(badge)
    mutate(tampered)
    assert verify_credential(tampered).signature_verified is False


def test_an_unknown_dataset_hash_gives_hash_unknown(session_record):
    """A credential we signed, but over a dataset nobody ever downloaded."""
    unsigned = build_unsigned_credential(
        candidate_name="Ada Okafor",
        seed="never-issued",
        dataset_hash="sha256:" + "0" * 64,
        summary=SUMMARY,
        issued_at=datetime.now(timezone.utc),
    )
    signed = sign_credential(unsigned, created=datetime.now(timezone.utc))
    result = verify_credential(signed)
    assert result.signature_verified is True
    assert result.issuer_match is True
    assert result.hash_match is False
    assert result.reason == "hash_unknown"
    assert result.valid is False


def test_a_foreign_issuer_is_untrusted(badge):
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

    from app.credentials.did import multibase_from_public_key

    stranger = Ed25519PrivateKey.generate()
    multibase = multibase_from_public_key(stranger.public_key())
    forged = copy.deepcopy(badge)
    forged["issuer"]["id"] = f"did:key:{multibase}"
    forged["proof"]["verificationMethod"] = f"did:key:{multibase}#{multibase}"

    import base58

    from app.credentials.badge import proof_hash_data

    options = {k: v for k, v in forged["proof"].items() if k != "proofValue"}
    unsigned = {k: v for k, v in forged.items() if k != "proof"}
    forged["proof"]["proofValue"] = "z" + base58.b58encode(
        stranger.sign(proof_hash_data(unsigned, options))
    ).decode()

    result = verify_credential(forged)
    assert result.issuer_match is False
    assert result.signature_verified is False
    assert result.reason == "issuer_unknown"


@pytest.mark.parametrize(
    "payload",
    [None, {}, {"proof": "nope"}, {"proof": {}}, [], "a string", 42,
     {"proof": {"type": "DataIntegrityProof", "cryptosuite": "eddsa-jcs-2022",
               "verificationMethod": "x", "proofValue": "zAAA"}}],
)
def test_garbage_is_malformed_and_never_a_500(payload):
    result = verify_credential(payload)
    assert result.reason == "malformed"
    assert result.valid is False
    assert (result.signature_verified, result.hash_match, result.issuer_match) == (
        False,
        False,
        False,
    )


def test_verify_endpoint_always_returns_200(client, badge):
    assert client.post("/api/credential/verify", json={"badge": badge}).status_code == 200
    for payload in ({"badge": None}, {"badge": {}}, {}):
        res = client.post("/api/credential/verify", json=payload)
        assert res.status_code == 200
        assert res.json()["reason"] == "malformed"


def test_the_key_survives_a_restart(monkeypatch, tmp_path):
    """A generated key is written to keys/issuer.key and reloaded next boot."""
    from app.credentials import keys as keys_module

    monkeypatch.setattr(keys_module, "KEY_DIR", tmp_path)
    monkeypatch.setattr(keys_module, "KEY_PATH", tmp_path / "issuer.key")
    monkeypatch.setattr(
        keys_module.get_settings(), "issuer_private_key_b64", "", raising=False
    )
    monkeypatch.delenv("ISSUER_PRIVATE_KEY_B64", raising=False)

    keys_module.load_or_create_issuer_key.cache_clear()
    first = keys_module.load_or_create_issuer_key()
    assert (tmp_path / "issuer.key").exists()

    keys_module.load_or_create_issuer_key.cache_clear()
    second = keys_module.load_or_create_issuer_key()
    assert _raw(first) == _raw(second)

    # And an env-provided key wins over the file.
    keys_module.load_or_create_issuer_key.cache_clear()
    monkeypatch.setenv("ISSUER_PRIVATE_KEY_B64", base64.b64encode(b"\x01" * 32).decode())
    third = keys_module.load_or_create_issuer_key()
    assert _raw(third) == b"\x01" * 32

    keys_module.load_or_create_issuer_key.cache_clear()


def _raw(key):
    from cryptography.hazmat.primitives.serialization import (
        Encoding,
        NoEncryption,
        PrivateFormat,
    )

    return key.private_bytes(
        encoding=Encoding.Raw,
        format=PrivateFormat.Raw,
        encryption_algorithm=NoEncryption(),
    )


def test_badges_signed_before_a_restart_still_verify(badge, monkeypatch):
    """The in-process key is cached; clearing the cache must not change the key."""
    from app.credentials import keys as keys_module

    keys_module.load_or_create_issuer_key.cache_clear()
    assert verify_credential(badge).valid is True


def test_a_badge_still_verifies_after_the_database_is_lost(badge, monkeypatch):
    """Render's free filesystem is ephemeral: a restart must not invalidate badges."""
    from app.store.db import db

    with db() as conn:
        conn.execute("DELETE FROM badges")

    result = verify_credential(badge)
    assert result.hash_match is True, "seed still reproduces the dataset"
    assert result.signature_verified is True
    assert result.valid is True


def test_a_hash_that_no_seed_reproduces_is_still_unknown(badge):
    """The fallback is deterministic re-derivation, not blind trust."""
    import copy

    from app.credentials.badge import proof_hash_data, sign_credential

    forged = copy.deepcopy(badge)
    forged["evidence"][0]["reconcore:datasetHash"] = "sha256:" + "f" * 64
    unsigned = {k: v for k, v in forged.items() if k != "proof"}
    resigned = sign_credential(unsigned, created=datetime.now(timezone.utc))

    result = verify_credential(resigned)
    assert result.signature_verified is True
    assert result.hash_match is False
    assert result.reason == "hash_unknown"


# ---------------------------------------------------------------- the signed sample


def test_the_sample_credential_is_genuinely_signed(client):
    sample = client.get("/api/credential/sample").json()
    assert "sample" in sample["credentialSubject"]["name"].lower()
    verdict = client.post("/api/credential/verify", json={"badge": sample}).json()
    assert verdict["valid"] is True
    assert verdict["signature_verified"] and verdict["hash_match"] and verdict["issuer_match"]


def test_a_tampered_sample_fails(client):
    sample = client.get("/api/credential/sample").json()
    sample["credentialSubject"]["name"] = "Someone Else"
    verdict = client.post("/api/credential/verify", json={"badge": sample}).json()
    assert verdict["valid"] is False
    assert verdict["reason"] == "signature_invalid"


def test_the_sample_credential_holds_no_ground_truth(client):
    from app.generator.build import generate

    truth = generate("demo").ground_truth
    text = client.get("/api/credential/sample").text
    for secret in (truth.missing_tx_id, truth.duplicate_wb_id, truth.decoy_tx_id):
        assert secret not in text
