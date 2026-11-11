"""Credential verification endpoint. Filled in in phase 4."""

from __future__ import annotations

from fastapi import APIRouter

from app.core.errors import ApiError
from app.schemas import VerifyRequest, VerifyResponse

router = APIRouter(prefix="/api/credential", tags=["credential"])


@router.post("/verify", response_model=VerifyResponse)
def verify(payload: VerifyRequest) -> VerifyResponse:
    raise ApiError("not_implemented", "Verification lands in phase 4.", 501)
