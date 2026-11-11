"""Credential verification (SPEC 5.6).

Three independent checks — signature, dataset hash, issuer — and a reason code for the
first one that fails. Any parse error is `malformed`, never a 500.
"""

from __future__ import annotations

import hashlib
from typing import Any

import base58

from app.credentials import badge as badge_mod
from app.credentials.did import issuer_did, public_key_from_multibase, verification_method
from app.generator.build import generate
from app.schemas import VerifyResponse
from app.store import sessions as store
from app.store.sessions import iso_z, utc_now


class Malformed(ValueError):
    pass


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise Malformed(message)


def _extract(credential: Any) -> tuple[dict, dict, str, str]:
    """Returns (unsigned credential, proof options, proofValue, dataset hash)."""
    _require(isinstance(credential, dict), "credential must be a JSON object")
    _require("proof" in credential, "credential has no proof")
    proof = credential["proof"]
    _require(isinstance(proof, dict), "proof must be an object")

    proof_value = proof.get("proofValue")
    _require(isinstance(proof_value, str) and proof_value.startswith("z"),
             "proofValue must be a base58btc string")
    _require(proof.get("type") == badge_mod.PROOF_TYPE, "unsupported proof type")
    _require(
        proof.get("cryptosuite") == badge_mod.CRYPTOSUITE, "unsupported cryptosuite"
    )
    _require(isinstance(proof.get("verificationMethod"), str), "no verificationMethod")

    evidence = credential.get("evidence")
    _require(
        isinstance(evidence, list) and evidence and isinstance(evidence[0], dict),
        "credential has no evidence",
    )
    dataset_hash = evidence[0].get("reconcore:datasetHash")
    _require(isinstance(dataset_hash, str) and dataset_hash, "no dataset hash in evidence")

    unsigned = {k: v for k, v in credential.items() if k != "proof"}
    options = {k: v for k, v in proof.items() if k != "proofValue"}
    return unsigned, options, proof_value, dataset_hash


def _issuer_is_ours(credential: dict, options: dict) -> bool:
    method = options.get("verificationMethod", "")
    if method != verification_method():
        return False
    issuer = credential.get("issuer")
    issuer_id = issuer.get("id") if isinstance(issuer, dict) else issuer
    return issuer_id == issuer_did()


def _signature_ok(unsigned: dict, options: dict, proof_value: str) -> bool:
    try:
        signature = base58.b58decode(proof_value[1:])
        multibase = options["verificationMethod"].split("#", 1)[-1]
        public_key = public_key_from_multibase(multibase)
        public_key.verify(signature, badge_mod.proof_hash_data(unsigned, options))
        return True
    except Exception:
        return False


def _hash_is_known(dataset_hash: str, seed: Any) -> bool:
    """The hash must be reproducible from the seed the credential names.

    Primary path (SPEC 5.6): the hash is in our `badges` table and `generate(seed)`
    still produces it. The hosted backend runs on an ephemeral filesystem, so the
    badges table can disappear under a restart while perfectly good credentials stay
    in circulation. Re-deriving the dataset from the seed is the check that actually
    carries weight — the signature already proves we issued it — so a badge whose
    seed still reproduces its hash verifies even after the database is gone.
    """
    candidates = store.badge_seeds_for_hash(dataset_hash)
    if isinstance(seed, str) and seed and seed not in candidates:
        candidates = [*candidates, seed]
    for candidate in candidates:
        try:
            if generate(candidate).dataset_hash == dataset_hash:
                return True
        except Exception:  # pragma: no cover - a corrupt seed row
            continue
    return False


def verify_credential(credential: Any) -> VerifyResponse:
    checked_at = iso_z(utc_now())
    try:
        unsigned, options, proof_value, dataset_hash = _extract(credential)
    except Malformed:
        return VerifyResponse(
            valid=False,
            signature_verified=False,
            hash_match=False,
            issuer_match=False,
            reason="malformed",
            checked_at=checked_at,
        )
    except Exception:  # pragma: no cover - defence in depth; never a 500
        return VerifyResponse(
            valid=False,
            signature_verified=False,
            hash_match=False,
            issuer_match=False,
            reason="malformed",
            checked_at=checked_at,
        )

    seed = unsigned.get("evidence", [{}])[0].get("reconcore:seed")
    issuer_match = _issuer_is_ours(unsigned, options)
    hash_match = _hash_is_known(dataset_hash, seed)
    # Only our own did:key is trusted, so an unknown issuer means we cannot speak to the
    # signature at all.
    signature_verified = issuer_match and _signature_ok(unsigned, options, proof_value)

    if not issuer_match:
        reason = "issuer_unknown"
    elif not signature_verified:
        reason = "signature_invalid"
    elif not hash_match:
        reason = "hash_unknown"
    else:
        reason = None

    return VerifyResponse(
        valid=reason is None,
        signature_verified=signature_verified,
        hash_match=hash_match,
        issuer_match=issuer_match,
        reason=reason,
        checked_at=checked_at,
    )
