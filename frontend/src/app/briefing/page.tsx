"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckSquare,
  Clock,
  GraduationCap,
  Inbox,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { isMockMode } from "@/lib/api";
import { useSession } from "@/lib/session-context";

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return tokens.map((token, idx) => {
    if (token.startsWith("**") && token.endsWith("**") && token.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-slate-900">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith("`") && token.endsWith("`") && token.length > 2) {
      return (
        <code
          key={idx}
          className="rounded bg-slate-200/80 px-1.5 py-0.5 font-mono text-xs font-medium text-slate-900"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={idx}>{token}</React.Fragment>;
  });
}

const TASK_TITLES = [
  "Task 1: Total Net Discrepancy (₦)",
  "Task 2: Missing Bank Settlement Transaction ID",
  "Task 3: Duplicated Warehouse Waybill ID",
];

export default function BriefingPage() {
  const router = useRouter();
  const {
    isHydrated,
    session,
    candidateName,
    seed,
    checkedTasks,
    toggleTaskChecked,
    setSessionData,
    startTimer,
    showToast,
  } = useSession();

  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [forceEmptyState, setForceEmptyState] = useState(false);
  const [urlSeedDemo, setUrlSeedDemo] = useState(false);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("seed") === "demo") {
        setUrlSeedDemo(true);
      }
    } catch {
      // Ignore URL parsing errors
    }
  }, []);

  // A briefing only exists for a session the candidate started themselves. Opened
  // directly (new tab, shared link, expired tab), send them to the start screen
  // instead of inventing a session under a placeholder name.
  const goToStart = React.useCallback(() => {
    router.replace(`/${window.location.search}`);
  }, [router]);

  useEffect(() => {
    if (isHydrated && !session) {
      goToStart();
    }
  }, [isHydrated, session, goToStart]);

  const handleRetryLoad = goToStart;

  const handleBeginWorkspace = () => {
    startTimer();
    router.push("/workspace");
  };

  const showSeed = seed === "demo" || urlSeedDemo;

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      {/* Top Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-base font-bold tracking-tight text-slate-900"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 font-mono text-sm font-bold text-white">
                RC
              </span>
              <span>ReconCore</span>
            </Link>
            <span className="text-slate-300" aria-hidden="true">
              /
            </span>
            <span className="text-sm font-semibold text-slate-700">
              Candidate Briefing
            </span>
            {showSeed && (
              <span className="rounded border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-xs font-medium text-slate-700">
                seed=demo
              </span>
            )}
            {isMockMode() && (
              <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 font-mono text-xs font-semibold text-amber-900">
                Mock Fixtures Active
              </span>
            )}
          </div>

          <nav aria-label="Briefing navigation" className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>Back to Landing</span>
            </Link>
            <Link
              href="/verify"
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              <ShieldCheck
                className="h-4 w-4 text-emerald-700"
                aria-hidden="true"
              />
              <span>Verifier</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-8">
        {/* Loading State */}
        {(!isHydrated || isBootstrapping) && (
          <section
            aria-label="Loading scenario briefing"
            role="status"
            className="flex flex-col items-center justify-center gap-4 rounded-xl border border-slate-200 bg-white p-6 text-center shadow-2xs"
          >
            <Loader2
              className="h-8 w-8 animate-spin text-slate-900"
              aria-hidden="true"
            />
            <div>
              <h1 className="text-base font-bold text-slate-900">
                Loading Scenario Briefing…
              </h1>
              <p className="mt-1 text-xs text-slate-500">
                Preparing your reconciliation dataset and task checklist.
              </p>
            </div>
          </section>
        )}

        {/* Error State */}
        {isHydrated && !isBootstrapping && errorMessage && (
          <section
            aria-label="Briefing error"
            role="alert"
            className="flex flex-col gap-4 rounded-xl border border-red-300 bg-red-50 p-6 text-red-950 shadow-2xs"
          >
            <div className="flex items-start gap-3">
              <AlertCircle
                className="mt-0.5 h-5 w-5 shrink-0 text-red-700"
                aria-hidden="true"
              />
              <div>
                <h1 className="text-base font-bold">
                  Unable to Load Scenario Briefing
                </h1>
                <p className="mt-1 text-xs leading-relaxed text-red-900">
                  {errorMessage}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={handleRetryLoad}
                className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                <span>Retry Loading Briefing</span>
              </button>
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <span>Return to Landing</span>
              </Link>
            </div>
          </section>
        )}

        {/* Empty State */}
        {isHydrated && !isBootstrapping && !errorMessage && !session && (
          <section
            aria-label="No active briefing session"
            className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center shadow-2xs"
          >
            <Inbox className="h-8 w-8 text-slate-400" aria-hidden="true" />
            <div>
              <h1 className="text-base font-bold text-slate-900">
                No Active Scenario Briefing
              </h1>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-600">
                Start a candidate session from the landing page or load the
                default Alimosho Q3 briefing below.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <button
                type="button"
                onClick={handleRetryLoad}
                className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                <span>Load Scenario Briefing</span>
              </button>
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <span>Return to Landing</span>
              </Link>
            </div>
          </section>
        )}

        {/* Active Briefing Content */}
        {isHydrated && !isBootstrapping && !errorMessage && session && (
          <div className="flex flex-col gap-6">
            {/* Panel 1: Scenario Title & Who the Manager Is */}
            <section
              aria-labelledby="briefing-scenario-title"
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-slate-900 px-2.5 py-1 font-mono text-xs font-semibold text-white">
                    {session.scenario.id}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 uppercase">
                    Audit Scenario Briefing
                  </span>
                </div>

                {candidateName && (
                  <div className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800">
                    <UserCheck
                      className="h-4 w-4 text-emerald-700"
                      aria-hidden="true"
                    />
                    <span>Candidate: {candidateName}</span>
                  </div>
                )}
              </div>

              <h1
                id="briefing-scenario-title"
                className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
              >
                {session.scenario.title}
              </h1>

              {/* Manager Identity Box */}
              <div className="mt-4 flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                  Reporting Manager
                </div>
                <div className="text-sm font-bold text-slate-900">
                  {session.brief.from}
                </div>
              </div>

              {/* Manager's Memo */}
              <div className="mt-4 flex flex-col gap-4 text-sm leading-relaxed text-slate-700">
                {session.brief.body_markdown
                  .split(/\n\s*\n/)
                  .map((p) => p.trim())
                  .filter(Boolean)
                  .map((paragraph, idx) => (
                    <p key={idx}>{renderInlineMarkdown(paragraph)}</p>
                  ))}
              </div>
            </section>

            {/* Grid: The 3 Tasks Checklist + Assessment Rules */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Panel 2: The 3 Tasks as a Checklist (7 cols) */}
              <section
                aria-labelledby="briefing-tasks-heading"
                className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-2xs lg:col-span-7"
              >
                <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-4">
                  <div className="flex items-center gap-2">
                    <CheckSquare
                      className="h-5 w-5 text-slate-900"
                      aria-hidden="true"
                    />
                    <h2
                      id="briefing-tasks-heading"
                      className="text-base font-bold text-slate-900"
                    >
                      The 3 Reconciliation Tasks (Checklist)
                    </h2>
                  </div>
                  <span className="font-mono text-xs font-semibold text-slate-600">
                    3 findings required
                  </span>
                </div>

                {session.brief.task_definitions.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">
                    No task definitions available for this scenario.
                  </div>
                ) : (
                  <ul className="flex flex-col gap-4" role="list">
                    {session.brief.task_definitions.map((taskRule, idx) => {
                      const isChecked = Boolean(checkedTasks[idx]);
                      const checkboxId = `briefing-task-check-${idx}`;
                      return (
                        <li
                          key={idx}
                          className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-4 transition-colors hover:bg-slate-50"
                        >
                          <input
                            id={checkboxId}
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleTaskChecked(idx)}
                            className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 accent-slate-900"
                          />
                          <label
                            htmlFor={checkboxId}
                            className="flex-1 cursor-pointer text-sm leading-relaxed text-slate-800"
                          >
                            <span className="block font-bold text-slate-900">
                              {TASK_TITLES[idx] ?? `Task ${idx + 1}`}
                            </span>
                            <span className="mt-1 block text-xs leading-relaxed text-slate-700">
                              {renderInlineMarkdown(taskRule)}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {/* Panel 3: Rules & Begin Action (5 cols) */}
              <section
                aria-labelledby="briefing-rules-heading"
                className="flex flex-col justify-between gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-2xs lg:col-span-5"
              >
                <div className="flex flex-col gap-4">
                  <div className="border-b border-slate-200 pb-4">
                    <h2
                      id="briefing-rules-heading"
                      className="text-base font-bold text-slate-900"
                    >
                      Assessment Rules
                    </h2>
                    <p className="mt-1 text-xs text-slate-600">
                      Read before starting the workspace timer.
                    </p>
                  </div>

                  <ul className="flex flex-col gap-4" role="list">
                    <li className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <RotateCcw
                        className="mt-0.5 h-5 w-5 shrink-0 text-slate-800"
                        aria-hidden="true"
                      />
                      <div>
                        <div className="text-sm font-bold text-slate-900">
                          Unlimited attempts
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-slate-600">
                          Submit as many times as needed. Verified fields lock
                          in automatically so you only retry what missed.
                        </p>
                      </div>
                    </li>

                    <li className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <GraduationCap
                        className="mt-0.5 h-5 w-5 shrink-0 text-slate-800"
                        aria-hidden="true"
                      />
                      <div>
                        <div className="text-sm font-bold text-slate-900">
                          Hints available
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-slate-600">
                          Up to {session.max_hint_level} progressive Socratic
                          hint levels open as a slide-over after a failed
                          attempt and are saved in your Hints tab.
                        </p>
                      </div>
                    </li>

                    <li className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50/70 p-4">
                      <Sparkles
                        className="mt-0.5 h-5 w-5 shrink-0 text-emerald-800"
                        aria-hidden="true"
                      />
                      <div>
                        <div className="text-sm font-bold text-emerald-950">
                          AI never grades
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-emerald-900">
                          100% deterministic Python code grades your exact Naira
                          integer and record IDs. AI only provides Socratic
                          coaching.
                        </p>
                      </div>
                    </li>
                  </ul>
                </div>

                {/* Begin Action Box */}
                <div className="flex flex-col gap-4 border-t border-slate-200 pt-4">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                    <Clock
                      className="h-4 w-4 shrink-0 text-slate-700"
                      aria-hidden="true"
                    />
                    <span>
                      Your session timer starts when you click{" "}
                      <strong className="font-semibold text-slate-900">
                        Begin
                      </strong>
                      .
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleBeginWorkspace}
                    className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800"
                  >
                    <span>Begin</span>
                    <ArrowRight
                      className="h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </section>
            </div>
          </div>
        )}
      </main>

      {/* Footer — positioned away from viewport corners so no floating badge overlaps */}
      <footer className="border-t border-slate-200 bg-white py-4">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-start gap-6 px-6 pr-24 text-xs text-slate-500">
          <span>
            ReconCore · AI generates the scenario &amp; Socratic hints;
            deterministic code grades &amp; signs the proof.
          </span>
          <Link
            href="/verify"
            className="inline-flex items-center gap-1 font-semibold text-slate-800 underline decoration-slate-400 underline-offset-4 hover:text-slate-950"
          >
            <span>Verify an existing badge JSON →</span>
          </Link>
        </div>
      </footer>
    </div>
  );
}
