"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Award,
  ArrowLeft,
  Loader2,
  Play,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { initSession, isMockMode } from "@/lib/api";
import { useSession } from "@/lib/session-context";
import BriefPanel from "@/components/BriefPanel";
import SubmissionForm from "@/components/SubmissionForm";
import DataViewer from "@/components/DataViewer";
import TutorDrawer from "@/components/TutorDrawer";
import BadgeModal from "@/components/BadgeModal";

export default function WorkspacePage() {
  const router = useRouter();
  const {
    session,
    candidateName,
    seed,
    badge,
    setSessionData,
    openBadgeModal,
    resetSession,
    showToast,
  } = useSession();

  const [isQuickStarting, setIsQuickStarting] = useState(false);

  const handleQuickDemoInit = async () => {
    if (isQuickStarting) return;
    setIsQuickStarting(true);
    try {
      const res = await initSession({
        seed: "demo",
        candidate_name: "Ada Okafor",
      });
      setSessionData(res, "Ada Okafor", "demo");
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : "Failed to initialize demo session.",
        "init_failed",
        "error"
      );
    } finally {
      setIsQuickStarting(false);
    }
  };

  const handleNewSession = () => {
    resetSession();
    router.push("/");
  };

  if (!session) {
    return (
      <div className="flex min-h-dvh flex-col bg-slate-50">
        <header className="border-b border-slate-200 bg-white px-6 py-3.5">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-bold text-slate-900"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-slate-900 font-mono text-xs font-bold text-white">
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
          <div className="w-full rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
            <h1 className="text-lg font-bold text-slate-900">
              No Active Reconciliation Session
            </h1>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
              Start a session from the launch screen with your candidate name, or
              boot straight into the deterministic <code className="font-mono">seed=demo</code>{" "}
              Alimosho Q3 scenario.
            </p>

            <div className="mt-5 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleQuickDemoInit}
                disabled={isQuickStarting}
                className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {isQuickStarting ? (
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Play className="h-4 w-4" aria-hidden="true" />
                )}
                <span>Quick-Launch Demo Session (Ada Okafor)</span>
              </button>

              <Link
                href="/"
                className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Return to Start Screen</span>
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-dvh min-h-dvh flex-col overflow-hidden bg-slate-100">
      {/* Compact Workspace Top Bar */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-900 hover:opacity-80"
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-slate-900 font-mono text-xs font-bold text-white">
              RC
            </span>
            <span>ReconCore</span>
          </Link>

          <span className="text-slate-300" aria-hidden="true">
            /
          </span>

          <h1 className="truncate text-xs font-semibold text-slate-700 sm:text-sm">
            {session.scenario.title}
          </h1>

          <span className="hidden rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] text-slate-600 md:inline-block">
            Session: {session.session_id}
            {seed ? ` · seed=${seed}` : ""}
          </span>

          {isMockMode() && (
            <span className="hidden rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-900 lg:inline-block">
              MOCK MODE
            </span>
          )}
        </div>

        <nav aria-label="Workspace actions" className="flex items-center gap-2">
          {badge && (
            <button
              type="button"
              onClick={openBadgeModal}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-md bg-emerald-700 px-3 py-1 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-800"
            >
              <Award className="h-3.5 w-3.5" aria-hidden="true" />
              <span>View Badge</span>
            </button>
          )}

          <Link
            href="/verify"
            className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
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
            className="inline-flex min-h-8 items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>New Session</span>
          </button>
        </nav>
      </header>

      {/* Split-Pane Workspace: 28% / 52% / 20% at >= 1280px (xl) */}
      <main className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden pb-10 lg:grid-cols-[35%_65%] xl:grid-cols-[28%_52%_20%] xl:pb-0">
        {/* Left Column (28%): Scrollable BriefPanel above pinned SubmissionForm */}
        <div className="flex min-h-0 min-w-0 flex-col border-b border-slate-200 bg-white lg:border-r lg:border-b-0">
          <div className="min-h-0 flex-1 overflow-y-auto p-4 [overscroll-behavior:contain] [scrollbar-gutter:stable]">
            <BriefPanel
              scenario={session.scenario}
              brief={session.brief}
              datasetHash={session.dataset_hash}
              candidateName={candidateName}
            />
          </div>
          <div className="shrink-0">
            <SubmissionForm />
          </div>
        </div>

        {/* Centre Column (52%): DataViewer */}
        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-white">
          <DataViewer
            sessionId={session.session_id}
            tables={session.tables}
          />
        </div>

        {/* Right Column (20% on xl, Bottom Sheet on < xl): TutorDrawer */}
        <TutorDrawer />
      </main>

      {/* Open Badges 3.0 Modal on passed: true */}
      <BadgeModal />
    </div>
  );
}

