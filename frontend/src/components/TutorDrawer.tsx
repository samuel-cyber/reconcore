"use client";

import React from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDashed,
  GraduationCap,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import type { FieldStatus } from "@/lib/api-types";
import { useSession } from "@/lib/session-context";

const FIELD_LABELS: Array<{
  key: "discrepancy_ngn" | "missing_tx_id" | "duplicate_wb_id";
  label: string;
}> = [
  { key: "discrepancy_ngn", label: "Discrepancy (₦)" },
  { key: "missing_tx_id", label: "Missing TX ID" },
  { key: "duplicate_wb_id", label: "Duplicate Waybill" },
];

function FieldStatusChip({
  label,
  status,
}: {
  label: string;
  status?: FieldStatus;
}) {
  if (status === "correct") {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-emerald-200 bg-emerald-50/90 px-2.5 py-1.5 text-xs">
        <span className="font-medium text-emerald-950">{label}</span>
        <span className="inline-flex items-center gap-1 font-semibold text-emerald-800">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Correct
        </span>
      </div>
    );
  }

  if (status === "incorrect" || status === "invalid_format") {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-red-200 bg-red-50/90 px-2.5 py-1.5 text-xs">
        <span className="font-medium text-red-950">{label}</span>
        <span className="inline-flex items-center gap-1 font-semibold text-red-800">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {status === "invalid_format" ? "Invalid format" : "Incorrect"}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs">
      <span className="font-medium text-slate-700">{label}</span>
      <span className="inline-flex items-center gap-1 text-slate-400">
        <CircleDashed className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Pending
      </span>
    </div>
  );
}

