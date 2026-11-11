"""Session endpoints: init, CSV downloads, submit. Filled in across phases 2-5."""

from __future__ import annotations

from fastapi import APIRouter

from app.core.errors import ApiError
from app.schemas import SessionInitRequest, SessionInitResponse, SubmitRequest, SubmitResponse

router = APIRouter(prefix="/api/session", tags=["session"])


@router.post("/init", response_model=SessionInitResponse)
def init_session(payload: SessionInitRequest) -> SessionInitResponse:
    raise ApiError("not_implemented", "Session init lands in phase 2.", 501)


@router.post("/submit", response_model=SubmitResponse)
def submit(payload: SubmitRequest) -> SubmitResponse:
    raise ApiError("not_implemented", "Grading lands in phase 3.", 501)
