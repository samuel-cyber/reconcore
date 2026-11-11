"""GET /api/issuer - issuer profile and public key (SPEC 4)."""

from __future__ import annotations

from fastapi import APIRouter

from app.credentials.did import issuer_profile
from app.schemas import IssuerProfile

router = APIRouter(prefix="/api", tags=["issuer"])


@router.get("/issuer", response_model=IssuerProfile)
def get_issuer() -> IssuerProfile:
    return issuer_profile()
