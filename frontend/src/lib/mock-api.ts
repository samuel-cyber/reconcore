/**
 * Mock backend for local UI work only.
 *
 * This module is loaded exclusively when NEXT_PUBLIC_USE_MOCKS=true. It is never used
 * as a fallback for a real backend that is slow or unreachable: grading and
 * verification done here are simulations (string comparisons against fixtures), so
 * presenting them as real results would misrepresent the product. Every hint it
 * returns is labelled "template" because no model is involved.
 */
import type {
  BadgeCredential,
  FieldStatus,
  FieldStatusMap,
  HintSource,
  IssuerProfile,
  SessionInitRequest,
  SessionInitResponse,
  SubmitRequest,
  SubmitResponse,
  VerifyResponse,
} from "./api-types";
import { ApiError } from "./api-error";

import initFixture from "../mocks/init.json";
import submitFailFixture from "../mocks/submit-fail.json";
import submitPassFixture from "../mocks/submit-pass.json";
import verifyValidFixture from "../mocks/verify-valid.json";
import verifyInvalidFixture from "../mocks/verify-invalid.json";
import issuerFixture from "../mocks/issuer.json";

// Track mock session state in memory so demo loop in mock mode feels completely real
interface MockSessionState {
  candidateName: string;
  seed: string;
  startedAtMs: number;
  attemptsCount: number;
  hintsUsed: number;
  solved: boolean;
  issuedBadge: BadgeCredential | null;
}

const mockSessions = new Map<string, MockSessionState>();

function parseMockNaira(raw: string): number | null {
  let cleaned = raw.trim();
  if (!cleaned) return null;
  cleaned = cleaned.replace(/^(?:₦|NGN|N)\s*/i, "").replace(/,/g, "").trim();
  if (!/^\d+(?:\.\d+)?$/.test(cleaned)) {
    return null;
  }
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num <= 0 || !Number.isInteger(num)) {
    return null;
  }
  return num;
}

function normaliseId(raw: string): string {
  return raw.trim().toUpperCase();
}

const HINT_LADDER: Record<
  number,
  {
    discrepancy: string;
    missing_tx: string;
    duplicate_wb: string;
    source: HintSource;
  }
> = {
  1: {
    discrepancy: "Which payment methods should reach the bank at all?",
    missing_tx: "Which table should every transfer show up in?",
    duplicate_wb: "Which table records physical stock moving?",
    source: "template",
  },
  2: {
    discrepancy: "Compare transfer sales against credits, not all sales.",
    missing_tx: "Match on the customer reference, not the amount.",
    duplicate_wb: "Look for two rows that are the same delivery written differently.",
    source: "template",
  },
  3: {
    discrepancy: "Check the dates in October; one transfer has no partner.",
    missing_tx: "Two transfers share an amount; only one is in the bank.",
    duplicate_wb: "Product names can be misspelled; normalise dates before comparing.",
    source: "template",
  },
};

function buildMockTutorHint(
  level: number,
  fieldStatus: FieldStatusMap,
  submittedAmount: number | null,
  submittedTx: string,
  submittedWb: string
): { level: number; text: string; source: HintSource } {
  const clampedLevel = Math.min(Math.max(level, 1), 3);

  // If the exact fail fixture scenario is matched on attempt 1, return the fixture hint text
  if (
    clampedLevel === 1 &&
    fieldStatus.discrepancy_ngn === "incorrect" &&
    fieldStatus.missing_tx_id === "incorrect" &&
    fieldStatus.duplicate_wb_id === "correct"
  ) {
    return {
      level: 1,
      text: submitFailFixture.tutor_hint.text,
      source: "template" as HintSource,
    };
  }

  const ladder = HINT_LADDER[clampedLevel] ?? HINT_LADDER[3];
  const parts: string[] = [];

  if (fieldStatus.discrepancy_ngn !== "correct") {
    if (submittedAmount === 201500) {
      parts.push(
        "Cash transactions stay in the physical till and never reach the bank statement."
      );
    }
    parts.push(ladder.discrepancy);
  }

  if (fieldStatus.missing_tx_id !== "correct") {
    if (submittedTx === "POS-1049") {
      parts.push(
        "That transaction shares the same Naira value, but check whether its customer_ref is already credited in bank_settlement.csv."
      );
    } else {
      parts.push(ladder.missing_tx);
    }
  }

  if (fieldStatus.duplicate_wb_id !== "correct") {
    if (submittedWb === "WB-3307") {
      parts.push(
        "You found the original waybill row — remember the brief asks for the later-listed duplicate ID, not the original."
      );
    } else {
      parts.push(ladder.duplicate_wb);
    }
  }

  return {
    level: clampedLevel,
    text: parts.slice(0, 2).join(" "),
    source: ladder.source,
  };
}

