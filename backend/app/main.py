"""FastAPI app: CORS, routers, error handlers, /health."""

from __future__ import annotations

import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.core.errors import install_error_handlers
from app.schemas import HealthResponse
from app.store.db import init_db

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s"
)
log = logging.getLogger("reconcore")


def _prewarm_llm() -> None:
    """Importing litellm costs a couple of seconds; pay it at boot, not on the
    candidate's first request."""
    try:
        import litellm  # noqa: F401
    except Exception as exc:  # pragma: no cover - import problems fall back anyway
        log.warning("litellm could not be pre-imported: %s", exc)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    from app.credentials.keys import load_or_create_issuer_key

    load_or_create_issuer_key()
    if get_settings().llm_available:
        threading.Thread(target=_prewarm_llm, daemon=True).start()
    yield


app = FastAPI(
    title="ReconCore API",
    version="0.1.0",
    description=(
        "Seeded reconciliation scenarios, deterministic grading and Ed25519-signed "
        "Open Badges 3.0-structured credentials."
    ),
    lifespan=lifespan,
)

settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

install_error_handlers(app)


@app.get("/health", response_model=HealthResponse, tags=["health"])
def health() -> HealthResponse:
    return HealthResponse(ok=True, llm="up" if settings.llm_available else "fallback")


from app.api import credential as credential_api  # noqa: E402
from app.api import issuer as issuer_api  # noqa: E402
from app.api import session as session_api  # noqa: E402

app.include_router(session_api.router)
app.include_router(credential_api.router)
app.include_router(issuer_api.router)
