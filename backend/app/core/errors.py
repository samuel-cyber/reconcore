"""One error shape everywhere: {"error": {"code": ..., "message": ...}} (SPEC 4)."""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class ApiError(Exception):
    """Raised anywhere in the app; rendered as the canonical error body."""

    def __init__(self, code: str, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


def error_body(code: str, message: str) -> dict:
    return {"error": {"code": code, "message": message}}


_STATUS_CODES = {
    404: "not_found",
    405: "method_not_allowed",
    409: "already_solved",
    422: "invalid_input",
    500: "internal_error",
}


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api_error(_request: Request, exc: ApiError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code, content=error_body(exc.code, exc.message)
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_error(
        _request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        first = exc.errors()[0] if exc.errors() else {}
        loc = ".".join(str(p) for p in first.get("loc", ()) if p != "body")
        message = first.get("msg", "Invalid input")
        if loc:
            message = f"{loc}: {message}"
        return JSONResponse(
            status_code=422, content=error_body("invalid_input", message)
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(
        _request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        detail = exc.detail
        if isinstance(detail, dict) and "code" in detail:
            return JSONResponse(
                status_code=exc.status_code,
                content=error_body(str(detail["code"]), str(detail.get("message", ""))),
            )
        code = _STATUS_CODES.get(exc.status_code, "request_failed")
        return JSONResponse(
            status_code=exc.status_code, content=error_body(code, str(detail))
        )

    @app.exception_handler(Exception)
    async def _unhandled(_request: Request, exc: Exception) -> JSONResponse:
        # Never leak internals (and never ground truth) to the client.
        return JSONResponse(
            status_code=500,
            content=error_body("internal_error", "Unexpected server error."),
        )
