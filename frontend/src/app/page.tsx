"use client";

import React, { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  KeyRound,
  Loader2,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { ApiError, initSession, isMockMode } from "@/lib/api";
import { useSession } from "@/lib/session-context";

export default function StartScreenPage() {
  const router = useRouter();
  const { setSessionData, showToast } = useSession();

  const [candidateName, setCandidateName] = useState("");
  const [demoSeedEnabled, setDemoSeedEnabled] = useState(true);
  const [customSeed, setCustomSeed] = useState("demo");
  const [showSeedControls, setShowSeedControls] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isWakingServer, setIsWakingServer] = useState(false);

  const nameInputId = useId();
  const seedInputId = useId();

  // Read ?seed= query parameter on mount (e.g. /?seed=demo)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlSeed = params.get("seed");
      if (urlSeed) {
        setDemoSeedEnabled(true);
        setCustomSeed(urlSeed);
      }
    } catch {
      // Ignore URL parsing issues
    }
  }, []);

  // Section 6.4: Show "Waking the server…" after 3 s of waiting
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

    const trimmedName = candidateName.trim();
    if (!trimmedName || trimmedName.length > 60) {
      showToast(
        "Please enter your full name (1–60 characters) for your skill credential.",
        "invalid_input",
        "error"
      );
      return;
    }

    const effectiveSeed = demoSeedEnabled
      ? customSeed.trim() || "demo"
      : undefined;

    setIsLoading(true);
    try {
      const initResponse = await initSession({
        candidate_name: trimmedName,
        ...(effectiveSeed ? { seed: effectiveSeed } : {}),
      });
      setSessionData(initResponse, trimmedName, effectiveSeed);
      router.push("/workspace");
    } catch (err) {
      if (err instanceof ApiError) {
        showToast(err.message, err.code, "error");
      } else {
        showToast(
          err instanceof Error
            ? err.message
            : "Failed to initialize simulation session.",
          "connection_error",
          "error"
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      {/* Top Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 font-mono text-sm font-bold text-white">
              RC
            </span>
            <span className="text-base font-bold tracking-tight text-slate-900">
              ReconCore
            </span>
            <span className="hidden rounded border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-medium text-slate-600 sm:inline-block">
              OB 3.0 · eddsa-jcs-2022
            </span>
          </div>

          <nav aria-label="Primary">
            <ul className="flex items-center gap-4 text-xs font-medium text-slate-600">
              {isMockMode() && (
                <li>
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-amber-900">
                    Mock Fixtures Active
                  </span>
                </li>
              )}
              <li>
                <Link
                  href="/verify"
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-2xs transition-colors hover:bg-slate-50"
                >
                  <ShieldCheck
                    className="h-3.5 w-3.5 text-emerald-700"
                    aria-hidden="true"
                  />
                  <span>Employer Credential Verifier</span>
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 py-10">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
          {/* Left Column: Value Proposition & Scenario Overview */}
          <div className="space-y-6 lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-2xs">
              <span
                className="h-2 w-2 rounded-full bg-emerald-600"
                aria-hidden="true"
              />
              <span>Featured Simulation · Alimosho Retail &amp; Logistics Q3</span>
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Prove you can reconcile messy real-world financial operations.
            </h1>

            <p className="text-base leading-relaxed text-slate-600">
              ReconCore is a{" "}
              <strong className="font-semibold text-slate-900">
                HackerRank for Business Operations
              </strong>{" "}
              that gives candidates messy company spreadsheets to reconcile,
              grades their exact numerical findings with deterministic code, and
              mints a cryptographically verifiable skill credential.
            </p>

            {/* Architecture Pillars */}
            <dl className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-2xs">
                <dt className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase">
                  <FileSpreadsheet
                    className="h-4 w-4 text-slate-700"
                    aria-hidden="true"
                  />
                  <span>3 Messy CSV Tables</span>
                </dt>
                <dd className="mt-1.5 text-xs leading-relaxed text-slate-600">
                  Cross-check cashier POS logs, warehouse dispatch waybills, and
                  GTBank credit statements.
                </dd>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-2xs">
                <dt className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase">
                  <Database
                    className="h-4 w-4 text-slate-700"
                    aria-hidden="true"
                  />
                  <span>Deterministic Grade</span>
                </dt>
                <dd className="mt-1.5 text-xs leading-relaxed text-slate-600">
                  Strict integer Naira &amp; ID matching in Python. Socratic AI
                  coaches you on misses without ever grading.
                </dd>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-2xs">
                <dt className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase">
                  <KeyRound
                    className="h-4 w-4 text-emerald-700"
                    aria-hidden="true"
                  />
                  <span>Ed25519 Signed Proof</span>
                </dt>
                <dd className="mt-1.5 text-xs leading-relaxed text-slate-600">
                  Pass 3/3 exact to mint an Open Badges 3.0–structured
                  credential bound to your dataset SHA-256 hash.
                </dd>
              </div>
            </dl>
          </div>

          {/* Right Column: Candidate Start Card */}
          <div className="lg:col-span-5">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-md">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-lg font-bold text-slate-900">
                  Launch Assessment Workspace
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  No account required. Your display name will be cryptographically
                  signed into your Open Badge upon completion.
                </p>
              </div>

              <form onSubmit={handleStart} className="mt-5 space-y-4">
                <div>
                  <label
                    htmlFor={nameInputId}
                    className="block text-xs font-semibold text-slate-800"
                  >
                    Candidate Display Name
                  </label>
                  <span
                    id={`${nameInputId}-hint`}
                    className="mt-0.5 block text-[11px] text-slate-500"
                  >
                    Appears on your verifiable credential (1–60 characters)
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
                    onChange={(e) => setCandidateName(e.target.value)}
                    placeholder="e.g. Ada Okafor"
                    aria-describedby={`${nameInputId}-hint`}
                    className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs placeholder:text-slate-400 focus:border-slate-800"
                  />
                </div>

                {/* Discreet / Hidden Demo Seed Toggle */}
                <div className="pt-1">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setShowSeedControls((prev) => !prev)}
                      aria-expanded={showSeedControls}
                      className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 hover:text-slate-800"
                    >
                      <SlidersHorizontal
                        className="h-3 w-3"
                        aria-hidden="true"
                      />
                      <span>
                        Simulation seed:{" "}
                        <code className="font-mono font-semibold text-slate-700">
                          {demoSeedEnabled ? customSeed || "demo" : "random"}
                        </code>
                      </span>
                    </button>

                    {demoSeedEnabled && (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-800">
                        <CheckCircle2
                          className="h-2.5 w-2.5"
                          aria-hidden="true"
                        />
                        seed=demo locked
                      </span>
                    )}
                  </div>

                  {showSeedControls && (
                    <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <label
                          htmlFor="demo-mode-checkbox"
                          className="font-medium text-slate-700"
                        >
                          Use deterministic seed (recommended for live demo)
                        </label>
                        <input
                          id="demo-mode-checkbox"
                          type="checkbox"
                          checked={demoSeedEnabled}
                          onChange={(e) =>
                            setDemoSeedEnabled(e.target.checked)
                          }
                          className="h-4 w-4 rounded border-slate-300 accent-slate-900"
                        />
                      </div>

                      {demoSeedEnabled && (
                        <div className="mt-2">
                          <label
                            htmlFor={seedInputId}
                            className="block text-[11px] font-medium text-slate-600"
                          >
                            Seed string
                          </label>
                          <input
                            id={seedInputId}
                            type="text"
                            value={customSeed}
                            onChange={(e) => setCustomSeed(e.target.value)}
                            placeholder="demo"
                            className="mt-1 w-full rounded border border-slate-300 bg-white px-2.5 py-1 font-mono text-xs text-slate-900"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-65"
                >
                  {isLoading ? (
                    <>
                      <Loader2
                        className="h-4 w-4 shrink-0 animate-spin"
                        aria-hidden="true"
                      />
                      <span>
                        {isWakingServer
                          ? "Waking the server…"
                          : "Initialising reconciliation dataset…"}
                      </span>
                    </>
                  ) : (
                    <>
                      <span>Start simulation</span>
                      <ArrowRight
                        className="h-4 w-4 shrink-0"
                        aria-hidden="true"
                      />
                    </>
                  )}
                </button>

                {isWakingServer && (
                  <p
                    role="status"
                    className="text-center text-xs text-amber-800"
                  >
                    Cold-starting the backend instance — this can take 30–50
                    seconds on first load.
                  </p>
                )}
              </form>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-6 text-xs text-slate-500">
          <span>
            ReconCore · AI generates the scenario &amp; Socratic hints;
            deterministic code grades &amp; signs the proof.
          </span>
          <Link
            href="/verify"
            className="font-medium text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
          >
            Verify an existing badge JSON →
          </Link>
        </div>
      </footer>
    </div>
  );
}

