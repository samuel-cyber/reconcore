"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type {
  BadgeCredential,
  FieldStatusMap,
  SessionInitResponse,
  SolveSummary,
  SubmitRequest,
  SubmitResponse,
  TutorHint,
} from "./api-types";

export interface AttemptRecord {
  attempt_no: number;
  submitted: Omit<SubmitRequest, "session_id">;
  field_status: FieldStatusMap;
  tutor_hint: TutorHint | null;
  passed: boolean;
  created_at: string;
}

export interface ToastMessage {
  id: number;
  type: "error" | "info";
  code?: string;
  message: string;
}

interface SessionContextValue {
  session: SessionInitResponse | null;
  candidateName: string;
  seed: string | undefined;
  attempts: AttemptRecord[];
  latestFieldStatus: FieldStatusMap | null;
  badge: BadgeCredential | null;
  summary: SolveSummary | null;
  badgeModalOpen: boolean;
  tutorSheetOpen: boolean;
  toast: ToastMessage | null;
  setSessionData: (
    session: SessionInitResponse,
    candidateName: string,
    seed?: string
  ) => void;
  recordSubmitResponse: (
    submitted: Omit<SubmitRequest, "session_id">,
    response: SubmitResponse
  ) => void;
  openBadgeModal: () => void;
  closeBadgeModal: () => void;
  setTutorSheetOpen: (open: boolean) => void;
  showToast: (message: string, code?: string, type?: "error" | "info") => void;
  dismissToast: () => void;
  resetSession: () => void;
}

const STORAGE_KEY = "reconcore_active_session_v1";

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionInitResponse | null>(null);
  const [candidateName, setCandidateName] = useState<string>("");
  const [seed, setSeed] = useState<string | undefined>(undefined);
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [latestFieldStatus, setLatestFieldStatus] =
    useState<FieldStatusMap | null>(null);
  const [badge, setBadge] = useState<BadgeCredential | null>(null);
  const [summary, setSummary] = useState<SolveSummary | null>(null);
  const [badgeModalOpen, setBadgeModalOpen] = useState<boolean>(false);
  const [tutorSheetOpen, setTutorSheetOpen] = useState<boolean>(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Hydrate from sessionStorage on mount so accidental page reload in workspace preserves state
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.session?.session_id) {
        setSession(parsed.session);
        setCandidateName(parsed.candidateName || "");
        setSeed(parsed.seed);
        setAttempts(Array.isArray(parsed.attempts) ? parsed.attempts : []);
        setLatestFieldStatus(parsed.latestFieldStatus || null);
        setBadge(parsed.badge || null);
        setSummary(parsed.summary || null);
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Persist to sessionStorage when state changes
  useEffect(() => {
    try {
      if (!session) {
        window.sessionStorage.removeItem(STORAGE_KEY);
        return;
      }
      window.sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          session,
          candidateName,
          seed,
          attempts,
          latestFieldStatus,
          badge,
          summary,
        })
      );
    } catch {
      // Ignore storage errors
    }
  }, [session, candidateName, seed, attempts, latestFieldStatus, badge, summary]);

  const setSessionData = useCallback(
    (
      newSession: SessionInitResponse,
      newCandidateName: string,
      newSeed?: string
    ) => {
      setSession(newSession);
      setCandidateName(newCandidateName);
      setSeed(newSeed);
      setAttempts([]);
      setLatestFieldStatus(null);
      setBadge(null);
      setSummary(null);
      setBadgeModalOpen(false);
      setTutorSheetOpen(false);
    },
    []
  );

  const recordSubmitResponse = useCallback(
    (
      submitted: Omit<SubmitRequest, "session_id">,
      response: SubmitResponse
    ) => {
      setLatestFieldStatus(response.field_status);

      const isInvalidFormatOnly =
        !response.passed &&
        Object.values(response.field_status).includes("invalid_format");

      if (!isInvalidFormatOnly) {
        const record: AttemptRecord = {
          attempt_no: response.attempt_no,
          submitted,
          field_status: response.field_status,
          tutor_hint: response.tutor_hint,
          passed: response.passed,
          created_at: new Date().toISOString(),
        };
        setAttempts((prev) => [record, ...prev]);
      }

      if (response.passed && response.badge) {
        setBadge(response.badge);
        setSummary(
          response.summary ?? {
            attempts: response.attempt_no,
            hints_used: attempts.filter((a) => a.tutor_hint !== null).length,
            seconds_to_solve: 0,
          }
        );
        setBadgeModalOpen(true);
        setTutorSheetOpen(false);
      } else {
        // Opens automatically on a failed attempt
        setTutorSheetOpen(true);
      }
    },
    [attempts]
  );

  const openBadgeModal = useCallback(() => {
    setBadgeModalOpen(true);
  }, []);

  const closeBadgeModal = useCallback(() => {
    setBadgeModalOpen(false);
  }, []);

  const showToast = useCallback(
    (
      message: string,
      code?: string,
      type: "error" | "info" = "error"
    ) => {
      const id = Date.now();
      setToast({ id, type, code, message });
    },
    []
  );

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  // Auto-dismiss toast after 6 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => {
      setToast((current) => (current?.id === toast.id ? null : current));
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const resetSession = useCallback(() => {
    setSession(null);
    setCandidateName("");
    setSeed(undefined);
    setAttempts([]);
    setLatestFieldStatus(null);
    setBadge(null);
    setSummary(null);
    setBadgeModalOpen(false);
    setTutorSheetOpen(false);
  }, []);

  return (
    <SessionContext.Provider
      value={{
        session,
        candidateName,
        seed,
        attempts,
        latestFieldStatus,
        badge,
        summary,
        badgeModalOpen,
        tutorSheetOpen,
        toast,
        setSessionData,
        recordSubmitResponse,
        openBadgeModal,
        closeBadgeModal,
        setTutorSheetOpen,
        showToast,
        dismissToast,
        resetSession,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return ctx;
}

