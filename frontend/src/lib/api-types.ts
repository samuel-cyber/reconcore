/**
 * This file mirrors the OpenAPI 3.1 contract generated from FastAPI `backend/app/schemas.py`
 * via `npx openapi-typescript <BACKEND_URL>/openapi.json -o src/lib/api-types.ts`.
 */

export type TableKey = "pos" | "waybills" | "bank";

export type FieldStatus = "correct" | "incorrect" | "invalid_format";

export type HintSource = "llm" | "template";

export type VerifyReason =
  | "signature_invalid"
  | "hash_unknown"
  | "issuer_unknown"
  | "malformed"
  | null;

export interface HealthResponse {
  ok: boolean;
  llm: "up" | "fallback";
  /** Present only in fallback: why the last LLM call failed (or was not made). */
  llm_reason?: string | null;
}

export interface ScenarioInfo {
  id: string;
  title: string;
}

export interface BriefInfo {
  from: string;
  body_markdown: string;
  task_definitions: string[];
}

export interface TableData {
  filename: string;
  columns: string[];
  rows: string[][];
}

export interface SessionTables {
  pos: TableData;
  waybills: TableData;
  bank: TableData;
}

export interface SessionInitRequest {
  seed?: string;
  candidate_name: string;
}

export interface SessionInitResponse {
  session_id: string;
  scenario: ScenarioInfo;
  brief: BriefInfo;
  tables: SessionTables;
  dataset_hash: string;
  max_hint_level: number;
}

export interface SubmitRequest {
  session_id: string;
  discrepancy_ngn: string;
  missing_tx_id: string;
  duplicate_wb_id: string;
}

export interface FieldStatusMap {
  discrepancy_ngn: FieldStatus;
  missing_tx_id: FieldStatus;
  duplicate_wb_id: FieldStatus;
}

export interface TutorHint {
  level: number;
  text: string;
  source: HintSource;
}

export interface SolveSummary {
  attempts: number;
  hints_used: number;
  seconds_to_solve: number;
}

export interface BadgeIssuer {
  id: string;
  type: string[];
  name: string;
}

export interface BadgeAchievement {
  id: string;
  type: string[];
  name: string;
  description: string;
  criteria: {
    narrative: string;
  };
}

export interface BadgeCredentialSubject {
  type: string[];
  name: string;
  achievement: BadgeAchievement;
  result: Array<{
    type: string[];
    value: string;
  }>;
}

export interface BadgeEvidence {
  type: string[];
  name: string;
  description: string;
  "reconcore:datasetHash": string;
  "reconcore:seed": string;
  "reconcore:attempts": number;
  "reconcore:hintsUsed": number;
}

export interface BadgeProof {
  type: string;
  cryptosuite: string;
  created: string;
  verificationMethod: string;
  proofPurpose: string;
  proofValue: string;
}

export interface BadgeCredential {
  "@context": string[];
  id: string;
  type: string[];
  issuer: BadgeIssuer;
  validFrom: string;
  name: string;
  credentialSubject: BadgeCredentialSubject;
  evidence: BadgeEvidence[];
  proof: BadgeProof;
}

export interface SubmitResponse {
  passed: boolean;
  attempt_no: number;
  field_status: FieldStatusMap;
  tutor_hint: TutorHint | null;
  badge: BadgeCredential | null;
  summary?: SolveSummary | null;
}

export interface VerifyRequest {
  badge: BadgeCredential | Record<string, unknown>;
}

export interface VerifyResponse {
  valid: boolean;
  signature_verified: boolean;
  hash_match: boolean;
  issuer_match: boolean;
  reason: VerifyReason;
  checked_at: string;
}

export interface IssuerProfile {
  id: string;
  name: string;
  public_key_multibase: string;
  verification_method: string;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
}

export interface ApiErrorResponse {
  error: ApiErrorDetail;
}

export interface components {
  schemas: {
    HealthResponse: HealthResponse;
    SessionInitRequest: SessionInitRequest;
    SessionInitResponse: SessionInitResponse;
    SubmitRequest: SubmitRequest;
    SubmitResponse: SubmitResponse;
    VerifyRequest: VerifyRequest;
    VerifyResponse: VerifyResponse;
    IssuerProfile: IssuerProfile;
    ApiErrorResponse: ApiErrorResponse;
  };
}

export interface paths {
  "/health": {
    get: {
      responses: {
        200: { content: { "application/json": HealthResponse } };
      };
    };
  };
  "/api/session/init": {
    post: {
      requestBody: { content: { "application/json": SessionInitRequest } };
      responses: {
        200: { content: { "application/json": SessionInitResponse } };
      };
    };
  };
  "/api/session/{session_id}/csv/{table}": {
    get: {
      parameters: { path: { session_id: string; table: TableKey } };
      responses: {
        200: { content: { "text/csv": string } };
      };
    };
  };
  "/api/session/{session_id}/csv.zip": {
    get: {
      parameters: { path: { session_id: string } };
      responses: {
        200: { content: { "application/zip": Blob } };
      };
    };
  };
  "/api/session/submit": {
    post: {
      requestBody: { content: { "application/json": SubmitRequest } };
      responses: {
        200: { content: { "application/json": SubmitResponse } };
      };
    };
  };
  "/api/credential/verify": {
    post: {
      requestBody: { content: { "application/json": VerifyRequest } };
      responses: {
        200: { content: { "application/json": VerifyResponse } };
      };
    };
  };
  "/api/issuer": {
    get: {
      responses: {
        200: { content: { "application/json": IssuerProfile } };
      };
    };
  };
}

