"""Open Badges 3.0–structured credential with an eddsa-jcs-2022 proof (SPEC 5.6).

We describe this as OB 3.0–structured, not certified conformant.
"""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime
from typing import Any

import base58

from app.config import get_settings
from app.credentials.did import issuer_did, verification_method
from app.credentials.keys import issuer_private_key
from app.schemas import SolveSummary
from app.store import sessions as store

CONTEXT = [
    "https://www.w3.org/ns/credentials/v2",
    "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json",
]
ACHIEVEMENT_ID = "urn:reconcore:achievement:reconciliation-l1"
CREDENTIAL_NAME = "Multi-Source Financial Reconciliation"
ACHIEVEMENT_NAME = "Multi-Source Financial Reconciliation — Level 1"
ACHIEVEMENT_DESCRIPTION = (
    "Reconciled POS, warehouse and bank records to find an unsettled transfer and a "
    "duplicate waybill."
)
CRITERIA_NARRATIVE = (
    "Exact match on discrepancy amount, missing transaction ID and duplicate waybill "
    "ID, graded by deterministic code."
)
EVIDENCE_NAME = "Alimosho Q3 reconciliation attempt"

PROOF_TYPE = "DataIntegrityProof"
CRYPTOSUITE = "eddsa-jcs-2022"
PROOF_PURPOSE = "assertionMethod"


def jcs(obj: Any) -> bytes:
    """JCS canonicalisation. Our data is strings, ints and nested objects — no floats —
    so sorted keys with tight separators is exactly JCS."""
    return json.dumps(
        obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    ).encode("utf-8")


def proof_hash_data(unsigned: dict, options: dict) -> bytes:
    return hashlib.sha256(jcs(options)).digest() + hashlib.sha256(jcs(unsigned)).digest()


def _plural(count: int, word: str) -> str:
    return f"{count} {word}" if count == 1 else f"{count} {word}s"


def build_unsigned_credential(
    *,
    candidate_name: str,
    seed: str,
    dataset_hash: str,
    summary: SolveSummary,
    issued_at: datetime,
    credential_id: str | None = None,
) -> dict:
    timestamp = store.iso_z(issued_at)
    return {
        "@context": list(CONTEXT),
        "id": credential_id or f"urn:uuid:{uuid.uuid4()}",
        "type": ["VerifiableCredential", "OpenBadgeCredential"],
        "issuer": {
            "id": issuer_did(),
            "type": ["Profile"],
            "name": get_settings().issuer_name,
        },
        "validFrom": timestamp,
        "name": CREDENTIAL_NAME,
        "credentialSubject": {
            "type": ["AchievementSubject"],
            "name": candidate_name,
            "achievement": {
                "id": ACHIEVEMENT_ID,
                "type": ["Achievement"],
                "name": ACHIEVEMENT_NAME,
                "description": ACHIEVEMENT_DESCRIPTION,
                "criteria": {"narrative": CRITERIA_NARRATIVE},
            },
            "result": [{"type": ["Result"], "value": "3/3 exact"}],
        },
        "evidence": [
            {
                "type": ["Evidence"],
                "name": EVIDENCE_NAME,
                "description": (
                    f"Solved in {_plural(summary.attempts, 'attempt')} with "
                    f"{_plural(summary.hints_used, 'hint')} in "
                    f"{summary.seconds_to_solve} seconds."
                ),
                "reconcore:datasetHash": dataset_hash,
                "reconcore:seed": seed,
                "reconcore:attempts": summary.attempts,
                "reconcore:hintsUsed": summary.hints_used,
            }
        ],
    }


def sign_credential(unsigned: dict, *, created: datetime) -> dict:
    """Attach a DataIntegrityProof. The private key never leaves this process."""
    options = {
        "type": PROOF_TYPE,
        "cryptosuite": CRYPTOSUITE,
        "created": store.iso_z(created),
        "verificationMethod": verification_method(),
        "proofPurpose": PROOF_PURPOSE,
    }
    signature = issuer_private_key().sign(proof_hash_data(unsigned, options))
    signed = dict(unsigned)
    signed["proof"] = {**options, "proofValue": "z" + base58.b58encode(signature).decode()}
    return signed


def issue_badge(
    *, session: store.SessionRecord, summary: SolveSummary, issued_at: datetime
) -> dict:
    unsigned = build_unsigned_credential(
        candidate_name=session.candidate_name,
        seed=session.seed,
        dataset_hash=session.dataset_hash,
        summary=summary,
        issued_at=issued_at,
    )
    credential = sign_credential(unsigned, created=issued_at)
    store.save_badge(
        badge_id=credential["id"],
        session_id=session.id,
        dataset_hash=session.dataset_hash,
        seed=session.seed,
        credential_json=json.dumps(credential, ensure_ascii=False),
    )
    return credential
