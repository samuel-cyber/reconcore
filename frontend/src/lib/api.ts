import type {
  ApiErrorResponse,
  BadgeCredential,
  HealthResponse,
  IssuerProfile,
  SessionInitRequest,
  SessionInitResponse,
  SubmitRequest,
  SubmitResponse,
  TableKey,
  VerifyResponse,
} from "./api-types";
import { ApiError } from "./api-error";

export { ApiError };

/**
 * Mock mode is an explicit build-time switch for UI work without a backend. It is
 * never entered automatically: if the real backend cannot be reached, the call fails
 * with a visible error. Grading and credential verification only ever happen on the
 * server.
 */
export function isMockMode(): boolean {
  return process.env.NEXT_PUBLIC_USE_MOCKS === "true";
}

// Call sites test the env var literally (not through isMockMode()) so the bundler can
// prove the branch dead in a real build and leave the fixtures, which contain the demo
// answers, out of the shipped JavaScript entirely.
const loadMock = () => import("./mock-api");

export function getApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }
  if (
    typeof window !== "undefined" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1"
  ) {
    return "https://reconcore-api.onrender.com";
  }
  return "http://localhost:8000";
}

async function parseResponse<T>(res: Response): Promise<T> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // Non-JSON error response
  }

  if (!res.ok) {
    const maybeErr = body as Partial<ApiErrorResponse> & {
      detail?: string | { code?: string; message?: string };
    };
    if (maybeErr?.error?.code && maybeErr?.error?.message) {
      throw new ApiError(maybeErr.error.code, maybeErr.error.message, res.status);
    }
    if (typeof maybeErr?.detail === "object" && maybeErr.detail?.code) {
      throw new ApiError(
        maybeErr.detail.code,
        maybeErr.detail.message ?? `Request failed (${res.status})`,
        res.status
      );
    }
    const fallbackCode =
      res.status === 404
        ? "session_not_found"
        : res.status === 409
          ? "already_solved"
          : res.status === 422
            ? "invalid_input"
            : "request_failed";
    const fallbackMessage =
      typeof maybeErr?.detail === "string"
        ? maybeErr.detail
        : `Request failed with status ${res.status}`;
    throw new ApiError(fallbackCode, fallbackMessage, res.status);
  }

  return body as T;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Gateway statuses a sleeping or restarting host returns while it boots. */
const WAKING_STATUSES = new Set([502, 503, 504]);

interface RequestOptions {
  /** Keep retrying network failures and 502/503/504 for this long. */
  retryForMs: number;
  /** Abort a single attempt after this long. */
  attemptTimeoutMs?: number;
}

/**
 * One call to the real backend. A free-tier host sleeps when idle and takes up to a
 * minute to wake, so connection failures are retried for `retryForMs` before giving
 * up with a clear `server_unreachable` error. There is deliberately no offline
 * substitute.
 */
async function request<T>(
  path: string,
  init: RequestInit,
  { retryForMs, attemptTimeoutMs = 75_000 }: RequestOptions
): Promise<T> {
  const startedAt = Date.now();
  let delay = 1500;

  for (;;) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), attemptTimeoutMs);
    let res: Response | null = null;
    try {
      res = await fetch(`${getApiBaseUrl()}${path}`, {
        ...init,
        signal: controller.signal,
      });
    } catch {
      res = null;
    } finally {
      clearTimeout(timer);
    }

    if (res && !WAKING_STATUSES.has(res.status)) {
      return parseResponse<T>(res);
    }

    if (Date.now() - startedAt + delay > retryForMs) {
      throw new ApiError(
        "server_unreachable",
        "Could not reach the ReconCore server. It may still be waking up — wait a few seconds and try again.",
        res?.status ?? 0
      );
    }
    await sleep(delay);
    delay = Math.min(delay * 1.5, 6000);
  }
}

const JSON_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
};

export async function checkHealth(): Promise<HealthResponse> {
  if (process.env.NEXT_PUBLIC_USE_MOCKS === "true") {
    return { ok: true, llm: "fallback", llm_reason: "mock mode" };
  }
  return request<HealthResponse>(
    "/health",
    { method: "GET", headers: { Accept: "application/json" } },
    { retryForMs: 0, attemptTimeoutMs: 20_000 }
  );
}

export async function initSession(
  payload: SessionInitRequest
): Promise<SessionInitResponse> {
  const candidateName = payload.candidate_name.trim();
  if (!candidateName || candidateName.length > 60) {
    throw new ApiError(
      "invalid_input",
      "Candidate name must be between 1 and 60 characters.",
      422
    );
  }

  if (process.env.NEXT_PUBLIC_USE_MOCKS === "true") {
    return (await loadMock()).initSession(payload, candidateName);
  }

  return request<SessionInitResponse>(
    "/api/session/init",
    {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        ...(payload.seed ? { seed: payload.seed } : {}),
        candidate_name: candidateName,
      }),
    },
    // Long enough to ride out a cold start on a free-tier host.
    { retryForMs: 90_000 }
  );
}

export async function submitAttempt(
  payload: SubmitRequest
): Promise<SubmitResponse> {
  if (process.env.NEXT_PUBLIC_USE_MOCKS === "true") {
    return (await loadMock()).submitAttempt(payload);
  }

  return request<SubmitResponse>(
    "/api/session/submit",
    { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(payload) },
    { retryForMs: 45_000 }
  );
}

export async function verifyBadge(
  badge: BadgeCredential | Record<string, unknown>
): Promise<VerifyResponse> {
  if (process.env.NEXT_PUBLIC_USE_MOCKS === "true") {
    return (await loadMock()).verifyBadge(badge);
  }

  return request<VerifyResponse>(
    "/api/credential/verify",
    { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ badge }) },
    { retryForMs: 60_000 }
  );
}

export async function getIssuer(): Promise<IssuerProfile> {
  if (process.env.NEXT_PUBLIC_USE_MOCKS === "true") {
    return (await loadMock()).getIssuer();
  }

  return request<IssuerProfile>(
    "/api/issuer",
    { method: "GET", headers: { Accept: "application/json" } },
    { retryForMs: 60_000 }
  );
}

/**
 * A specimen credential for the employer verifier. From the real backend it is
 * genuinely signed with the live issuer key, so it verifies for real and any edit to
 * it fails for real.
 */
export async function getSampleCredential(): Promise<BadgeCredential> {
  if (process.env.NEXT_PUBLIC_USE_MOCKS === "true") {
    return (await loadMock()).sampleCredential();
  }

  return request<BadgeCredential>(
    "/api/credential/sample",
    { method: "GET", headers: { Accept: "application/json" } },
    { retryForMs: 60_000 }
  );
}

export function csvZipUrl(sessionId: string): string {
  const encodedId = encodeURIComponent(sessionId);
  if (process.env.NEXT_PUBLIC_USE_MOCKS === "true") {
    return `/api/session/${encodedId}/csv.zip`;
  }
  return `${getApiBaseUrl()}/api/session/${encodedId}/csv.zip`;
}

export function csvTableUrl(sessionId: string, table: TableKey): string {
  const encodedId = encodeURIComponent(sessionId);
  if (process.env.NEXT_PUBLIC_USE_MOCKS === "true") {
    return `/api/session/${encodedId}/csv/${table}`;
  }
  return `${getApiBaseUrl()}/api/session/${encodedId}/csv/${table}`;
}
