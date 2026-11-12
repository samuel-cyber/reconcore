"use client";

import React from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  CheckSquare,
  FileText,
  Hash,
  Inbox,
  Loader2,
  UserCheck,
} from "lucide-react";
import type { BriefInfo, ScenarioInfo } from "@/lib/api-types";
import { useSession } from "@/lib/session-context";

interface BriefPanelProps {
  scenario?: ScenarioInfo | null;
  brief?: BriefInfo | null;
  datasetHash?: string;
  candidateName?: string;
  isLoading?: boolean;
  error?: string | null;
}

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return tokens.map((token, idx) => {
    if (token.startsWith("**") && token.endsWith("**") && token.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-slate-900">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith("`") && token.endsWith("`") && token.length > 2) {
      return (
        <code
          key={idx}
          className="rounded bg-slate-200/80 px-1.5 py-0.5 font-mono text-xs font-medium text-slate-900"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={idx}>{token}</React.Fragment>;
  });
}

const TASK_FIELD_KEYS = [
  "discrepancy_ngn",
  "missing_tx_id",
  "duplicate_wb_id",
] as const;

const TASK_LABELS = [
  "1. Total Net Discrepancy (₦)",
  "2. Missing Bank Settlement TX ID",
  "3. Duplicated Warehouse Waybill ID",
];

export default function BriefPanel({
  scenario,
  brief,
  datasetHash = "",
  candidateName,
  isLoading = false,
  error = null,
}: BriefPanelProps) {
  const {
    checkedTasks,
    toggleTaskChecked,
    latestFieldStatus,
    setActiveWorkspaceTab,
  } = useSession();

  // Loading state
  if (isLoading) {
    return (
      <div
        role="status"
        className="flex flex-col items-center justify-center gap-4 rounded-lg border border-slate-200 bg-slate-50 p-6 text-center"
      >
        <Loader2
          className="h-6 w-6 animate-spin text-slate-700"
          aria-hidden="true"
        />
        <p className="text-xs font-medium text-slate-600">
          Loading scenario brief…
        </p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        role="alert"
        className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-4 text-xs text-red-900"
      >
        <AlertCircle
          className="mt-0.5 h-4 w-4 shrink-0 text-red-700"
          aria-hidden="true"
        />
        <div>
          <p className="font-semibold">Error loading scenario brief</p>
          <p className="mt-1">{error}</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (!scenario || !brief) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
        <Inbox className="h-6 w-6 text-slate-400" aria-hidden="true" />
        <p className="text-xs font-semibold text-slate-700">
          No scenario brief available
        </p>
        <p className="text-xs text-slate-500">
          Start or reload a session to view the reconciliation brief.
        </p>
      </div>
    );
  }

  const paragraphs = brief.body_markdown
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const shortHash =
    datasetHash.length > 22
      ? `${datasetHash.slice(0, 19)}…${datasetHash.slice(-6)}`
      : datasetHash;

  return (
    <section
      aria-labelledby="brief-heading"
      className="flex flex-col gap-6 text-slate-800"
    >
      {/* Scenario Header */}
      <div className="flex flex-col gap-2 border-b border-slate-200 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-slate-500">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700">
            <FileText
              className="h-3.5 w-3.5 text-slate-500"
              aria-hidden="true"
            />
            {scenario.id}
          </span>
          {shortHash && (
            <span
              className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600"
              title={`Canonical Dataset Hash: ${datasetHash}`}
            >
              <Hash className="h-3 w-3 text-slate-500" aria-hidden="true" />
              {shortHash}
            </span>
          )}
        </div>

        <h2
          id="brief-heading"
          className="text-base font-bold leading-snug text-slate-900"
        >
          {scenario.title}
        </h2>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
          <div>
            <span className="font-semibold text-slate-700">Manager:</span>{" "}
            <span>{brief.from}</span>
          </div>
          {candidateName && (
            <div className="inline-flex items-center gap-1 font-medium text-slate-700">
              <UserCheck
                className="h-3.5 w-3.5 text-emerald-700"
                aria-hidden="true"
              />
              <span>Auditor: {candidateName}</span>
            </div>
          )}
        </div>
      </div>

      {/* Task Definitions as a Checklist */}
      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-slate-900 uppercase">
            <CheckSquare
              className="h-4 w-4 shrink-0 text-slate-800"
              aria-hidden="true"
            />
            <span>Task Definitions Checklist</span>
          </div>
          <span className="font-mono text-xs text-slate-500">3 tasks</span>
        </div>

        {brief.task_definitions.length === 0 ? (
          <p className="text-xs text-slate-500">No task definitions listed.</p>
        ) : (
          <ul className="flex flex-col gap-4" role="list">
            {brief.task_definitions.map((rule, idx) => {
              const fieldKey = TASK_FIELD_KEYS[idx];
              const isVerifiedCorrect =
                fieldKey && latestFieldStatus?.[fieldKey] === "correct";
              const isChecked =
                Boolean(checkedTasks[idx]) || Boolean(isVerifiedCorrect);
              const checkId = `workspace-brief-task-${idx}`;

              return (
                <li
                  key={idx}
                  className={`flex items-start gap-2 rounded-md border p-2 transition-colors ${
                    isVerifiedCorrect
                      ? "border-emerald-300 bg-emerald-50/70"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <input
                    id={checkId}
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleTaskChecked(idx)}
                    className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 accent-slate-900"
                  />
                  <label
                    htmlFor={checkId}
                    className="flex-1 cursor-pointer text-xs leading-relaxed text-slate-800"
                  >
                    <span className="flex items-center justify-between gap-2 font-bold text-slate-900">
                      <span>{TASK_LABELS[idx] ?? `Task ${idx + 1}`}</span>
                      {isVerifiedCorrect && (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-800">
                          <CheckCircle2
                            className="h-3 w-3"
                            aria-hidden="true"
                          />
                          Verified
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block text-slate-600">
                      {renderInlineMarkdown(rule)}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Manager's Narrative Brief */}
      <div className="flex flex-col gap-4 text-sm leading-relaxed text-slate-700">
        <h3 className="text-xs font-bold tracking-wider text-slate-500 uppercase">
          Background Memo
        </h3>
        {paragraphs.map((paragraph, index) => (
          <p key={index}>{renderInlineMarkdown(paragraph)}</p>
        ))}
      </div>

      {/* CTA to switch to Answer tab */}
      <button
        type="button"
        onClick={() => setActiveWorkspaceTab("answer")}
        className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-900 shadow-2xs transition-colors hover:bg-slate-50"
      >
        <span>Go to Answer Form</span>
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </section>
  );
}
