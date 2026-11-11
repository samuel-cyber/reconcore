"use client";

import React, { useId, useState } from "react";
import {
  AlertCircle,
  Award,
  CheckCircle2,
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
    latestFieldStatus,
    badge,
    recordSubmitResponse,
    openBadgeModal,
    showToast,
  } = useSession();

  const [discrepancyNgn, setDiscrepancyNgn] = useState("");
  const [missingTxId, setMissingTxId] = useState("");
  const [duplicateWbId, setDuplicateWbId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const discrepancyId = useId();
  const missingTxInputId = useId();
  const duplicateWbInputId = useId();

  if (!session) return null;

  const discrepancyStatus = latestFieldStatus?.discrepancy_ngn;
  const missingTxStatus = latestFieldStatus?.missing_tx_id;
  const duplicateWbStatus = latestFieldStatus?.duplicate_wb_id;

  const isDiscrepancyLocked = discrepancyStatus === "correct" || Boolean(badge);
  const isMissingTxLocked = missingTxStatus === "correct" || Boolean(badge);
  const isDuplicateWbLocked = duplicateWbStatus === "correct" || Boolean(badge);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (badge) {
      openBadgeModal();
      return;
    }

    const trimmedDiscrepancy = discrepancyNgn.trim();
    const trimmedTx = missingTxId.trim();
    const trimmedWb = duplicateWbId.trim();

    if (!trimmedDiscrepancy || !trimmedTx || !trimmedWb) {
      showToast(
        "Please complete all three reconciliation fields before submitting.",
        "missing_fields",
        "error"
      );
      return;
    }

    setIsSubmitting(true);
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
          showToast(err.message, err.code, "error");
        }
      } else {
        showToast(
          err instanceof Error
            ? err.message
            : "Unable to reach the grading server.",
          "network_error",
          "error"
        );
      }
    } finally {
      setIsSubmitting(false);
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
          className="inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-800"
        >
          <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />
          <Lock className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
          Correct (Locked)
        </span>
      );
    }
    if (status === "invalid_format") {
      return (
        <span
          id={id}
          className="inline-flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-semibold text-red-800"
        >
          <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
          Invalid Naira format
        </span>
      );
    }
    return (
      <span
        id={id}
        className="inline-flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-semibold text-red-800"
      >
        <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
        Incorrect
      </span>
    );
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-labelledby="submission-form-heading"
      className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/90 p-3.5"
      noValidate
    >
      <div className="flex items-center justify-between gap-2">
        <h3
          id="submission-form-heading"
          className="text-xs font-bold tracking-wider text-slate-800 uppercase"
        >
          Audit Findings Submission
        </h3>
        <span className="text-[11px] font-medium text-slate-500">
          Deterministic Exact-Match Grader
        </span>
      </div>

      {/* Field 1: Total net discrepancy (₦) */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor={discrepancyId}
            className="text-xs font-semibold text-slate-800"
          >
            Total net discrepancy (₦)
          </label>
          {renderFieldStatusBadge(
            discrepancyStatus,
            `${discrepancyId}-status`
          )}
        </div>
        <span
          id={`${discrepancyId}-hint`}
          className="text-[11px] text-slate-500"
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
          onChange={(e) => setDiscrepancyNgn(e.target.value)}
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
          className={`w-full rounded-md border px-3 py-2 font-mono text-sm tabular-nums shadow-2xs transition-colors read-only:cursor-not-allowed ${getFieldInputStyles(
            discrepancyStatus
          )}`}
        />
      </div>

      {/* Field 2: Missing bank settlement transaction ID */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor={missingTxInputId}
            className="text-xs font-semibold text-slate-800"
          >
            Missing bank settlement transaction ID
          </label>
          {renderFieldStatusBadge(
            missingTxStatus,
            `${missingTxInputId}-status`
          )}
        </div>
        <span
          id={`${missingTxInputId}-hint`}
          className="text-[11px] text-slate-500"
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
          onChange={(e) => setMissingTxId(e.target.value)}
          placeholder="e.g. POS-1042"
          aria-invalid={missingTxStatus === "incorrect"}
          aria-describedby={
            missingTxStatus
              ? `${missingTxInputId}-hint ${missingTxInputId}-status`
              : `${missingTxInputId}-hint`
          }
          className={`w-full rounded-md border px-3 py-2 font-mono text-sm uppercase shadow-2xs transition-colors placeholder:normal-case read-only:cursor-not-allowed ${getFieldInputStyles(
            missingTxStatus
          )}`}
        />
      </div>

      {/* Field 3: Duplicated warehouse waybill ID */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor={duplicateWbInputId}
            className="text-xs font-semibold text-slate-800"
          >
            Duplicated warehouse waybill ID
          </label>
          {renderFieldStatusBadge(
            duplicateWbStatus,
            `${duplicateWbInputId}-status`
          )}
        </div>
        <span
          id={`${duplicateWbInputId}-hint`}
          className="text-[11px] text-slate-500"
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
          onChange={(e) => setDuplicateWbId(e.target.value)}
          placeholder="e.g. WB-3311"
          aria-invalid={duplicateWbStatus === "incorrect"}
          aria-describedby={
            duplicateWbStatus
              ? `${duplicateWbInputId}-hint ${duplicateWbInputId}-status`
              : `${duplicateWbInputId}-hint`
          }
          className={`w-full rounded-md border px-3 py-2 font-mono text-sm uppercase shadow-2xs transition-colors placeholder:normal-case read-only:cursor-not-allowed ${getFieldInputStyles(
            duplicateWbStatus
          )}`}
        />
      </div>

      {badge ? (
        <button
          type="button"
          onClick={openBadgeModal}
          className="mt-1 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-800"
        >
          <Award className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Reconciliation Passed — View OB 3.0 Credential</span>
        </button>
      ) : (
        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-1 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? (
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
    </form>
  );
}