export default function TutorDrawer() {
  const {
    session,
    attempts,
    latestFieldStatus,
    tutorSheetOpen,
    setTutorSheetOpen,
  } = useSession();

  if (!session) return null;

  // Hints newest first (attempts array is already ordered newest-first)
  const failedAttemptsWithHints = attempts.filter(
    (attempt) => !attempt.passed && attempt.tutor_hint !== null
  );

  const totalAttempts = attempts.length > 0 ? attempts[0].attempt_no : 0;
  const maxHintLevel = session.max_hint_level ?? 3;

  const drawerBody = (
    <div className="flex h-full min-h-0 flex-col">
      {/* Attempt & Hint Counter Bar */}
      <div className="grid grid-cols-2 gap-2 border-b border-slate-200 bg-white p-3">
        <div className="rounded-md border border-slate-200/90 bg-slate-50 px-2.5 py-2">
          <div className="text-[11px] font-medium text-slate-500 uppercase">
            Attempts
          </div>
          <div className="mt-0.5 font-mono text-base font-bold tabular-nums text-slate-900">
            {totalAttempts}
          </div>
        </div>
        <div className="rounded-md border border-slate-200/90 bg-slate-50 px-2.5 py-2">
          <div className="text-[11px] font-medium text-slate-500 uppercase">
            Hint Level
          </div>
          <div className="mt-0.5 font-mono text-base font-bold tabular-nums text-slate-900">
            {failedAttemptsWithHints.length > 0
              ? `${failedAttemptsWithHints[0].tutor_hint?.level ?? 1} / ${maxHintLevel}`
              : `0 / ${maxHintLevel}`}
          </div>
        </div>
      </div>

      {/* Field Status Chips */}
      <div className="border-b border-slate-200 bg-slate-50/70 p-3">
        <h3 className="mb-2 text-[11px] font-bold tracking-wider text-slate-600 uppercase">
          Field Verification Status
        </h3>
        <div className="flex flex-col gap-1.5">
          {FIELD_LABELS.map((field) => (
            <FieldStatusChip
              key={field.key}
              label={field.label}
              status={latestFieldStatus?.[field.key]}
            />
          ))}
        </div>
      </div>

      {/* Hints Feed (Newest First) */}
      <div
        className="min-h-0 flex-1 overflow-y-auto p-3"
        aria-live="polite"
        aria-relevant="additions"
      >
        <div className="mb-2.5 flex items-center justify-between">
          <h3 className="text-[11px] font-bold tracking-wider text-slate-600 uppercase">
            Socratic Coaching Feed
          </h3>
          <span className="text-[11px] text-slate-400">Newest first</span>
        </div>

        {/* Rule: Never show a hint before the first failed attempt */}
        {failedAttemptsWithHints.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-center">
            <GraduationCap
              className="mx-auto h-7 w-7 text-slate-400"
              aria-hidden="true"
            />
            <p className="mt-2 text-xs font-semibold text-slate-700">
              No hints issued yet
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Inspect the three source tables and submit your reconciliation. If
              any field is off, the Socratic Tutor will guide you here without
              spoiling the answer.
            </p>
          </div>
        ) : (
          <ol className="space-y-2.5">
            {failedAttemptsWithHints.map((item) => {
              const hint = item.tutor_hint!;
              const isTemplate = hint.source === "template";
              return (
                <li
                  key={`attempt-${item.attempt_no}`}
                  className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-white">
                        <Sparkles className="h-3 w-3" aria-hidden="true" />
                        Hint Level {hint.level}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">
                        Attempt #{item.attempt_no}
                      </span>
                    </div>

                    {isTemplate && (
                      <span className="inline-flex items-center rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                        offline hint
                      </span>
                    )}
                  </div>

                  <p className="mt-2 text-sm leading-relaxed text-slate-800">
                    {hint.text}
                  </p>
                </li>
              );
            })}
          </ol>
        )}

        {/* Guardrail note */}
        <div className="mt-4 flex items-start gap-2 rounded-md border border-slate-200/80 bg-slate-100/80 p-2.5 text-[11px] leading-relaxed text-slate-600">
          <ShieldAlert
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500"
            aria-hidden="true"
          />
          <span>
            Leak-guarded Socratic AI: the tutor never reveals the ground-truth
            Naira amount or transaction IDs, and never grades your attempt.
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop (>= 1280px) Static Right Column */}
      <aside
        aria-label="Socratic AI Tutor"
        className="hidden h-full min-h-0 flex-col border-l border-slate-200 bg-slate-50/60 xl:flex"
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100/80 px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <GraduationCap
              className="h-4 w-4 text-slate-800"
              aria-hidden="true"
            />
            <h2 className="text-xs font-bold tracking-wider text-slate-900 uppercase">
              Socratic Tutor
            </h2>
          </div>
          {failedAttemptsWithHints.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-amber-900">
              {failedAttemptsWithHints.length}{" "}
              {failedAttemptsWithHints.length === 1 ? "hint" : "hints"}
            </span>
          )}
        </div>
        {drawerBody}
      </aside>

      {/* Narrower screens (< 1280px) Bottom Sheet */}
      <aside
        aria-label="Socratic AI Tutor Bottom Sheet"
        className="fixed inset-x-0 bottom-0 z-30 flex flex-col border-t border-slate-300 bg-slate-50 shadow-xl xl:hidden"
      >
        <button
          type="button"
          onClick={() => setTutorSheetOpen(!tutorSheetOpen)}
          aria-expanded={tutorSheetOpen}
          className="flex w-full items-center justify-between bg-slate-900 px-4 py-2.5 text-left text-xs font-semibold text-white"
        >
          <span className="inline-flex items-center gap-2">
            <GraduationCap className="h-4 w-4" aria-hidden="true" />
            <span>
              Socratic Tutor (Attempts: {totalAttempts} · Hints:{" "}
              {failedAttemptsWithHints.length})
            </span>
          </span>
          <span className="inline-flex items-center gap-1 text-slate-300">
            <span>{tutorSheetOpen ? "Hide" : "Expand"}</span>
            {tutorSheetOpen ? (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
            )}
          </span>
        </button>

        {tutorSheetOpen && (
          <div className="max-h-[55dvh] overflow-y-auto">{drawerBody}</div>
        )}
      </aside>
    </>
  );
}

