"""POST /api/credential/verify — always HTTP 200, even for garbage (SPEC 4)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from app.credentials.badge import build_unsigned_credential, sign_credential
from app.credentials.verify import verify_credential
from app.generator.build import load_dataset
from app.schemas import SolveSummary, VerifyRequest, VerifyResponse
from app.store.sessions import utc_now

router = APIRouter(prefix="/api/credential", tags=["credential"])


@router.post("/verify", response_model=VerifyResponse)
def verify(payload: VerifyRequest) -> VerifyResponse:
    return verify_credential(payload.badge)


SAMPLE_CANDIDATE = "Sample Candidate (demo credential)"


@router.get("/sample")
def sample_credential() -> dict[str, Any]:
    """A genuinely signed specimen for the employer verifier's "load a sample" button.

    It is signed with the live issuer key over the demo dataset, so it verifies for the
    same reasons a candidate's badge does, and editing any character of it fails. It is
    labelled as a sample in the signed name and is not stored as an issued badge.
    """
    dataset = load_dataset("demo")
    now = utc_now()
    unsigned = build_unsigned_credential(
        candidate_name=SAMPLE_CANDIDATE,
        seed="demo",
        dataset_hash=dataset.dataset_hash,
        summary=SolveSummary(attempts=2, hints_used=1, seconds_to_solve=412),
        issued_at=now,
    )
    return sign_credential(unsigned, created=now)
