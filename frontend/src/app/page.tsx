"use client";

import React, { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Award,
  Clock,
  Info,
  ListChecks,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { ApiError, initSession, isMockMode } from "@/lib/api";
import { useSession } from "@/lib/session-context";

export default function StartScreenPage() {
  const router = useRouter();
  const { setSessionData, showToast } = useSession();

  const [candidateName, setCandidateName] = useState("");
  const [urlSeed, setUrlSeed] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isWakingServer, setIsWakingServer] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const nameInputId = useId();

  // Only show seed when ?seed=demo is present in the URL
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const seedParam = params.get("seed");
      if (seedParam === "demo") {
        setUrlSeed("demo");
      } else {
        setUrlSeed(null);
      }
    } catch {
      setUrlSeed(null);
    }
  }, []);

  // Show "Waking the server…" after 3 s of waiting
  useEffect(() => {
    if (!isLoading) {
      setIsWakingServer(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setIsWakingServer(true);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [isLoading]);

  const handleStart = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLoading) return;

    setFormError(null);
    const trimmedName = candidateName.trim();
    if (!trimmedName || trimmedName.length > 60) {
      const msg =
        "Please enter your full name (1–60 characters) for your skill credential.";
      setFormError(msg);
      showToast(msg, "invalid_input", "error");
      return;
    }

    setIsLoading(true);
    try {
      const initResponse = await initSession({
        candidate_name: trimmedName,
        seed: urlSeed ?? "demo",
      });
      setSessionData(initResponse, trimmedName, urlSeed ?? undefined);
      router.push("/briefing");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to initialize simulation session.";
      const code = err instanceof ApiError ? err.code : "connection_error";
      setFormError(message);
      showToast(message, code, "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      {/* Top Navigation */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 font-mono text-sm font-bold text-white">
              RC
            </span>
            <span className="text-base font-bold tracking-tight text-slate-900">
              ReconCore
            </span>
            {urlSeed === "demo" && (
              <span className="rounded border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-xs font-medium text-slate-700">
                seed=demo
              </span>
            )}
          </div>

          <nav aria-label="Primary">
            <ul className="flex items-center gap-4 text-xs font-medium text-slate-600">
              {isMockMode() && (
                <li>
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 font-mono text-xs font-semibold text-amber-900">
                    Mock Fixtures Active
                  </span>
                </li>
              )}
              <li>
                <Link
                  href="/verify"
                  className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 shadow-2xs transition-colors hover:bg-slate-50"
                >
                  <ShieldCheck
                    className="h-4 w-4 text-emerald-700"
                    aria-hidden="true"
                  />
                  <span>Employer Credential Verifier</span>
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </header>

      {/* Main Content — Hero and Form Card aligned at the top (items-start) */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 py-8">
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          {/* Left Column: Hero, Facts Row & Workspace Preview Image */}
          <div className="flex flex-col gap-6 lg:col-span-7">
            <div className="flex flex-col gap-4">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-2xs">
                <span
                  className="h-2 w-2 rounded-full bg-emerald-600"
                  aria-hidden="true"
                />
                <span>Operational Reconciliation Assessment · Alimosho Q3</span>
              </div>

              <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Prove you can reconcile messy real-world financial operations.
              </h1>

              <p className="text-base leading-relaxed text-slate-600">
                Inspect unformatted POS sales logs, warehouse dispatch waybills,
                and bank settlement statements. Submit your exact numerical
                findings to earn a cryptographically signed skill credential.
              </p>
            </div>

            {/* Facts Row: ~20 min, 3 findings, verifiable badge */}
            <dl
              aria-label="Assessment facts"
              className="grid grid-cols-1 gap-4 sm:grid-cols-3"
            >
              <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-2xs">
                <Clock
                  className="mt-0.5 h-5 w-5 shrink-0 text-slate-700"
                  aria-hidden="true"
                />
                <div>
                  <dt className="text-sm font-bold text-slate-900">~20 min</dt>
                  <dd className="mt-1 text-xs text-slate-600">
                    Self-paced audit simulation
                  </dd>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-2xs">
                <ListChecks
                  className="mt-0.5 h-5 w-5 shrink-0 text-slate-700"
                  aria-hidden="true"
                />
                <div>
                  <dt className="text-sm font-bold text-slate-900">
                    3 findings
                  </dt>
                  <dd className="mt-1 text-xs text-slate-600">
                    Discrepancy, missing TX &amp; duplicate waybill
                  </dd>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-2xs">
                <Award
                  className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700"
                  aria-hidden="true"
                />
                <div>
                  <dt className="text-sm font-bold text-slate-900">
                    Verifiable badge
                  </dt>
                  <dd className="mt-1 text-xs text-slate-600">
                    Ed25519-signed Open Badges 3.0 proof
                  </dd>
                </div>
              </div>
            </dl>

            {/* Workspace Preview Image Panel */}
            <figure className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs">
              <div className="mb-4 flex items-center justify-between gap-2">
                <figcaption className="text-xs font-bold tracking-wider text-slate-700 uppercase">
                  Workspace Preview
                </figcaption>
                <span className="text-xs text-slate-500">
                  Two-pane audit view · Sticky IDs &amp; CSV export
                </span>
              </div>
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                <img
                  src="/workspace-preview.svg"
                  alt="Preview of the ReconCore two-pane reconciliation workspace showing Left pane tabs (Brief, Answer, Hints) and Right pane Data Viewer with sticky first column"
                  width={800}
                  height={460}
                  className="block h-auto w-full"
                />
              </div>
            </figure>
          </div>

          {/* Right Column: Candidate Start Card (Aligned at top with Hero, 24px padding, 16px field gap) */}
          <div className="lg:col-span-5">
            <section
              aria-labelledby="start-card-heading"
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="border-b border-slate-200 pb-4">
                <h2
                  id="start-card-heading"
                  className="text-lg font-bold text-slate-900"
                >
                  Begin Candidate Assessment
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  Enter your display name to review the scenario briefing. Your
                  timer will only start after you read the briefing and click
                  Begin.
                </p>
              </div>

              <form onSubmit={handleStart} className="mt-6 flex flex-col gap-4" noValidate>
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor={nameInputId}
                    className="block text-xs font-semibold text-slate-800"
                  >
                    Candidate Display Name
                  </label>
                  <span
                    id={`${nameInputId}-hint`}
                    className="block text-xs text-slate-500"
                  >
                    Signed into your verifiable credential upon completion (1–60
                    characters)
                  </span>
                  <input
                    id={nameInputId}
                    name="candidate_name"
                    type="text"
                    autoComplete="name"
                    required
                    maxLength={60}
                    autoFocus
                    value={candidateName}
                    onChange={(e) => {
                      setCandidateName(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    placeholder="e.g. Ada Okafor"
                    aria-invalid={Boolean(formError)}
                    aria-describedby={`${nameInputId}-hint`}
                    className="w-full rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-2xs placeholder:text-slate-400 focus:border-slate-900"
                  />
                </div>

                {/* Show seed only when ?seed=demo */}
                {urlSeed === "demo" && (
                  <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-700">
                    <span>Deterministic simulation seed active</span>
                    <code className="font-mono font-semibold text-slate-900">
                      seed=demo
                    </code>
                  </div>
                )}

                {/* Error State */}
                {formError && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-4 text-xs text-red-900"
                  >
                    <AlertCircle
                      className="mt-0.5 h-4 w-4 shrink-0 text-red-700"
                      aria-hidden="true"
                    />
                    <div className="flex-1">
                      <p className="font-semibold">Unable to start assessment</p>
                      <p className="mt-1">{formError}</p>
                    </div>
                  </div>
                )}

                {/* Empty / Ready Helper State */}
                {!formError && !isLoading && !candidateName.trim() && (
                  <div className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                    <Info
                      className="mt-0.5 h-4 w-4 shrink-0 text-slate-500"
                      aria-hidden="true"
                    />
                    <span>
                      Enter your name above to load the scenario briefing and
                      task checklist.
                    </span>
                  </div>
                )}

                {/* Loading State */}
                {isLoading && (
                  <div
                    role="status"
                    className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700"
                  >
                    <Loader2
                      className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-slate-900"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="font-semibold">
                        {isWakingServer
                          ? "Waking the server…"
                          : "Preparing scenario briefing…"}
                      </p>
                      {isWakingServer && (
                        <p className="mt-1 text-amber-800">
                          Cold-starting the backend instance — this can take
                          30–50 seconds on first load.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-65"
                >
                  {isLoading ? (
                    <>
                      <Loader2
                        className="h-4 w-4 shrink-0 animate-spin"
                        aria-hidden="true"
                      />
                      <span>Loading briefing…</span>
                    </>
                  ) : (
                    <>
                      <span>Continue to Briefing</span>
                      <ArrowRight
                        className="h-4 w-4 shrink-0"
                        aria-hidden="true"
                      />
                    </>
                  )}
                </button>
              </form>
            </section>
          </div>
        </div>
      </main>

      {/* Footer — positioned away from viewport corners so no floating badge overlaps the link */}
      <footer className="border-t border-slate-200 bg-white py-4">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-start gap-6 px-6 pr-24 text-xs text-slate-500">
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
