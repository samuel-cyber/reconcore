"use client";

import React, { useId, useMemo, useRef, useState } from "react";
import {
  Archive,
  Download,
  FileSpreadsheet,
  Search,
  X,
} from "lucide-react";
import { csvTableUrl, csvZipUrl } from "@/lib/api";
import type { SessionTables, TableKey } from "@/lib/api-types";

interface DataViewerProps {
  sessionId: string;
  tables: SessionTables;
}

const TAB_CONFIG: Array<{
  key: TableKey;
  label: string;
  shortLabel: string;
}> = [
  { key: "pos", label: "POS Logs", shortLabel: "pos_sales_log.csv" },
  {
    key: "waybills",
    label: "Warehouse Waybills",
    shortLabel: "warehouse_waybills.csv",
  },
  {
    key: "bank",
    label: "Bank Statements",
    shortLabel: "bank_settlement.csv",
  },
];

const MONOSPACE_COLUMNS = new Set([
  "tx_id",
  "wb_id",
  "bank_ref",
  "customer_ref",
  "amount",
  "credit_amount",
  "qty",
  "qty_dispatched",
]);

const NUMERIC_ALIGN_COLUMNS = new Set([
  "amount",
  "credit_amount",
  "qty",
  "qty_dispatched",
]);

export default function DataViewer({ sessionId, tables }: DataViewerProps) {
  const [activeTab, setActiveTab] = useState<TableKey>("pos");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const tabRefs = useRef<Record<TableKey, HTMLButtonElement | null>>({
    pos: null,
    waybills: null,
    bank: null,
  });

  const baseId = useId();
  const searchInputId = `${baseId}-table-search`;
  const captionId = `${baseId}-table-caption`;

  const currentTable = tables[activeTab];

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return currentTable.rows;
    return currentTable.rows.filter((row) =>
      row.some((cell) => cell.toLowerCase().includes(query))
    );
  }, [currentTable.rows, searchQuery]);

  const selectAndFocusTab = (nextKey: TableKey) => {
    setActiveTab(nextKey);
    const btn = tabRefs.current[nextKey];
    if (btn) {
      btn.focus();
      btn.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  };

  const handleTabKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = TAB_CONFIG[(index + 1) % TAB_CONFIG.length];
      selectAndFocusTab(next.key);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prev =
        TAB_CONFIG[(index - 1 + TAB_CONFIG.length) % TAB_CONFIG.length];
      selectAndFocusTab(prev.key);
    } else if (e.key === "Home") {
      e.preventDefault();
      selectAndFocusTab(TAB_CONFIG[0].key);
    } else if (e.key === "End") {
      e.preventDefault();
      selectAndFocusTab(TAB_CONFIG[TAB_CONFIG.length - 1].key);
    }
  };

  return (
    <section
      aria-label="Source Datasets Viewer"
      className="flex h-full min-h-0 min-w-0 flex-col bg-white"
    >
      {/* Top Toolbar: Tabs + Download Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/80 px-4 pt-2">
        {/* Tablist */}
        <div
          role="tablist"
          aria-label="Reconciliation dataset tables"
          {...({ focusgroup: "tablist nomemory" } as React.HTMLAttributes<HTMLDivElement>)}
          className="flex min-w-0 items-center gap-1 overflow-x-auto"
        >
          {TAB_CONFIG.map((tab, idx) => {
            const isSelected = activeTab === tab.key;
            const rowCount = tables[tab.key].rows.length;
            return (
              <button
                key={tab.key}
                ref={(el) => {
                  tabRefs.current[tab.key] = el;
                }}
                id={`${baseId}-tab-${tab.key}`}
                type="button"
                role="tab"
                aria-selected={isSelected}
                tabIndex={isSelected ? 0 : -1}
                {...(isSelected
                  ? ({ focusgroupstart: "" } as React.ButtonHTMLAttributes<HTMLButtonElement>)
                  : {})}
                onClick={() => setActiveTab(tab.key)}
                onKeyDown={(e) => handleTabKeyDown(e, idx)}
                className="relative inline-flex flex-none items-center gap-2 px-3.5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 aria-selected:text-slate-950 aria-selected:after:absolute aria-selected:after:inset-x-0 aria-selected:after:bottom-0 aria-selected:after:border-b-[3px] aria-selected:after:border-slate-900 aria-selected:after:content-['']"
              >
                <FileSpreadsheet
                  className="h-4 w-4 shrink-0 text-slate-500"
                  aria-hidden="true"
                />
                <span>{tab.label}</span>
                <span className="rounded-full bg-slate-200/80 px-2 py-0.5 font-mono text-xs tabular-nums text-slate-700">
                  {rowCount}
                </span>
              </button>
            );
          })}
        </div>

        {/* Download CSVs (ZIP + per-table links) */}
        <div className="flex flex-wrap items-center gap-1.5 pb-2">
          <a
            href={csvTableUrl(sessionId, activeTab)}
            download={currentTable.filename}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 hover:text-slate-900"
          >
            <Download className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="font-mono">{currentTable.filename}</span>
          </a>

          <a
            href={csvZipUrl(sessionId)}
            download={`reconcore_${sessionId}_csvs.zip`}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-slate-800"
          >
            <Archive className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Download CSVs</span>
          </a>
        </div>
      </div>

      {/* Sub-bar: Search Box + Row Count + Per-table quick links */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
        <search className="relative flex min-w-[240px] flex-1 items-center sm:max-w-sm">
          <label htmlFor={searchInputId} className="visually-hidden">
            Filter rows in {currentTable.filename}
          </label>
          <Search
            className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400"
            aria-hidden="true"
          />
          <input
            id={searchInputId}
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Filter ${currentTable.filename} rows…`}
            className="w-full rounded-md border border-slate-300 bg-slate-50/60 py-1.5 pr-8 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:bg-white"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Clear table filter"
              className="absolute right-2 inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-200/60 hover:text-slate-700"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </search>

        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
          <span className="font-mono tabular-nums" aria-live="polite">
            Showing{" "}
            <strong className="font-semibold text-slate-900">
              {filteredRows.length}
            </strong>{" "}
            of{" "}
            <strong className="font-semibold text-slate-900">
              {currentTable.rows.length}
            </strong>{" "}
            rows
          </span>

          <div
            className="hidden items-center gap-1.5 border-l border-slate-200 pl-3 sm:flex"
            aria-label="Individual CSV table downloads"
          >
            <span className="text-slate-400">CSVs:</span>
            {TAB_CONFIG.map((t) => (
              <a
                key={t.key}
                href={csvTableUrl(sessionId, t.key)}
                download={tables[t.key].filename}
                className="rounded px-1.5 py-0.5 font-mono text-[11px] text-slate-600 underline decoration-slate-300 underline-offset-2 hover:bg-slate-100 hover:text-slate-900"
              >
                {t.key}.csv
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Tabpanel containing the scrollable raw CSV table */}
      <div
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${activeTab}`}
        className="flex min-h-0 min-w-0 flex-1 flex-col"
      >
        <div
          tabIndex={0}
          role="region"
          aria-labelledby={captionId}
          className="table-wrapper min-h-0 flex-1 overflow-auto"
        >
          <table className="w-full border-separate border-spacing-0 text-left text-sm text-slate-800">
            <caption id={captionId} className="visually-hidden">
              {currentTable.filename} — Raw unformatted source records (
              {filteredRows.length} rows displayed)
            </caption>
            <thead className="sticky top-0 z-10 bg-slate-100 text-xs font-bold tracking-wider text-slate-700 uppercase">
              <tr>
                <th
                  scope="col"
                  className="border-b border-slate-300 bg-slate-100 px-3 py-2.5 text-center font-mono text-[11px] text-slate-400"
                >
                  #
                </th>
                {currentTable.columns.map((col) => (
                  <th
                    key={col}
                    scope="col"
                    className={`border-b border-slate-300 bg-slate-100 px-3.5 py-2.5 font-mono whitespace-nowrap ${
                      NUMERIC_ALIGN_COLUMNS.has(col)
                        ? "text-right"
                        : "text-left"
                    }`}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80">
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={currentTable.columns.length + 1}
                    className="px-4 py-10 text-center text-sm text-slate-500"
                  >
                    No rows in{" "}
                    <code className="font-mono font-semibold">
                      {currentTable.filename}
                    </code>{" "}
                    match &ldquo;{searchQuery}&rdquo;.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, rowIdx) => {
                  const rowId = row[0] ?? `row-${rowIdx}`;
                  return (
                    <tr
                      key={`${rowId}-${rowIdx}`}
                      className="bg-white transition-colors even:bg-slate-50/80 hover:bg-amber-50/50"
                    >
                      <td className="border-b border-slate-200/70 px-3 py-2.5 text-center font-mono text-xs tabular-nums text-slate-400">
                        {rowIdx + 1}
                      </td>
                      {row.map((cell, cellIdx) => {
                        const colName = currentTable.columns[cellIdx] ?? "";
                        const isMono = MONOSPACE_COLUMNS.has(colName);
                        const isNumeric = NUMERIC_ALIGN_COLUMNS.has(colName);

                        // First column is the row header (tx_id, wb_id, bank_ref)
                        if (cellIdx === 0) {
                          return (
                            <th
                              key={`${colName}-${cellIdx}`}
                              scope="row"
                              className="sticky left-0 z-[1] border-b border-slate-200/70 bg-inherit px-3.5 py-2.5 font-mono text-sm font-semibold whitespace-pre tabular-nums text-slate-900"
                            >
                              {cell}
                            </th>
                          );
                        }

                        return (
                          <td
                            key={`${colName}-${cellIdx}`}
                            className={`border-b border-slate-200/70 px-3.5 py-2.5 text-sm whitespace-pre ${
                              isMono
                                ? "font-mono tabular-nums text-slate-900"
                                : "text-slate-800"
                            } ${isNumeric ? "text-right" : "text-left"} ${
                              cell === "" ? "italic text-slate-400" : ""
                            }`}
                          >
                            {cell === "" ? "—" : cell}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

