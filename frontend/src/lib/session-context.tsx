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

export type WorkspaceTabKey = "brief" | "answer" | "hints";

interface SessionContextValue {
  isHydrated: boolean;
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
  timerStartedAt: number | null;
  elapsedSeconds: number;
  activeWorkspaceTab: WorkspaceTabKey;
  checkedTasks: Record<number, boolean>;
  isSubmittingAttempt: boolean;
  submissionError: string | null;
  setSessionData: (
    session: SessionInitResponse,
    candidateName: string,
    seed?: string
  ) => void;
  startTimer: () => void;
  setActiveWorkspaceTab: (tab: WorkspaceTabKey) => void;
  toggleTaskChecked: (index: number) => void;
  setIsSubmittingAttempt: (loading: boolean) => void;
  setSubmissionError: (error: string | null) => void;
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
  const [isHydrated, setIsHydrated] = useState<boolean>(false);
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
  const [timerStartedAt, setTimerStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [activeWorkspaceTab, setActiveWorkspaceTab] =
    useState<WorkspaceTabKey>("brief");
  const [checkedTasks, setCheckedTasks] = useState<Record<number, boolean>>({});
  const [isSubmittingAttempt, setIsSubmittingAttempt] =
    useState<boolean>(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Hydrate from sessionStorage on mount so accidental page reload preserves state
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.session?.session_id) {
          setSession(parsed.session);
          setCandidateName(parsed.candidateName || "");
          setSeed(parsed.seed);
          setAttempts(Array.isArray(parsed.attempts) ? parsed.attempts : []);
          setLatestFieldStatus(parsed.latestFieldStatus || null);
          setBadge(parsed.badge || null);
          setSummary(parsed.summary || null);
          if (typeof parsed.timerStartedAt === "number") {
            setTimerStartedAt(parsed.timerStartedAt);
            const sec = Math.max(
              0,
              Math.floor((Date.now() - parsed.timerStartedAt) / 1000)
            );
            setElapsedSeconds(parsed.summary?.seconds_to_solve ?? sec);
          }
          if (parsed.checkedTasks && typeof parsed.checkedTasks === "object") {
            setCheckedTasks(parsed.checkedTasks);
          }
        }
      }
    } catch {
      // Ignore storage errors
    } finally {
      setIsHydrated(true);
    }
  }, []);

  // Persist to sessionStorage when state changes
  useEffect(() => {
    if (!isHydrated) return;
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
          timerStartedAt,
          checkedTasks,
        })
      );
    } catch {
      // Ignore storage errors
    }
  }, [
    isHydrated,
    session,
    candidateName,
    seed,
    attempts,
    latestFieldStatus,
    badge,
    summary,
    timerStartedAt,
    checkedTasks,
  ]);

  // Tick elapsed timer once started until solved
  useEffect(() => {
    if (!timerStartedAt) {
      setElapsedSeconds(0);
      return;
    }
    if (badge && summary?.seconds_to_solve) {
      setElapsedSeconds(summary.seconds_to_solve);
      return;
    }
    const update = () => {
      setElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - timerStartedAt) / 1000))
      );
    };
    update();
    if (badge) return;
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [timerStartedAt, badge, summary]);

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
      // Timer starts when candidate clicks "Begin" on /briefing
      setTimerStartedAt(null);
      setElapsedSeconds(0);
      setActiveWorkspaceTab("brief");
      setCheckedTasks({});
      setIsSubmittingAttempt(false);
      setSubmissionError(null);
    },
    []
  );

  const startTimer = useCallback(() => {
    setTimerStartedAt((prev) => prev ?? Date.now());
  }, []);

  const toggleTaskChecked = useCallback((index: number) => {
    setCheckedTasks((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  }, []);

  const recordSubmitResponse = useCallback(
    (
      submitted: Omit<SubmitRequest, "session_id">,
      response: SubmitResponse
    ) => {
      setLatestFieldStatus(response.field_status);
      setSubmissionError(null);

      const isInvalidFormatOnly =
        !response.passed &&
        Object.values(response.field_status).includes("invalid_format");

      const record: AttemptRecord = {
        attempt_no: isInvalidFormatOnly
          ? attempts.length > 0
            ? attempts[0].attempt_no
            : 1
          : response.attempt_no,
        submitted,
        field_status: response.field_status,
        tutor_hint: response.tutor_hint,
        passed: response.passed,
        created_at: new Date().toISOString(),
      };

      if (!isInvalidFormatOnly || response.tutor_hint) {
        setAttempts((prev) => [record, ...prev]);
      }

      if (response.passed && response.badge) {
        const computedSeconds = timerStartedAt
          ? Math.max(1, Math.floor((Date.now() - timerStartedAt) / 1000))
          : response.summary?.seconds_to_solve ?? 0;

        setBadge(response.badge);
        setSummary(
          response.summary ?? {
            attempts: response.attempt_no,
            hints_used: attempts.filter((a) => a.tutor_hint !== null).length,
            seconds_to_solve: computedSeconds,
          }
        );
        setBadgeModalOpen(true);
        setTutorSheetOpen(false);
      } else {
        // Tutor opens as a slide-over after a failed attempt
        setTutorSheetOpen(true);
      }
    },
    [attempts, timerStartedAt]
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
    setTimerStartedAt(null);
    setElapsedSeconds(0);
    setActiveWorkspaceTab("brief");
    setCheckedTasks({});
    setIsSubmittingAttempt(false);
    setSubmissionError(null);
  }, []);

  return (
    <SessionContext.Provider
      value={{
        isHydrated,
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
        timerStartedAt,
        elapsedSeconds,
        activeWorkspaceTab,
        checkedTasks,
        isSubmittingAttempt,
        submissionError,
        setSessionData,
        startTimer,
        setActiveWorkspaceTab,
        toggleTaskChecked,
        setIsSubmittingAttempt,
        setSubmissionError,
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
