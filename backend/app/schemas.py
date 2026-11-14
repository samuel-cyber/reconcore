"""Every request/response model: this file IS the API contract (SPEC 4).

Field names and enum values mirror frontend/src/lib/api-types.ts exactly. The frontend
wins any naming disagreement with the prose spec.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

TableKey = Literal["pos", "waybills", "bank"]
FieldStatus = Literal["correct", "incorrect", "invalid_format"]
HintSource = Literal["llm", "template"]
VerifyReason = Literal[
    "signature_invalid", "hash_unknown", "issuer_unknown", "malformed"
]

ID_PATTERN = r"^[A-Za-z0-9-]{1,20}$"


# --------------------------------------------------------------------------- health


class HealthResponse(BaseModel):
    ok: bool
    llm: Literal["up", "fallback"]
    # Present only in fallback: the reason the last LLM call failed (or was not made).
    llm_reason: str | None = None


# ------------------------------------------------------------------- session / init


class ScenarioInfo(BaseModel):
    id: str
    title: str


class BriefInfo(BaseModel):
    # `from` is a Python keyword, so the attribute is `from_` with the wire alias `from`.
    model_config = ConfigDict(populate_by_name=True)

    from_: str = Field(alias="from")
    body_markdown: str
    task_definitions: list[str]


class TableData(BaseModel):
    filename: str
    columns: list[str]
    rows: list[list[str]]


class SessionTables(BaseModel):
    pos: TableData
    waybills: TableData
    bank: TableData


class SessionInitRequest(BaseModel):
    seed: str | None = Field(default=None, max_length=64)
    candidate_name: str = Field(min_length=1, max_length=60)


class SessionInitResponse(BaseModel):
    session_id: str
    scenario: ScenarioInfo
    brief: BriefInfo
    tables: SessionTables
    dataset_hash: str
    max_hint_level: int


# ----------------------------------------------------------------------- submission


class SubmitRequest(BaseModel):
    session_id: str = Field(min_length=1, max_length=64)
    # A string on purpose: the backend owns all money parsing (SPEC 4 / 5.5).
    discrepancy_ngn: str = Field(max_length=40)
    missing_tx_id: str = Field(max_length=40)
    duplicate_wb_id: str = Field(max_length=40)


class FieldStatusMap(BaseModel):
    discrepancy_ngn: FieldStatus
    missing_tx_id: FieldStatus
    duplicate_wb_id: FieldStatus


class TutorHint(BaseModel):
    level: int
    text: str
    source: HintSource


class SolveSummary(BaseModel):
    attempts: int
    hints_used: int
    seconds_to_solve: int


# --------------------------------------------------------------------- the badge


class BadgeIssuer(BaseModel):
    id: str
    type: list[str]
    name: str


class BadgeCriteria(BaseModel):
    narrative: str


class BadgeAchievement(BaseModel):
    id: str
    type: list[str]
    name: str
    description: str
    criteria: BadgeCriteria


class BadgeResult(BaseModel):
    type: list[str]
    value: str


class BadgeCredentialSubject(BaseModel):
    type: list[str]
    name: str
    achievement: BadgeAchievement
    result: list[BadgeResult]


class BadgeEvidence(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="allow")

    type: list[str]
    name: str
    description: str
    dataset_hash: str = Field(alias="reconcore:datasetHash")
    seed: str = Field(alias="reconcore:seed")
    attempts: int = Field(alias="reconcore:attempts")
    hints_used: int = Field(alias="reconcore:hintsUsed")


class BadgeProof(BaseModel):
    type: str
    cryptosuite: str
    created: str
    verificationMethod: str
    proofPurpose: str
    proofValue: str


class BadgeCredential(BaseModel):
    # extra="allow" guarantees no field of a signed credential is ever silently dropped
    # on the way out (that would invalidate its own proof).
    model_config = ConfigDict(populate_by_name=True, extra="allow")

    context: list[str] = Field(alias="@context")
    id: str
    type: list[str]
    issuer: BadgeIssuer
    validFrom: str
    name: str
    credentialSubject: BadgeCredentialSubject
    evidence: list[BadgeEvidence]
    proof: BadgeProof


class SubmitResponse(BaseModel):
    passed: bool
    attempt_no: int
    field_status: FieldStatusMap
    tutor_hint: TutorHint | None = None
    badge: BadgeCredential | None = None
    summary: SolveSummary | None = None


# ----------------------------------------------------------------- verification


class VerifyRequest(BaseModel):
    badge: dict[str, Any] | None = None


class VerifyResponse(BaseModel):
    valid: bool
    signature_verified: bool
    hash_match: bool
    issuer_match: bool
    reason: VerifyReason | None = None
    checked_at: str


class IssuerProfile(BaseModel):
    id: str
    name: str
    public_key_multibase: str
    verification_method: str


# ----------------------------------------------------------------------- errors


class ApiErrorDetail(BaseModel):
    code: str
    message: str


class ApiErrorResponse(BaseModel):
    error: ApiErrorDetail
