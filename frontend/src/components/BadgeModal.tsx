"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import {
  Award,
  Check,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FlaskConical,
  Loader2,
  ShieldCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import { verifyBadge } from "@/lib/api";
import type { BadgeCredential, VerifyResponse } from "@/lib/api-types";
import { useSession } from "@/lib/session-context";
import VerifyResult from "./VerifyResult";

export default function BadgeModal() {
  const {
    badge,
    summary,
    session,
    elapsedSeconds,
    badgeModalOpen,
    closeBadgeModal,
    showToast,
  } = useSession();

  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const verifyResultsRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const rawCodeCaptionId = useId();

  const [showRawJson, setShowRawJson] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isVerifyingValid, setIsVerifyingValid] = useState(false);
  const [isVerifyingTamper, setIsVerifyingTamper] = useState(false);
  const [validVerifyResult, setValidVerifyResult] =
    useState<VerifyResponse | null>(null);
  const [tamperVerifyResult, setTamperVerifyResult] =
    useState<VerifyResponse | null>(null);
  const [tamperedNamePreview, setTamperedNamePreview] = useState<string | null>(
    null
  );

  // Sync open/close state with native <dialog>.showModal()
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (badgeModalOpen && badge) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [badgeModalOpen, badge]);

  // Reset returnValue on close & implement mandatory closedby="any" pointerdown/pointerup fallback
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.returnValue = "";
      closeBadgeModal();
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
  }, [closeBadgeModal]);

  // The verdict is the point of the demo: bring it into view instead of leaving it
  // below the fold of the modal.
  useEffect(() => {
    if (!validVerifyResult && !tamperVerifyResult) return;
    const id = window.requestAnimationFrame(() => {
      verifyResultsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => window.cancelAnimationFrame(id);
  }, [validVerifyResult, tamperVerifyResult]);

  // Reset verification results when a new badge is minted
  useEffect(() => {
    setValidVerifyResult(null);
    setTamperVerifyResult(null);
    setTamperedNamePreview(null);
    setShowRawJson(false);
  }, [badge?.id]);

  if (!badge) return null;

  const rawJsonString = JSON.stringify(badge, null, 2);
  const datasetHash =
    badge.evidence?.[0]?.["reconcore:datasetHash"] ??
    session?.dataset_hash ??
    "";
  const shortHash =
    datasetHash.length > 24
      ? `${datasetHash.slice(0, 18)}…${datasetHash.slice(-6)}`
      : datasetHash;

  const attemptsCount =
    summary?.attempts ?? badge.evidence?.[0]?.["reconcore:attempts"] ?? 1;
  const hintsUsed =
    summary?.hints_used ?? badge.evidence?.[0]?.["reconcore:hintsUsed"] ?? 0;
  const secondsToSolve = summary?.seconds_to_solve || elapsedSeconds || 0;

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(rawJsonString);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("Could not copy credential JSON to clipboard.", "copy_failed");
    }
  };

  const handleDownloadBadge = () => {
    const blob = new Blob([rawJsonString], {
      type: "application/ld+json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "badge.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleSimulateEmployerVerify = async () => {
    if (isVerifyingValid) return;
    setIsVerifyingValid(true);
    try {
      const res = await verifyBadge(badge);
      setValidVerifyResult(res);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Verification request failed.",
        "verify_failed"
      );
    } finally {
      setIsVerifyingValid(false);
    }
  };

  const handleTamperTest = async () => {
    if (isVerifyingTamper) return;
    setIsVerifyingTamper(true);
    try {
      const tamperedCopy: BadgeCredential = structuredClone(badge);
      const editedName = `${tamperedCopy.credentialSubject.name} (edited)`;
      tamperedCopy.credentialSubject.name = editedName;
      setTamperedNamePreview(editedName);

      const [authenticRes, tamperedRes] = await Promise.all([
        validVerifyResult
          ? Promise.resolve(validVerifyResult)
          : verifyBadge(badge),
        verifyBadge(tamperedCopy),
      ]);

      setValidVerifyResult(authenticRes);
      setTamperVerifyResult(tamperedRes);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Tamper verification failed.",
        "tamper_failed"
      );
    } finally {
      setIsVerifyingTamper(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({ closedby: "any" } as React.DialogHTMLAttributes<HTMLDialogElement>)}
      className="m-auto w-full max-w-3xl rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl open:flex open:max-h-[90dvh] open:flex-col"
    >
      {/* Modal Header */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-50 px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-700 text-white">
            <Award className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <span className="text-xs font-bold tracking-wider text-emerald-800 uppercase">
              Verifiable credential issued
            </span>
            <h2 id={titleId} className="text-base font-bold text-slate-900">
              {badge.credentialSubject.achievement.name}
            </h2>
          </div>
        </div>

        <form method="dialog">
          <button
            type="submit"
            value="close"
            autoFocus
            aria-label="Close credential modal"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-900"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>
      </div>

      {/* Modal Scrollable Body (24px padding = p-6) */}
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6">
        {/* Visual Badge Card */}
        <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-6 text-white shadow-md">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-700/80 pb-4">
            <div>
              <div className="text-xs font-medium text-emerald-400">
                Issued to Candidate
              </div>
              <div className="mt-1 text-xl font-bold tracking-tight text-white">
                {badge.credentialSubject.name}
              </div>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-300">
                {badge.credentialSubject.achievement.description}
              </p>
            </div>

            <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/60 px-4 py-2 text-right">
              <div className="text-[11px] font-bold tracking-wider text-emerald-300 uppercase">
                Deterministic Grade
              </div>
              <div className="font-mono text-sm font-bold text-emerald-400">
                {badge.credentialSubject.result?.[0]?.value ?? "3/3 exact"}
              </div>
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
            <div className="rounded-md bg-slate-800/90 p-3">
              <dt className="text-xs text-slate-400">Issued Date</dt>
              <dd className="mt-1 font-mono font-medium text-slate-100">
                {badge.validFrom.slice(0, 10)}
              </dd>
            </div>
            <div className="rounded-md bg-slate-800/90 p-3">
              <dt className="text-xs text-slate-400">Solve Summary</dt>
              <dd className="mt-1 font-mono font-medium tabular-nums text-slate-100">
                {attemptsCount} {attemptsCount === 1 ? "attempt" : "attempts"} ·{" "}
                {hintsUsed} {hintsUsed === 1 ? "hint" : "hints"}
                {secondsToSolve > 0 ? ` · ${secondsToSolve}s` : ""}
              </dd>
            </div>
            <div className="rounded-md bg-slate-800/90 p-3 sm:col-span-2">
              <dt className="text-xs text-slate-400">Dataset SHA-256 Digest</dt>
              <dd
                className="mt-1 truncate font-mono font-medium text-slate-100"
                title={datasetHash}
              >
                {shortHash}
              </dd>
            </div>
          </dl>
        </div>

        {/* Action Bar: Verify, Tamper Test, View Raw JSON, Download */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSimulateEmployerVerify}
              disabled={isVerifyingValid}
              className="inline-flex min-h-10 items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-emerald-800 disabled:opacity-60"
            >
              {isVerifyingValid ? (
                <Loader2
                  className="h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              )}
              <span>Simulate employer verification</span>
            </button>

            <button
              type="button"
              onClick={handleTamperTest}
              disabled={isVerifyingTamper}
              className="inline-flex min-h-10 items-center gap-2 rounded-md border border-red-300 bg-red-50 px-4 py-2 text-xs font-semibold text-red-900 shadow-2xs transition-colors hover:bg-red-100 disabled:opacity-60"
            >
              {isVerifyingTamper ? (
                <Loader2
                  className="h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <FlaskConical className="h-4 w-4" aria-hidden="true" />
              )}
              <span>Tamper test</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowRawJson((prev) => !prev)}
              aria-expanded={showRawJson}
              className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <Code2 className="h-4 w-4" aria-hidden="true" />
              <span>
                {showRawJson ? "Hide raw credential" : "View raw credential"}
              </span>
            </button>

            <button
              type="button"
              onClick={handleDownloadBadge}
              className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>Download badge.json</span>
            </button>
          </div>
        </div>

        {/* Live Verification & Side-by-Side Tamper Test Output */}
        {(validVerifyResult || tamperVerifyResult) && (
          <div
            ref={verifyResultsRef}
            className={`scroll-mt-4 grid gap-4 ${
              validVerifyResult && tamperVerifyResult
                ? "grid-cols-1 md:grid-cols-2"
                : "grid-cols-1"
            }`}
          >
            {validVerifyResult && (
              <VerifyResult
                result={validVerifyResult}
                title="Original Signed Credential"
                subtitle={`Candidate: "${badge.credentialSubject.name}"`}
              />
            )}
            {tamperVerifyResult && (
              <VerifyResult
                result={tamperVerifyResult}
                title="Tamper Test (Edited Payload)"
                subtitle={`Edited credentialSubject.name → "${
                  tamperedNamePreview ??
                  `${badge.credentialSubject.name} (edited)`
                }"`}
              />
            )}
          </div>
        )}

        {/* Raw JSON-LD Credential Inspector */}
        {showRawJson && (
          <figure className="rounded-lg border border-slate-300 bg-slate-950 text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
              <figcaption
                id={rawCodeCaptionId}
                className="font-mono text-xs font-medium text-slate-300"
              >
                badge.json · W3C Verifiable Credential / OB 3.0 (eddsa-jcs-2022)
              </figcaption>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="inline-flex items-center gap-1 rounded bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700"
                >
                  {copied ? (
                    <>
                      <Check
                        className="h-3.5 w-3.5 text-emerald-400"
                        aria-hidden="true"
                      />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Copy JSON</span>
                    </>
                  )}
                </button>
              </div>
            </div>
            <pre
              role="region"
              aria-labelledby={rawCodeCaptionId}
              tabIndex={0}
              className="max-h-64 overflow-auto p-4 font-mono text-xs leading-relaxed text-slate-200"
            >
              <code>{rawJsonString}</code>
            </pre>
          </figure>
        )}
      </div>

      {/* Modal Footer */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 bg-slate-50 px-6 py-4 text-xs text-slate-600">
        <span className="font-mono">Issuer: {badge.issuer.id.slice(0, 32)}…</span>
        <div className="flex items-center gap-4">
          <Link
            href="/verify"
            onClick={closeBadgeModal}
            className="inline-flex items-center gap-1 font-semibold text-slate-800 underline decoration-slate-400 underline-offset-2 hover:text-slate-950"
          >
            <span>Open standalone Employer Verifier (/verify)</span>
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
          <form method="dialog">
            <button
              type="submit"
              value="done"
              className="rounded-md bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800"
            >
              Done
            </button>
          </form>
        </div>
      </div>
    </dialog>
  );
}
