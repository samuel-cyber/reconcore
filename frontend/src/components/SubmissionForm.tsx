"use client";

import React, { useId, useState } from "react";
import {
  AlertCircle,
  Award,
  CheckCircle2,
  GraduationCap,
  Info,
  Loader2,
  Lock,
  Send,
} from "lucide-react";
import { ApiError, submitAttempt } from "@/lib/api";
import type { FieldStatus } from "@/lib/api-types";
import { useSession } from "@/lib/session-context";

export default function SubmissionForm() {
  const {
    session,
    attempts,
    latestFieldStatus,
    badge,
    isSubmittingAttempt,
    submissionError,
    setIsSubmittingAttempt,
    setSubmissionError,
    recordSubmitResponse,
    openBadgeModal,
    setTutorSheetOpen,
    showToast,
  } = useSession();

  const [discrepancyNgn, setDiscrepancyNgn] = useState(
    () => attempts[0]?.submitted.discrepancy_ngn ?? ""
  );
  const [missingTxId, setMissingTxId] = useState(
    () => attempts[0]?.submitted.missing_tx_id ?? ""
  );
  const [duplicateWbId, setDuplicateWbId] = useState(
    () => attempts[0]?.submitted.duplicate_wb_id ?? ""
  );

  const discrepancyId = useId();
  const missingTxInputId = useId();
  const duplicateWbInputId = useId();

  // Empty state if no session is loaded
  if (!session) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs text-slate-500">
        No active session loaded for submission.
      </div>
    );
  }

  const discrepancyStatus = latestFieldStatus?.discrepancy_ngn;
  const missingTxStatus = latestFieldStatus?.missing_tx_id;
  const duplicateWbStatus = latestFieldStatus?.duplicate_wb_id;

  const isDiscrepancyLocked =
    discrepancyStatus === "correct" || Boolean(badge);
  const isMissingTxLocked = missingTxStatus === "correct" || Boolean(badge);
  const isDuplicateWbLocked = duplicateWbStatus === "correct" || Boolean(badge);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmittingAttempt) return;

    if (badge) {
      openBadgeModal();
      return;
    }

    setSubmissionError(null);

    const trimmedDiscrepancy = discrepancyNgn.trim();
    const trimmedTx = missingTxId.trim();
    const trimmedWb = duplicateWbId.trim();

    if (!trimmedDiscrepancy || !trimmedTx || !trimmedWb) {
      const msg =
        "Please complete all three reconciliation fields before submitting.";
      setSubmissionError(msg);
      showToast(msg, "missing_fields", "error");
      return;
    }

    setIsSubmittingAttempt(true);
    try {
      const response = await submitAttempt({
        session_id: session.session_id,
        discrepancy_ngn: discrepancyNgn,
        missing_tx_id: trimmedTx,
        duplicate_wb_id: trimmedWb,
      });

      recordSubmitResponse(
        {
          discrepancy_ngn: discrepancyNgn,
          missing_tx_id: trimmedTx,
          duplicate_wb_id: trimmedWb,
        },
        response
      );
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409 || err.code === "already_solved") {
          showToast(
            "Session already solved — reopening your verified badge.",
            err.code,
            "info"
          );
          openBadgeModal();
        } else {
          setSubmissionError(err.message);
          showToast(err.message, err.code, "error");
        }
      } else {
        const msg =
          err instanceof Error
            ? err.message
            : "Unable to reach the grading server.";
        setSubmissionError(msg);
        showToast(msg, "network_error", "error");
      }
    } finally {
      setIsSubmittingAttempt(false);
    }
  };

  const getFieldInputStyles = (status?: FieldStatus) => {
    if (status === "correct") {
      return "border-emerald-600 bg-emerald-50/70 text-emerald-950 focus-visible:outline-emerald-700";
    }
    if (status === "incorrect" || status === "invalid_format") {
      return "border-red-600 bg-red-50/60 text-slate-900 focus-visible:outline-red-700";
    }
    return "border-slate-300 bg-white text-slate-900 focus-visible:outline-slate-800";
  };

  const renderFieldStatusBadge = (status?: FieldStatus, id?: string) => {
    if (!status) return null;
    if (status === "correct") {
      return (
        <span
          id={id}
          className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800"
        >
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
          Correct (Locked)
        </span>
      );
    }
    if (status === "invalid_format") {
      return (
        <span
          id={id}
          className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Invalid Naira format
        </span>
      );
    }
    return (
      <span
        id={id}
        className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800"
      >
        <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Incorrect
      </span>
    );
  };

  const hasFailedAttempts = attempts.some((a) => !a.passed && a.tutor_hint);

  return (
    <form
      onSubmit={handleSubmit}
      aria-labelledby="submission-form-heading"
      className="flex flex-col gap-4"
      noValidate
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-4">
        <div>
          <h2
            id="submission-form-heading"
            className="text-sm font-bold text-slate-900"
          >
            Audit Findings Submission
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Deterministic exact-match grader · Correct fields lock automatically
          </p>
        </div>
      </div>

      {/* Empty / Initial State before first attempt */}
      {attempts.length === 0 && !submissionError && !isSubmittingAttempt && (
        <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
          <Info
            className="mt-0.5 h-4 w-4 shrink-0 text-slate-500"
            aria-hidden="true"
          />
          <span>
            No attempts submitted yet. Enter all 3 findings below to check your
            reconciliation.
          </span>
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
            <p className="font-semibold">Submission Error</p>
            <p className="mt-1">{submissionError}</p>
          </div>
        </div>
      )}

      {/* Loading State Banner */}
      {isSubmittingAttempt && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs font-medium text-slate-700"
        >
          <Loader2
            className="h-4 w-4 shrink-0 animate-spin text-slate-900"
            aria-hidden="true"
          />
          <span>Grading reconciliation findings and checking hint ladder…</span>
        </div>
      )}

      {/* Fields Container with 16px (gap-4) between fields */}
      <div className="flex flex-col gap-4">
        {/* Field 1: Total net discrepancy (₦) */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor={discrepancyId}
              className="text-xs font-semibold text-slate-800"
            >
              1. Total net discrepancy (₦)
            </label>
            {renderFieldStatusBadge(
              discrepancyStatus,
              `${discrepancyId}-status`
            )}
          </div>
          <span
            id={`${discrepancyId}-hint`}
            className="text-xs text-slate-500"
          >
            Whole Naira integer (e.g. 45,000 or ₦45,000)
          </span>
          <input
            id={discrepancyId}
            name="discrepancy_ngn"
            type="text"
            inputMode="text"
            autoComplete="off"
            required
            readOnly={isDiscrepancyLocked}
            value={discrepancyNgn}
            onChange={(e) => {
              setDiscrepancyNgn(e.target.value);
              if (submissionError) setSubmissionError(null);
            }}
            placeholder="e.g. 45,000"
            aria-invalid={
              discrepancyStatus === "incorrect" ||
              discrepancyStatus === "invalid_format"
            }
            aria-describedby={
              discrepancyStatus
                ? `${discrepancyId}-hint ${discrepancyId}-status`
                : `${discrepancyId}-hint`
            }
            className={`w-full rounded-md border px-4 py-2.5 font-mono text-sm tabular-nums shadow-2xs transition-colors read-only:cursor-not-allowed ${getFieldInputStyles(
              discrepancyStatus
            )}`}
          />
        </div>

        {/* Field 2: Missing bank settlement transaction ID */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor={missingTxInputId}
              className="text-xs font-semibold text-slate-800"
            >
              2. Missing bank settlement transaction ID
            </label>
            {renderFieldStatusBadge(
              missingTxStatus,
              `${missingTxInputId}-status`
            )}
          </div>
          <span
            id={`${missingTxInputId}-hint`}
            className="text-xs text-slate-500"
          >
            Unsettled transfer tx_id from pos_sales_log.csv
          </span>
          <input
            id={missingTxInputId}
            name="missing_tx_id"
            type="text"
            autoComplete="off"
            required
            readOnly={isMissingTxLocked}
            value={missingTxId}
            onChange={(e) => {
              setMissingTxId(e.target.value);
              if (submissionError) setSubmissionError(null);
            }}
            placeholder="e.g. POS-1042"
            aria-invalid={missingTxStatus === "incorrect"}
            aria-describedby={
              missingTxStatus
                ? `${missingTxInputId}-hint ${missingTxInputId}-status`
                : `${missingTxInputId}-hint`
            }
            className={`w-full rounded-md border px-4 py-2.5 font-mono text-sm uppercase shadow-2xs transition-colors placeholder:normal-case read-only:cursor-not-allowed ${getFieldInputStyles(
              missingTxStatus
            )}`}
          />
        </div>

        {/* Field 3: Duplicated warehouse waybill ID */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor={duplicateWbInputId}
              className="text-xs font-semibold text-slate-800"
            >
              3. Duplicated warehouse waybill ID
            </label>
            {renderFieldStatusBadge(
              duplicateWbStatus,
              `${duplicateWbInputId}-status`
            )}
          </div>
          <span
            id={`${duplicateWbInputId}-hint`}
            className="text-xs text-slate-500"
          >
            Duplicate (second copy) wb_id from warehouse_waybills.csv
          </span>
          <input
            id={duplicateWbInputId}
            name="duplicate_wb_id"
            type="text"
            autoComplete="off"
            required
            readOnly={isDuplicateWbLocked}
            value={duplicateWbId}
            onChange={(e) => {
              setDuplicateWbId(e.target.value);
              if (submissionError) setSubmissionError(null);
            }}
            placeholder="e.g. WB-3311"
            aria-invalid={duplicateWbStatus === "incorrect"}
            aria-describedby={
              duplicateWbStatus
                ? `${duplicateWbInputId}-hint ${duplicateWbInputId}-status`
                : `${duplicateWbInputId}-hint`
            }
            className={`w-full rounded-md border px-4 py-2.5 font-mono text-sm uppercase shadow-2xs transition-colors placeholder:normal-case read-only:cursor-not-allowed ${getFieldInputStyles(
              duplicateWbStatus
            )}`}
          />
        </div>
      </div>

      {badge ? (
        <button
          type="button"
          onClick={openBadgeModal}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-3 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-800"
        >
          <Award className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Reconciliation Passed — View Result Modal</span>
        </button>
      ) : (
        <button
          type="submit"
          disabled={isSubmittingAttempt}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmittingAttempt ? (
            <>
              <Loader2
                className="h-4 w-4 shrink-0 animate-spin"
                aria-hidden="true"
              />
              <span>Grading Reconciliation…</span>
            </>
          ) : (
            <>
              <Send className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Submit Reconciliation</span>
            </>
          )}
        </button>
      )}

      {hasFailedAttempts && !badge && (
        <button
          type="button"
          onClick={() => setTutorSheetOpen(true)}
          className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <GraduationCap className="h-4 w-4" aria-hidden="true" />
          <span>Open Socratic Tutor Slide-Over</span>
        </button>
      )}
    </form>
  );
}
