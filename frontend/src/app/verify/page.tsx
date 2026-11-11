"use client";

import React, { useEffect, useId, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  FileJson,
  FlaskConical,
  KeyRound,
  Loader2,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { getIssuer, verifyBadge } from "@/lib/api";
import type {
  BadgeCredential,
  IssuerProfile,
  VerifyResponse,
} from "@/lib/api-types";
import { useSession } from "@/lib/session-context";
import VerifyResult from "@/components/VerifyResult";
import submitPassFixture from "@/mocks/submit-pass.json";

export default function StandaloneVerifyPage() {
  const { badge: sessionBadge, showToast } = useSession();

  const [jsonInput, setJsonInput] = useState<string>("");
  const [uploadedFilename, setUploadedFilename] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResponse | null>(null);
  const [issuer, setIssuer] = useState<IssuerProfile | null>(null);

  const textareaId = useId();
  const fileInputId = useId();

  // Pre-populate with active session badge if one exists, and fetch issuer profile
  useEffect(() => {
    if (sessionBadge && !jsonInput) {
      setJsonInput(JSON.stringify(sessionBadge, null, 2));
    }
    getIssuer()
      .then((profile) => setIssuer(profile))
      .catch(() => {
        // Non-blocking if backend is offline
      });
  }, [sessionBadge, jsonInput]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setJsonInput(text);
      setUploadedFilename(file.name);
      setVerifyResult(null);
    } catch {
      showToast("Could not read the selected JSON file.", "file_read_error");
    }
  };

  const handleLoadSampleValid = () => {
    const targetBadge = sessionBadge ?? submitPassFixture.badge;
    setJsonInput(JSON.stringify(targetBadge, null, 2));
    setUploadedFilename("sample-valid-badge.json");
    setVerifyResult(null);
  };

  const handleLoadSampleTampered = () => {
    const baseBadge = structuredClone(
      (sessionBadge ?? submitPassFixture.badge) as BadgeCredential
    );
    baseBadge.credentialSubject.name = `${baseBadge.credentialSubject.name} (edited)`;
    setJsonInput(JSON.stringify(baseBadge, null, 2));
    setUploadedFilename("sample-tampered-badge.json");
    setVerifyResult(null);
  };

  const handleVerifySubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isVerifying) return;

    const trimmed = jsonInput.trim();
    if (!trimmed) {
      showToast(
        "Paste a badge JSON-LD credential or upload a badge.json file first.",
        "empty_input"
      );
      return;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      // Malformed JSON still produces a structured VerifyResult per section 4 & 5.6
      setVerifyResult({
        valid: false,
        signature_verified: false,
        hash_match: false,
        issuer_match: false,
        reason: "malformed",
        checked_at: new Date().toISOString(),
      });
      return;
    }

    setIsVerifying(true);
    try {
      const result = await verifyBadge(parsed);
      setVerifyResult(result);
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : "Unable to reach credential verification service.",
        "verify_error"
      );
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-3.5">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-bold text-slate-900"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 font-mono text-sm font-bold text-white">
                RC
              </span>
              <span>ReconCore</span>
            </Link>
            <span className="text-slate-300" aria-hidden="true">
              /
            </span>
            <span className="text-xs font-semibold text-slate-700 sm:text-sm">
              Employer Credential Verifier
            </span>
          </div>

          <nav aria-label="Verifier navigation" className="flex items-center gap-3">
            {sessionBadge && (
              <Link
                href="/workspace"
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Back to Workspace
              </Link>
            )}
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Start Screen</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Standalone Open Badges 3.0 Verifier
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Paste or upload a candidate&apos;s <code className="font-mono">badge.json</code>{" "}
            credential to verify its Ed25519 Data Integrity signature (
            <code className="font-mono">eddsa-jcs-2022</code>), canonical
            dataset SHA-256 hash, and issuer DID key. Works independently of any
            candidate session.
          </p>
        </div>

        {/* Issuer Public Key Bar */}
        {issuer && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 shadow-2xs">
            <div className="flex items-center gap-2">
              <KeyRound
                className="h-4 w-4 shrink-0 text-emerald-700"
                aria-hidden="true"
              />
              <span className="font-semibold text-slate-800">
                Trusted Issuer ({issuer.name}):
              </span>
              <code className="break-all font-mono text-slate-700">
                {issuer.id}
              </code>
            </div>
            <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600">
              eddsa-jcs-2022
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: Badge JSON Input & Upload Form */}
          <form
            onSubmit={handleVerifySubmit}
            className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-7"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor={textareaId}
                className="text-xs font-bold tracking-wider text-slate-800 uppercase"
              >
                Credential JSON-LD Payload
              </label>

              <div className="flex flex-wrap items-center gap-1.5">
                <label
                  htmlFor={fileInputId}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
                >
                  <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Upload badge.json</span>
                  <input
                    id={fileInputId}
                    type="file"
                    accept=".json,application/json,application/ld+json"
                    onChange={handleFileUpload}
                    className="visually-hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={handleLoadSampleValid}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  <FileJson className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Sample Valid</span>
                </button>

                <button
                  type="button"
                  onClick={handleLoadSampleTampered}
                  className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-900 hover:bg-red-100"
                >
                  <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Sample Tampered</span>
                </button>
              </div>
            </div>

            {uploadedFilename && (
              <div className="text-xs text-slate-500">
                Loaded file:{" "}
                <code className="font-mono font-semibold text-slate-800">
                  {uploadedFilename}
                </code>
              </div>
            )}

            <textarea
              id={textareaId}
              rows={15}
              value={jsonInput}
              onChange={(e) => {
                setJsonInput(e.target.value);
                setUploadedFilename(null);
              }}
              placeholder='Paste Open Badges 3.0 credential JSON here (e.g. { "@context": [...], "type": ["VerifiableCredential", "OpenBadgeCredential"], ... })'
              className="w-full rounded-lg border border-slate-300 bg-slate-950 p-3.5 font-mono text-xs leading-relaxed text-slate-100 placeholder:text-slate-500 focus:border-slate-700"
            />

            <button
              type="submit"
              disabled={isVerifying}
              className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-slate-800 disabled:opacity-60"
            >
              {isVerifying ? (
                <>
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                  <span>Verifying Ed25519 Signature &amp; Dataset Hash…</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  <span>Verify Credential</span>
                </>
              )}
            </button>
          </form>

          {/* Right: Verification Result Display */}
          <div className="flex flex-col gap-4 lg:col-span-5">
            {verifyResult ? (
              <VerifyResult
                result={verifyResult}
                title="Employer Verification Output"
              />
            ) : (
              <div className="flex h-full min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
                <ShieldCheck
                  className="h-9 w-9 text-slate-400"
                  aria-hidden="true"
                />
                <h2 className="mt-3 text-sm font-bold text-slate-800">
                  Ready to Verify
                </h2>
                <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-500">
                  Paste or upload a badge JSON payload and click{" "}
                  <strong>Verify Credential</strong> to inspect the three
                  cryptographic checks (Ed25519 signature, dataset SHA-256 hash,
                  and issuer DID).
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

