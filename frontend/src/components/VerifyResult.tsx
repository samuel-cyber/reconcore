"use client";

import React from "react";
import {
  CheckCircle2,
  Clock,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import type { VerifyReason, VerifyResponse } from "@/lib/api-types";

interface VerifyResultProps {
  result: VerifyResponse;
  title?: string;
  subtitle?: string;
}

const REASON_DESCRIPTIONS: Record<Exclude<VerifyReason, null>, string> = {
  signature_invalid:
    "Ed25519 signature verification failed (signature_invalid) — payload was modified after signing.",
  hash_unknown:
    "Dataset hash mismatch (hash_unknown) — canonical CSV dataset hash is not recognised by the issuer.",
  issuer_unknown:
    "Untrusted issuer (issuer_unknown) — DID public key does not match ReconCore's verification method.",
  malformed:
    "Malformed credential (malformed) — JSON does not conform to Open Badges 3.0 structure.",
};

function CheckRow({
  label,
  detail,
  passed,
}: {
  label: string;
  detail: string;
  passed: boolean;
}) {
  return (
    <li
      className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-xs ${
        passed
          ? "border-emerald-200/90 bg-white/90 text-slate-800"
          : "border-red-300 bg-white/95 text-red-950"
      }`}
    >
      <div className="min-w-0">
        <div className="font-semibold">{label}</div>
        <div className="truncate text-[11px] text-slate-500">{detail}</div>
      </div>

      {passed ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-800">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          PASS
        </span>
      ) : (
        <span className="inline-flex shrink-0 items-center gap-1 rounded bg-red-100 px-2 py-0.5 font-mono text-[11px] font-bold text-red-800">
          <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
          FAIL
        </span>
      )}
    </li>
  );
}

export default function VerifyResult({
  result,
  title,
  subtitle,
}: VerifyResultProps) {
  const isValid = result.valid;
  const reasonKey = result.reason ?? "malformed";
  const failureMessage = isValid
    ? null
    : REASON_DESCRIPTIONS[reasonKey] ?? `Verification failed (${reasonKey}).`;

  return (
    <section
      aria-label={title ?? "Credential Verification Result"}
      className={`rounded-lg border p-4 shadow-2xs ${
        isValid
          ? "border-emerald-600/80 bg-emerald-50/90 text-emerald-950"
          : "border-red-600/80 bg-red-50/90 text-red-950"
      }`}
    >
      {/* Header Banner */}
      <div className="flex items-start gap-2.5">
        {isValid ? (
          <ShieldCheck
            className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700"
            aria-hidden="true"
          />
        ) : (
          <ShieldAlert
            className="mt-0.5 h-5 w-5 shrink-0 text-red-700"
            aria-hidden="true"
          />
        )}

        <div className="min-w-0 flex-1">
          {title && (
            <div className="text-[11px] font-bold tracking-wider uppercase opacity-75">
              {title}
            </div>
          )}
          <h4 className="text-sm font-bold leading-snug">
            {isValid
              ? "Cryptographically verified — tamper proof"
              : `Verification failed: ${result.reason ?? "invalid"}`}
          </h4>
          {subtitle && (
            <p className="mt-0.5 text-xs opacity-85">{subtitle}</p>
          )}
          {!isValid && failureMessage && (
            <p className="mt-1 text-xs leading-relaxed font-medium text-red-900">
              {failureMessage}
            </p>
          )}
        </div>
      </div>

      {/* Three Separate Cryptographic Checks */}
      <ul className="mt-3 space-y-1.5" aria-label="Cryptographic check breakdown">
        <CheckRow
          label="Ed25519 Signature (eddsa-jcs-2022)"
          detail="JCS canonical payload + proof options digest"
          passed={result.signature_verified}
        />
        <CheckRow
          label="Canonical Dataset Hash (SHA-256)"
          detail="Matches issued badge record & deterministic seed"
          passed={result.hash_match}
        />
        <CheckRow
          label="Issuer DID Key (did:key)"
          detail="Matches ReconCore Ed25519 public key multibase"
          passed={result.issuer_match}
        />
      </ul>

      {/* Checked Timestamp */}
      <div className="mt-2.5 flex items-center justify-between text-[11px] opacity-75">
        <span className="inline-flex items-center gap-1 font-mono">
          <Clock className="h-3 w-3" aria-hidden="true" />
          Checked: {result.checked_at}
        </span>
        {result.reason && (
          <span className="rounded bg-red-200/80 px-1.5 py-0.5 font-mono font-semibold text-red-950">
            reason: {result.reason}
          </span>
        )}
      </div>
    </section>
  );
}