function runMockInitSession(
  payload: SessionInitRequest,
  candidateName: string
): SessionInitResponse {
  const response: SessionInitResponse = structuredClone(
    initFixture
  ) as SessionInitResponse;
  mockSessions.set(response.session_id, {
    candidateName,
    seed: payload.seed || "demo",
    startedAtMs: Date.now(),
    attemptsCount: 0,
    hintsUsed: 0,
    solved: false,
    issuedBadge: null,
  });
  return response;
}

function runMockSubmitAttempt(payload: SubmitRequest): SubmitResponse {
  let state = mockSessions.get(payload.session_id);
  if (!state) {
    state = {
      candidateName: "Ada Okafor",
      seed: "demo",
      startedAtMs: Date.now() - 412_000,
      attemptsCount: 0,
      hintsUsed: 0,
      solved: false,
      issuedBadge: null,
    };
    mockSessions.set(payload.session_id, state);
  }

  if (state.solved) {
    throw new ApiError(
      "already_solved",
      "This reconciliation session has already been solved and its credential issued.",
      409
    );
  }

  const idRegex = /^[A-Za-z0-9-]{1,20}$/;
  const txId = normaliseId(payload.missing_tx_id);
  const wbId = normaliseId(payload.duplicate_wb_id);

  if (!idRegex.test(txId) || !idRegex.test(wbId)) {
    throw new ApiError(
      "invalid_input",
      "Transaction and waybill IDs must be 1–20 letters, digits or hyphens, copied exactly as they appear in the tables.",
      422
    );
  }

  const parsedAmount = parseMockNaira(payload.discrepancy_ngn);
  const amountStatus: FieldStatus =
    parsedAmount === null
      ? "invalid_format"
      : parsedAmount === 45000
        ? "correct"
        : "incorrect";

  const txStatus: FieldStatus = txId === "POS-1042" ? "correct" : "incorrect";
  const wbStatus: FieldStatus = wbId === "WB-3311" ? "correct" : "incorrect";

  const field_status: FieldStatusMap = {
    discrepancy_ngn: amountStatus,
    missing_tx_id: txStatus,
    duplicate_wb_id: wbStatus,
  };

  // Per section 5.5: invalid_format is not counted as an attempt
  if (amountStatus === "invalid_format") {
    return {
      passed: false,
      attempt_no: state.attemptsCount,
      field_status,
      tutor_hint: {
        level: Math.max(state.hintsUsed, 1),
        text: "Enter the discrepancy as a whole Naira amount without kobo fractions (a ₦ sign and commas are fine).",
        source: "template",
      },
      badge: null,
    };
  }

  state.attemptsCount += 1;
  const allCorrect =
    amountStatus === "correct" &&
    txStatus === "correct" &&
    wbStatus === "correct";

  if (allCorrect) {
    state.solved = true;
    const elapsedSeconds = Math.max(
      12,
      Math.round((Date.now() - state.startedAtMs) / 1000)
    );
    const secondsToSolve =
      state.attemptsCount === 2 && state.hintsUsed === 1 ? 412 : elapsedSeconds;

    const passCopy = structuredClone(submitPassFixture) as SubmitResponse;
    passCopy.attempt_no = state.attemptsCount;
    passCopy.summary = {
      attempts: state.attemptsCount,
      hints_used: state.hintsUsed,
      seconds_to_solve: secondsToSolve,
    };
    if (passCopy.badge) {
      passCopy.badge.credentialSubject.name = state.candidateName;
      if (passCopy.badge.evidence?.[0]) {
        passCopy.badge.evidence[0]["reconcore:attempts"] = state.attemptsCount;
        passCopy.badge.evidence[0]["reconcore:hintsUsed"] = state.hintsUsed;
        passCopy.badge.evidence[0].description = `Solved in ${state.attemptsCount} ${
          state.attemptsCount === 1 ? "attempt" : "attempts"
        } with ${state.hintsUsed} ${
          state.hintsUsed === 1 ? "hint" : "hints"
        } in ${secondsToSolve} seconds.`;
      }
      state.issuedBadge = structuredClone(passCopy.badge);
    }
    return passCopy;
  }

  state.hintsUsed = Math.min(state.hintsUsed + 1, 3);
  const hint = buildMockTutorHint(
    state.hintsUsed,
    field_status,
    parsedAmount,
    txId,
    wbId
  );

  return {
    passed: false,
    attempt_no: state.attemptsCount,
    field_status,
    tutor_hint: hint,
    badge: null,
  };
}

