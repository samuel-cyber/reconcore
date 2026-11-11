"""POST /api/credential/verify — always HTTP 200, even for garbage (SPEC 4)."""

from __future__ import annotations

from fastapi import APIRouter

from app.credentials.verify import verify_credential
from app.schemas import VerifyRequest, VerifyResponse

router = APIRouter(prefix="/api/credential", tags=["credential"])


@router.post("/verify", response_model=VerifyResponse)
def verify(payload: VerifyRequest) -> VerifyResponse:
    return verify_credential(payload.badge)
