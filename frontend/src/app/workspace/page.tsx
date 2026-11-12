"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Award,
  CheckCircle2,
  Clock,
  FileText,
  GraduationCap,
  Inbox,
  Loader2,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { initSession, isMockMode } from "@/lib/api";
import { useSession, type WorkspaceTabKey } from "@/lib/session-context";
import BriefPanel from "@/components/BriefPanel";
import SubmissionForm from "@/components/SubmissionForm";
import DataViewer from "@/components/DataViewer";
import TutorDrawer, { HintsHistoryPanel } from "@/components/TutorDrawer";
import BadgeModal from "@/components/BadgeModal";

const LEFT_TABS: Array<{
  key: WorkspaceTabKey;
  label: string;
}> = [
  { key: "brief", label: "Brief" },
  { key: "answer", label: "Answer" },
  { key: "hints", label: "Hints" },
];

function formatTimer(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export default function WorkspacePage() {
  const router = useRouter();
  const {
    isHydrated,
    session,
    candidateName,
    seed,
    attempts,
    latestFieldStatus,
    badge,
    timerStartedAt,
    elapsedSeconds,
    activeWorkspaceTab,
    setActiveWorkspaceTab,
    setSessionData,
    startTimer,
    openBadgeModal,
    resetSession,
    showToast,
  } = useSession();

  const [isQuickStarting, setIsQuickStarting] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [urlSeedDemo, setUrlSeedDemo] = useState(false);

  const tabBaseId = useId();
  const leftTabRefs = useRef<Record<WorkspaceTabKey, HTMLButtonElement | null>>({
    brief: null,
    answer: null,
    hints: null,
  });

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("seed") === "demo") {
        setUrlSeedDemo(true);
      }
    } catch {
      // Ignore URL parsing issues
    }
  }, []);

  // Ensure timer is running once in workspace with an active session
  useEffect(() => {
    if (isHydrated && session && !timerStartedAt) {
      startTimer();
    }
  }, [isHydrated, session, timerStartedAt, startTimer]);

  // Auto-initialize demo session if user/test opens /workspace directly without a session
  useEffect(() => {
    if (!isHydrated || session || isQuickStarting) return;
    let cancelled = false;

    const autoInit = async () => {
      setIsQuickStarting(true);
      setWorkspaceError(null);
      try {
        const params = new URLSearchParams(window.location.search);
        const seedParam = params.get("seed");
        const res = await initSession({
          seed: seedParam || "demo",
          candidate_name: "Ada Okafor",
        });
        if (!cancelled) {
          setSessionData(
            res,
            "Ada Okafor",
            seedParam === "demo" ? "demo" : undefined
          );
          startTimer();
        }
      } catch (err) {
        if (!cancelled) {
          setWorkspaceError(
            err instanceof Error
              ? err.message
              : "Failed to initialize workspace session."
          );
        }
      } finally {
        if (!cancelled) {
          setIsQuickStarting(false);
        }
      }
    };

    autoInit();
    return () => {
      cancelled = true;
    };
  }, [isHydrated, session, isQuickStarting, setSessionData, startTimer]);

  const handleQuickDemoInit = async () => {
    if (isQuickStarting) return;
    setIsQuickStarting(true);
    setWorkspaceError(null);
    try {
      const res = await initSession({
        seed: "demo",
        candidate_name: "Ada Okafor",
      });
      setSessionData(res, "Ada Okafor", urlSeedDemo ? "demo" : undefined);
      startTimer();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to initialize demo session.";
      setWorkspaceError(msg);
      showToast(msg, "init_failed", "error");
    } finally {
      setIsQuickStarting(false);
    }
  };

  const handleNewSession = () => {
    resetSession();
    router.push("/");
  };

  const selectAndFocusLeftTab = (nextKey: WorkspaceTabKey) => {
    setActiveWorkspaceTab(nextKey);
    const btn = leftTabRefs.current[nextKey];
    if (btn) {
      btn.focus();
    }
  };

  const handleLeftTabKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = LEFT_TABS[(index + 1) % LEFT_TABS.length];
      selectAndFocusLeftTab(next.key);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prev =
        LEFT_TABS[(index - 1 + LEFT_TABS.length) % LEFT_TABS.length];
      selectAndFocusLeftTab(prev.key);
    } else if (e.key === "Home") {
      e.preventDefault();
      selectAndFocusLeftTab(LEFT_TABS[0].key);
    } else if (e.key === "End") {
      e.preventDefault();
      selectAndFocusLeftTab(LEFT_TABS[LEFT_TABS.length - 1].key);
    }
  };

  const totalAttempts = attempts.length > 0 ? attempts[0].attempt_no : 0;
  const hintsCount = attempts.filter(
    (a) => !a.passed && a.tutor_hint !== null
  ).length;

  const fieldsCorrectCount = badge
    ? 3
    : latestFieldStatus
      ? Object.values(latestFieldStatus).filter((v) => v === "correct").length
      : 0;

  const showSeed = seed === "demo" || urlSeedDemo;

  // Loading / Error / Empty states before session is ready
  if (!isHydrated || isQuickStarting || !session) {
    return (
      <div className="flex min-h-dvh flex-col bg-slate-50">
        <header className="border-b border-slate-200 bg-white px-6 py-4">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-bold text-slate-900"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 font-mono text-xs font-bold text-white">
                RC
              </span>
              <span>ReconCore Workspace</span>
            </Link>
            <Link
              href="/verify"
              className="text-xs font-semibold text-slate-700 hover:text-slate-900"
            >
              Employer Verifier →
            </Link>
          </div>
        </header>

        <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center px-6 text-center">
          {(!isHydrated || isQuickStarting) && (
            <div
              role="status"
              className="flex w-full flex-col items-center gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-2xs"
            >
              <Loader2
                className="h-8 w-8 animate-spin text-slate-900"
                aria-hidden="true"
              />
              <div>
                <h1 className="text-base font-bold text-slate-900">
                  Loading Reconciliation Workspace…
                </h1>
                <p className="mt-1 text-xs text-slate-500">
                  Preparing source CSV tables and grading session.
                </p>
              </div>
            </div>
          )}

          {isHydrated && !isQuickStarting && workspaceError && (
            <div
              role="alert"
              className="flex w-full flex-col gap-4 rounded-xl border border-red-300 bg-red-50 p-6 text-left text-red-950 shadow-2xs"
            >
              <div className="flex items-start gap-2">
                <AlertCircle
                  className="mt-0.5 h-5 w-5 shrink-0 text-red-700"
                  aria-hidden="true"
                />
                <div>
                  <h1 className="text-base font-bold">
                    Workspace Initialization Error
                  </h1>
                  <p className="mt-1 text-xs text-red-900">{workspaceError}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleQuickDemoInit}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                <span>Retry Workspace Load</span>
              </button>
            </div>
          )}

          {isHydrated && !isQuickStarting && !workspaceError && !session && (
            <div className="flex w-full flex-col items-center gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-2xs">
              <Inbox className="h-8 w-8 text-slate-400" aria-hidden="true" />
              <div>
                <h1 className="text-base font-bold text-slate-900">
                  No Active Reconciliation Session
                </h1>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Start from the landing page or launch the default scenario.
                </p>
              </div>
              <button
                type="button"
                onClick={handleQuickDemoInit}
                className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                <span>Launch Workspace</span>
              </button>
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-dvh min-h-dvh flex-col overflow-hidden bg-slate-100">
      {/* Workspace Header: Shows Timer, Attempts, and Fields Correct (n/3) */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-900 hover:opacity-80"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 font-mono text-xs font-bold text-white">
              RC
            </span>
            <span>ReconCore</span>
          </Link>

          <span className="text-slate-300" aria-hidden="true">
            /
          </span>

          <h1 className="truncate text-sm font-semibold text-slate-800">
            {session.scenario.title}
          </h1>

          {showSeed && (
            <span className="hidden rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-xs text-slate-600 md:inline-block">
              seed=demo
            </span>
          )}

          {isMockMode() && (
            <span className="hidden rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 font-mono text-xs font-semibold text-amber-900 lg:inline-block">
              MOCK MODE
            </span>
          )}
        </div>

        {/* Status Metrics + Actions */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Header Metrics: Timer, Attempts, Fields Correct (n/3) */}
          <div
            aria-label="Session progress metrics"
            className="flex flex-wrap items-center gap-2"
          >
            {/* Timer */}
            <div
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800"
              title="Elapsed assessment time since clicking Begin"
            >
              <Clock
                className="h-3.5 w-3.5 shrink-0 text-slate-600"
                aria-hidden="true"
              />
              <span>Timer:</span>
              <span className="font-mono tabular-nums text-slate-950">
                {formatTimer(elapsedSeconds)}
              </span>
            </div>

            {/* Attempts */}
            <div className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800">
              <span>Attempts:</span>
              <span className="font-mono tabular-nums text-slate-950">
                {totalAttempts}
              </span>
            </div>

            {/* Fields Correct (n/3) */}
            <div
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-semibold ${
                fieldsCorrectCount === 3
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                  : "border-slate-200 bg-slate-50 text-slate-800"
              }`}
            >
              <CheckCircle2
                className={`h-3.5 w-3.5 shrink-0 ${
                  fieldsCorrectCount === 3
                    ? "text-emerald-700"
                    : "text-slate-500"
                }`}
                aria-hidden="true"
              />
              <span>Fields correct:</span>
              <span className="font-mono tabular-nums">
                {fieldsCorrectCount}/3
              </span>
            </div>
          </div>

          <nav
            aria-label="Workspace actions"
            className="flex items-center gap-2"
          >
            {badge && (
              <button
                type="button"
                onClick={openBadgeModal}
                className="inline-flex min-h-8 items-center gap-2 rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-800"
              >
                <Award className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Result Modal</span>
              </button>
            )}

            <Link
              href="/briefing"
              className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <span>Briefing</span>
            </Link>

            <Link
              href="/verify"
              className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <ShieldCheck
                className="h-3.5 w-3.5 text-emerald-700"
                aria-hidden="true"
              />
              <span>Verifier</span>
            </Link>

            <button
              type="button"
              onClick={handleNewSession}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>New Session</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Two-Pane Workspace: Left (35%) Tabs Brief | Answer | Hints, Right (65%) DataViewer */}
      <main className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[35%_65%]">
        {/* Left Pane (35%): Tabs Brief | Answer | Hints */}
        <div className="flex min-h-0 min-w-0 flex-col border-b border-slate-200 bg-white lg:border-r lg:border-b-0">
          {/* Left Pane Tablist */}
          <div
            role="tablist"
            aria-label="Candidate workspace panels"
            {...({
              focusgroup: "tablist nomemory",
            } as React.HTMLAttributes<HTMLDivElement>)}
            className="grid shrink-0 grid-cols-3 border-b border-slate-200 bg-slate-50 px-6 pt-2"
          >
            {LEFT_TABS.map((tab, idx) => {
              const isSelected = activeWorkspaceTab === tab.key;
              return (
                <button
                  key={tab.key}
                  ref={(el) => {
                    leftTabRefs.current[tab.key] = el;
                  }}
                  id={`${tabBaseId}-tab-${tab.key}`}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  aria-controls={`${tabBaseId}-panel-${tab.key}`}
                  tabIndex={isSelected ? 0 : -1}
                  {...(isSelected
                    ? ({
                        focusgroupstart: "",
                      } as React.ButtonHTMLAttributes<HTMLButtonElement>)
                    : {})}
                  onClick={() => setActiveWorkspaceTab(tab.key)}
                  onKeyDown={(e) => handleLeftTabKeyDown(e, idx)}
                  className="relative inline-flex items-center justify-center gap-2 px-4 py-3 text-xs font-bold tracking-wide text-slate-600 uppercase transition-colors hover:text-slate-900 aria-selected:text-slate-950 aria-selected:after:absolute aria-selected:after:inset-x-0 aria-selected:after:bottom-0 aria-selected:after:border-b-[3px] aria-selected:after:border-slate-900 aria-selected:after:content-['']"
                >
                  {tab.key === "brief" && (
                    <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {tab.key === "answer" && (
                    <Send className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {tab.key === "hints" && (
                    <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>{tab.label}</span>
                  {tab.key === "hints" && hintsCount > 0 && (
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-amber-900">
                      {hintsCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Left Pane Tab Panels (24px padding = p-6) */}
          <div className="min-h-0 flex-1 overflow-y-auto p-6 [overscroll-behavior:contain] [scrollbar-gutter:stable]">
            <div
              id={`${tabBaseId}-panel-${LEFT_TABS[0].key}`}
              role="tabpanel"
              aria-labelledby={`${tabBaseId}-tab-${LEFT_TABS[0].key}`}
              hidden={activeWorkspaceTab !== "brief"}
            >
              <BriefPanel
                scenario={session.scenario}
                brief={session.brief}
                datasetHash={session.dataset_hash}
                candidateName={candidateName}
              />
            </div>

            <div
              id={`${tabBaseId}-panel-${LEFT_TABS[1].key}`}
              role="tabpanel"
              aria-labelledby={`${tabBaseId}-tab-${LEFT_TABS[1].key}`}
              hidden={activeWorkspaceTab !== "answer"}
            >
              <SubmissionForm />
            </div>

            <div
              id={`${tabBaseId}-panel-${LEFT_TABS[2].key}`}
              role="tabpanel"
              aria-labelledby={`${tabBaseId}-tab-${LEFT_TABS[2].key}`}
              hidden={activeWorkspaceTab !== "hints"}
            >
              <HintsHistoryPanel />
            </div>
          </div>
        </div>

        {/* Right Pane (65%): DataViewer */}
        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-white">
          <DataViewer
            sessionId={session.session_id}
            tables={session.tables}
          />
        </div>
      </main>

      {/* Tutor Slide-Over Drawer (opens automatically on failed attempt) */}
      <TutorDrawer />

      {/* Result Modal (Open Badges 3.0 Credential Modal on passed: true) */}
      <BadgeModal />
    </div>
  );
}
