"use client";

import React from "react";
import { FileText, Hash, ShieldCheck, UserCheck } from "lucide-react";
import type { BriefInfo, ScenarioInfo } from "@/lib/api-types";

interface BriefPanelProps {
  scenario: ScenarioInfo;
  brief: BriefInfo;
  datasetHash: string;
  candidateName?: string;
}

/**
 * Renders inline markdown (**bold** and `code`) safely without dangerouslySetInnerHTML.
 */
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
          className="rounded bg-slate-200/80 px-1.5 py-0.5 font-mono text-[13px] font-medium text-slate-900"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={idx}>{token}</React.Fragment>;
  });
}

export default function BriefPanel({
  scenario,
  brief,
  datasetHash,
  candidateName,
}: BriefPanelProps) {
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
      className="flex flex-col gap-3.5 text-slate-800"
    >
      {/* Scenario Header */}
      <div className="border-b border-slate-200 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-slate-500">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">
            <FileText className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            {scenario.id}
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600"
            title={`Canonical Dataset Hash: ${datasetHash}`}
          >
            <Hash className="h-3 w-3 text-slate-500" aria-hidden="true" />
            {shortHash}
          </span>
        </div>

        <h2
          id="brief-heading"
          className="mt-2 text-base font-bold leading-snug text-slate-900"
        >
          {scenario.title}
        </h2>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200/80 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
          <div>
            <span className="font-semibold text-slate-700">From:</span>{" "}
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

      {/* Manager's Narrative Brief */}
      <div className="space-y-2.5 text-sm leading-relaxed text-slate-700">
        {paragraphs.map((paragraph, index) => (
          <p key={index}>{renderInlineMarkdown(paragraph)}</p>
        ))}
      </div>

      {/* Highlighted Task Definitions Box */}
      <div className="rounded-lg border border-amber-300/90 bg-amber-50/90 p-3 shadow-2xs">
        <div className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-amber-950 uppercase">
          <ShieldCheck
            className="h-4 w-4 shrink-0 text-amber-800"
            aria-hidden="true"
          />
          <span>Grading Rules &amp; Task Definitions</span>
        </div>
        <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-amber-950">
          {brief.task_definitions.map((rule, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-700"
                aria-hidden="true"
              />
              <span>{renderInlineMarkdown(rule)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