function runMockVerifyBadge(
  badge: BadgeCredential | Record<string, unknown>
): VerifyResponse {
  const nowIso = new Date().toISOString();
  if (!badge || typeof badge !== "object" || Array.isArray(badge)) {
    return {
      valid: false,
      signature_verified: false,
      hash_match: false,
      issuer_match: false,
      reason: "malformed",
      checked_at: nowIso,
    };
  }

  const candidate = badge as Partial<BadgeCredential>;
  if (
    !Array.isArray(candidate["@context"]) ||
    !candidate.issuer ||
    typeof candidate.issuer.id !== "string" ||
    !candidate.credentialSubject ||
    typeof candidate.credentialSubject.name !== "string" ||
    !candidate.proof ||
    typeof candidate.proof.proofValue !== "string" ||
    !Array.isArray(candidate.evidence) ||
    candidate.evidence.length === 0
  ) {
    return {
      valid: false,
      signature_verified: false,
      hash_match: false,
      issuer_match: false,
      reason: "malformed",
      checked_at: nowIso,
    };
  }

  const expectedIssuerId = issuerFixture.id;
  const expectedHash = initFixture.dataset_hash;
  const expectedProofValue = submitPassFixture.badge.proof.proofValue;

  const issuerMatch =
    candidate.issuer.id === expectedIssuerId &&
    candidate.proof.verificationMethod === issuerFixture.verification_method;

  if (!issuerMatch) {
    return {
      valid: false,
      signature_verified: false,
      hash_match:
        candidate.evidence[0]?.["reconcore:datasetHash"] === expectedHash,
      issuer_match: false,
      reason: "issuer_unknown",
      checked_at: nowIso,
    };
  }

  const hashMatch =
    candidate.evidence[0]?.["reconcore:datasetHash"] === expectedHash;

  // Check if any signed field was tampered with
  const latestSession = Array.from(mockSessions.values()).pop();
  const expectedNames = new Set<string>([
    submitPassFixture.badge.credentialSubject.name,
    ...(latestSession?.issuedBadge
      ? [latestSession.issuedBadge.credentialSubject.name]
      : []),
    ...(latestSession?.candidateName ? [latestSession.candidateName] : []),
  ]);

  const nameUntampered =
    expectedNames.has(candidate.credentialSubject.name) &&
    !candidate.credentialSubject.name.includes("(edited)");

  const achievementUntampered =
    candidate.credentialSubject.achievement?.id ===
      submitPassFixture.badge.credentialSubject.achievement.id &&
    candidate.credentialSubject.achievement?.name ===
      submitPassFixture.badge.credentialSubject.achievement.name &&
    candidate.credentialSubject.result?.[0]?.value ===
      submitPassFixture.badge.credentialSubject.result[0].value;

  const proofUntampered = candidate.proof.proofValue === expectedProofValue;
  const signatureVerified =
    nameUntampered && achievementUntampered && proofUntampered;

  if (!signatureVerified) {
    return {
      ...(verifyInvalidFixture as VerifyResponse),
      signature_verified: false,
      hash_match: hashMatch,
      issuer_match: true,
      reason: "signature_invalid",
      checked_at: nowIso,
    };
  }

  if (!hashMatch) {
    return {
      valid: false,
      signature_verified: true,
      hash_match: false,
      issuer_match: true,
      reason: "hash_unknown",
      checked_at: nowIso,
    };
  }

  return {
    ...(verifyValidFixture as VerifyResponse),
    checked_at: nowIso,
  };
}


export function initSession(
  payload: SessionInitRequest,
  candidateName: string
): SessionInitResponse {
  return runMockInitSession(payload, candidateName);
}

export function submitAttempt(payload: SubmitRequest): SubmitResponse {
  return runMockSubmitAttempt(payload);
}

export function verifyBadge(
  badge: BadgeCredential | Record<string, unknown>
): VerifyResponse {
  return runMockVerifyBadge(badge);
}

export function getIssuer(): IssuerProfile {
  return structuredClone(issuerFixture) as IssuerProfile;
}

export function sampleCredential(): BadgeCredential {
  return structuredClone(submitPassFixture.badge) as unknown as BadgeCredential;
}
