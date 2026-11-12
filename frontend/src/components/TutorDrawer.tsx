"use client";

import React, { useEffect, useId, useRef } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  GraduationCap,
  Loader2,
  ShieldAlert,
  Sparkles,
  X,
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
      <div className="flex items-center justify-between gap-2 rounded-md border border-emerald-200 bg-emerald-50/90 px-4 py-2 text-xs">
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
      <div className="flex items-center justify-between gap-2 rounded-md border border-red-200 bg-red-50/90 px-4 py-2 text-xs">
        <span className="font-medium text-red-950">{label}</span>
        <span className="inline-flex items-center gap-1 font-semibold text-red-800">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {status === "invalid_format" ? "Invalid format" : "Incorrect"}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-4 py-2 text-xs">
      <span className="font-medium text-slate-700">{label}</span>
      <span className="inline-flex items-center gap-1 text-slate-400">
        <CircleDashed className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Pending
      </span>
    </div>
  );
}

/**
 * Hints Tab Panel: Keeps full history of hints inside the Left Pane's "Hints" tab.
 * Includes Loading, Empty, and Error states.
 */
export function HintsHistoryPanel() {
  const {
    session,
    attempts,
    isSubmittingAttempt,
    submissionError,
    setActiveWorkspaceTab,
    setTutorSheetOpen,
  } = useSession();

  const failedAttemptsWithHints = attempts.filter(
    (attempt) => !attempt.passed && attempt.tutor_hint !== null
  );

  const maxHintLevel = session?.max_hint_level ?? 3;

  return (
    <section
      aria-labelledby="hints-history-heading"
      className="flex flex-col gap-4"
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-4">
        <div>
          <h2
            id="hints-history-heading"
            className="text-sm font-bold text-slate-900"
          >
            Socratic Hints History
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Progressive coaching feed · Up to {maxHintLevel} hint levels
          </p>
        </div>
        <span className="rounded-md bg-slate-100 px-2.5 py-1 font-mono text-xs font-semibold text-slate-700">
          {failedAttemptsWithHints.length}{" "}
          {failedAttemptsWithHints.length === 1 ? "hint" : "hints"}
        </span>
      </div>

      {/* Loading State */}
      {isSubmittingAttempt && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs font-medium text-slate-700"
        >
          <Loader2
            className="h-4 w-4 shrink-0 animate-spin text-slate-900"
            aria-hidden="true"
          />
          <span>Generating Socratic coaching hint…</span>
        </div>
      )}

      {/* Error State */}
      {submissionError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-4 text-xs text-red-900"
        >
          <AlertCircle
            className="mt-0.5 h-4 w-4 shrink-0 text-red-700"
            aria-hidden="true"
          />
          <div>
            <p className="font-semibold">Hint Request Error</p>
            <p className="mt-1">{submissionError}</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isSubmittingAttempt && failedAttemptsWithHints.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
          <GraduationCap
            className="h-8 w-8 text-slate-400"
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-bold text-slate-800">
              No hints recorded yet
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Submit your findings in the Answer tab. After a failed attempt,
              the Socratic Tutor opens as a slide-over and saves every hint here
              for reference.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveWorkspaceTab("answer")}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          >
            <span>Go to Answer Form</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <ol className="flex flex-col gap-4" aria-live="polite">
          {failedAttemptsWithHints.map((item, idx) => {
            const hint = item.tutor_hint!;
            const isTemplate = hint.source === "template";
            return (
              <li
                key={`hint-history-${item.attempt_no}-${idx}`}
                className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 shadow-2xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded bg-slate-900 px-2 py-0.5 font-mono text-xs font-semibold text-white">
                      <Sparkles className="h-3 w-3" aria-hidden="true" />
                      Hint Level {hint.level}
                    </span>
                    <span className="font-mono text-xs text-slate-500">
                      Attempt #{item.attempt_no}
                    </span>
                  </div>
                  {isTemplate && (
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      offline hint
                    </span>
                  )}
                </div>

                <p className="text-sm leading-relaxed text-slate-800">
                  {hint.text}
                </p>

                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  {FIELD_LABELS.map((f) => {
                    const st = item.field_status[f.key];
                    return (
                      <span
                        key={f.key}
                        className={`rounded px-2 py-0.5 font-mono text-[11px] font-medium ${
                          st === "correct"
                            ? "bg-emerald-50 text-emerald-800"
                            : "bg-red-50 text-red-800"
                        }`}
                      >
                        {f.label}: {st === "correct" ? "✓" : "✗"}
                      </span>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {failedAttemptsWithHints.length > 0 && (
        <button
          type="button"
          onClick={() => setTutorSheetOpen(true)}
          className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
        >
          <GraduationCap className="h-4 w-4" aria-hidden="true" />
          <span>Reopen Tutor Slide-Over</span>
        </button>
      )}

      {/* Guardrail note */}
      <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
        <ShieldAlert
          className="mt-0.5 h-4 w-4 shrink-0 text-slate-500"
          aria-hidden="true"
        />
        <span>
          AI never grades: the Socratic Tutor never reveals ground-truth values
          and never grades your submission.
        </span>
      </div>
    </section>
  );
}

/**
 * Tutor Slide-Over: Opens as a modal slide-over drawer from the right after a failed attempt.
 */
export default function TutorDrawer() {
  const {
    session,
    attempts,
    latestFieldStatus,
    tutorSheetOpen,
    setTutorSheetOpen,
    setActiveWorkspaceTab,
  } = useSession();

  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();

  // Sync open/close state with native <dialog>.showModal()
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (tutorSheetOpen && session) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [tutorSheetOpen, session]);

  // Reset returnValue on close & implement closedby="any" pointerdown/pointerup fallback
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.returnValue = "";
      setTutorSheetOpen(false);
    };

    dialog.addEventListener("close", handleClose);

    let handlePointerDown: ((e: PointerEvent) => void) | null = null;
    let handlePointerUp: ((e: PointerEvent) => void) | null = null;

    if (
      typeof HTMLDialogElement !== "undefined" &&
      !("closedBy" in HTMLDialogElement.prototype)
    ) {
      const outside = (e: PointerEvent) => {
        const r = dialog.getBoundingClientRect();
        return (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        );
      };
      let pressedOutside = false;
      handlePointerDown = (e: PointerEvent) => {
        pressedOutside = outside(e);
      };
      handlePointerUp = (e: PointerEvent) => {
        if (pressedOutside && outside(e)) {
          dialog.close();
        }
      };
      dialog.addEventListener("pointerdown", handlePointerDown);
      dialog.addEventListener("pointerup", handlePointerUp);
    }

    return () => {
      dialog.removeEventListener("close", handleClose);
      if (handlePointerDown) {
        dialog.removeEventListener("pointerdown", handlePointerDown);
      }
      if (handlePointerUp) {
        dialog.removeEventListener("pointerup", handlePointerUp);
      }
    };
  }, [setTutorSheetOpen]);

  if (!session) return null;

  const failedAttemptsWithHints = attempts.filter(
    (attempt) => !attempt.passed && attempt.tutor_hint !== null
  );
  const latestHintAttempt = failedAttemptsWithHints[0] ?? null;
  const totalAttempts = attempts.length > 0 ? attempts[0].attempt_no : 0;
  const maxHintLevel = session.max_hint_level ?? 3;

  const handleReviseAnswer = () => {
    setTutorSheetOpen(false);
    setActiveWorkspaceTab("answer");
  };

  const handleViewHintHistory = () => {
    setTutorSheetOpen(false);
    setActiveWorkspaceTab("hints");
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({ closedby: "any" } as React.DialogHTMLAttributes<HTMLDialogElement>)}
      className="tutor-slideover shadow-2xl open:flex open:flex-col"
    >
      {/* Slide-Over Header */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-900 px-6 py-4 text-white">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-amber-400" aria-hidden="true" />
          <div>
            <span className="block text-[11px] font-bold tracking-wider text-slate-300 uppercase">
              Attempt #{totalAttempts} Feedback
            </span>
            <h2 id={titleId} className="text-base font-bold text-white">
              Socratic Tutor Coaching
            </h2>
          </div>
        </div>

        <form method="dialog">
          <button
            type="submit"
            value="close"
            autoFocus
            aria-label="Close Socratic Tutor slide-over"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>
      </div>

      {/* Slide-Over Scrollable Body (24px padding, 16px gaps) */}
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6">
        {/* Attempt & Hint Counter Bar */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-medium text-slate-500 uppercase">
              Attempts
            </div>
            <div className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-900">
              {totalAttempts}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-medium text-slate-500 uppercase">
              Hint Level
            </div>
            <div className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-900">
              {latestHintAttempt
                ? `${latestHintAttempt.tutor_hint?.level ?? 1} / ${maxHintLevel}`
                : `0 / ${maxHintLevel}`}
            </div>
          </div>
        </div>

        {/* Field Verification Status */}
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-bold tracking-wider text-slate-600 uppercase">
            Field Verification Breakdown
          </h3>
          <div className="flex flex-col gap-2">
            {FIELD_LABELS.map((field) => (
              <FieldStatusChip
                key={field.key}
                label={field.label}
                status={latestFieldStatus?.[field.key]}
              />
            ))}
          </div>
        </div>

        {/* Latest Hint Card */}
        {latestHintAttempt && latestHintAttempt.tutor_hint ? (
          <div className="flex flex-col gap-4 rounded-xl border border-amber-300 bg-amber-50/70 p-6 shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded bg-slate-900 px-2.5 py-1 font-mono text-xs font-semibold text-white">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Hint Level {latestHintAttempt.tutor_hint.level}
              </span>
              <span className="font-mono text-xs text-slate-600">
                Attempt #{latestHintAttempt.attempt_no}
              </span>
            </div>

            <p className="text-sm leading-relaxed font-medium text-slate-900">
              {latestHintAttempt.tutor_hint.text}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs text-slate-500">
            No coaching hint available yet.
          </div>
        )}

        {/* Guardrail Note */}
        <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
          <ShieldAlert
            className="mt-0.5 h-4 w-4 shrink-0 text-slate-500"
            aria-hidden="true"
          />
          <span>
            AI never grades: deterministic Python code checks your exact figures
            and locks verified fields. This hint is also saved in your{" "}
            <strong className="font-semibold text-slate-800">Hints</strong> tab.
          </span>
        </div>
      </div>

      {/* Slide-Over Footer Actions */}
      <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50 p-6">
        <button
          type="button"
          onClick={handleReviseAnswer}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <span>Revise Answer</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={handleViewHintHistory}
          className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
        >
          <span>View All Hints in Hints Tab ({failedAttemptsWithHints.length})</span>
        </button>
      </div>
    </dialog>
  );
}
