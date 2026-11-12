"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Archive,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Inbox,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { csvTableUrl, csvZipUrl } from "@/lib/api";
import type { SessionTables, TableKey } from "@/lib/api-types";

interface DataViewerProps {
  sessionId: string;
  tables?: SessionTables | null;
  isLoading?: boolean;
  error?: string | null;
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

export default function DataViewer({
  sessionId,
  tables,
  isLoading = false,
  error = null,
}: DataViewerProps) {
  const [activeTab, setActiveTab] = useState<TableKey>("pos");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [downloadMenuOpen, setDownloadMenuOpen] = useState<boolean>(false);

  const tabRefs = useRef<Record<TableKey, HTMLButtonElement | null>>({
    pos: null,
    waybills: null,
    bank: null,
  });
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);
  const menuItemRefs = useRef<Array<HTMLAnchorElement | null>>([]);

  const baseId = useId();
  const searchInputId = `${baseId}-table-search`;
  const captionId = `${baseId}-table-caption`;
  const downloadTriggerId = `${baseId}-download-trigger`;
  const downloadMenuId = `${baseId}-download-menu`;

  // Close download menu on outside click or Escape
  useEffect(() => {
    if (!downloadMenuOpen) return;

    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuContainerRef.current &&
        !menuContainerRef.current.contains(target) &&
        menuTriggerRef.current &&
        !menuTriggerRef.current.contains(target)
      ) {
        setDownloadMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setDownloadMenuOpen(false);
        menuTriggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [downloadMenuOpen]);

  const currentTable = tables?.[activeTab] ?? null;

  const filteredRows = useMemo(() => {
    if (!currentTable) return [];
    const query = searchQuery.trim().toLowerCase();
    if (!query) return currentTable.rows;
    return currentTable.rows.filter((row) =>
      row.some((cell) => cell.toLowerCase().includes(query))
    );
  }, [currentTable, searchQuery]);

  // Loading state
  if (isLoading) {
    return (
      <section
        aria-label="Source Datasets Viewer"
        role="status"
        className="flex h-full min-h-0 min-w-0 flex-col items-center justify-center gap-4 bg-white p-6 text-center"
      >
        <Loader2
          className="h-8 w-8 animate-spin text-slate-900"
          aria-hidden="true"
        />
        <p className="text-sm font-medium text-slate-600">
          Loading reconciliation dataset tables…
        </p>
      </section>
    );
  }

  // Error state
  if (error) {
    return (
      <section
        aria-label="Source Datasets Viewer"
        role="alert"
        className="flex h-full min-h-0 min-w-0 flex-col items-center justify-center gap-4 bg-white p-6 text-center"
      >
        <div className="flex max-w-md items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-4 text-left text-xs text-red-900">
          <AlertCircle
            className="mt-0.5 h-4 w-4 shrink-0 text-red-700"
            aria-hidden="true"
          />
          <div>
            <p className="font-semibold">Error loading dataset tables</p>
            <p className="mt-1">{error}</p>
          </div>
        </div>
      </section>
    );
  }

  // Empty state when no tables are available
  if (!tables || !currentTable) {
    return (
      <section
        aria-label="Source Datasets Viewer"
        className="flex h-full min-h-0 min-w-0 flex-col items-center justify-center gap-4 bg-white p-6 text-center"
      >
        <Inbox className="h-8 w-8 text-slate-400" aria-hidden="true" />
        <div>
          <p className="text-sm font-bold text-slate-800">
            No dataset tables available
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Initialize a reconciliation session to inspect CSV records.
          </p>
        </div>
      </section>
    );
  }

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

  const handleMenuTriggerKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>
  ) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setDownloadMenuOpen(true);
      window.requestAnimationFrame(() => {
        menuItemRefs.current[0]?.focus();
      });
    }
  };

  const handleMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = menuItemRefs.current.filter(
      (el): el is HTMLAnchorElement => el !== null
    );
    if (items.length === 0) return;
    const currentIndex = items.indexOf(
      document.activeElement as HTMLAnchorElement
    );

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = (currentIndex + 1) % items.length;
      items[next]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = (currentIndex - 1 + items.length) % items.length;
      items[prev]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === "Tab") {
      setDownloadMenuOpen(false);
    }
  };

  return (
    <section
      aria-label="Source Datasets Viewer"
      className="flex h-full min-h-0 min-w-0 flex-col gap-4 bg-white p-6"
    >
      {/* Top Toolbar: Dataset Tabs + Single Download Menu Control */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        {/* Tablist */}
        <div
          role="tablist"
          aria-label="Reconciliation dataset tables"
          {...({
            focusgroup: "tablist nomemory",
          } as React.HTMLAttributes<HTMLDivElement>)}
          className="flex min-w-0 items-center gap-2 overflow-x-auto"
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
                  ? ({
                      focusgroupstart: "",
                    } as React.ButtonHTMLAttributes<HTMLButtonElement>)
                  : {})}
                onClick={() => setActiveTab(tab.key)}
                onKeyDown={(e) => handleTabKeyDown(e, idx)}
                className={`inline-flex flex-none items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                  isSelected
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200/80 hover:text-slate-900"
                }`}
              >
                <FileSpreadsheet
                  className={`h-4 w-4 shrink-0 ${
                    isSelected ? "text-slate-200" : "text-slate-500"
                  }`}
                  aria-hidden="true"
                />
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 font-mono text-xs tabular-nums ${
                    isSelected
                      ? "bg-slate-800 text-slate-100"
                      : "bg-white text-slate-700"
                  }`}
                >
                  {rowCount}
                </span>
              </button>
            );
          })}
        </div>

        {/* Single Download Control (Menu with per-table and zip) */}
        <div className="relative">
          <button
            ref={menuTriggerRef}
            id={downloadTriggerId}
            type="button"
            aria-haspopup="menu"
            aria-expanded={downloadMenuOpen}
            aria-controls={downloadMenuId}
            onClick={() => setDownloadMenuOpen((prev) => !prev)}
            onKeyDown={handleMenuTriggerKeyDown}
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-900 shadow-2xs transition-colors hover:bg-slate-50 aria-expanded:border-slate-900 aria-expanded:bg-slate-100"
          >
            <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Download</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          </button>

          {downloadMenuOpen && (
            <div
              ref={menuContainerRef}
              id={downloadMenuId}
              role="menu"
              aria-labelledby={downloadTriggerId}
              {...({
                focusgroup: "menu nomemory",
              } as React.HTMLAttributes<HTMLDivElement>)}
              onKeyDown={handleMenuKeyDown}
              className="absolute right-0 z-30 mt-2 w-64 rounded-lg border border-slate-200 bg-white p-2 shadow-lg"
            >
              <a
                ref={(el) => {
                  menuItemRefs.current[0] = el;
                }}
                role="menuitem"
                href={csvZipUrl(sessionId)}
                download={`reconcore_${sessionId}_csvs.zip`}
                onClick={() => setDownloadMenuOpen(false)}
                className="flex items-center justify-between gap-2 rounded-md px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100 focus:bg-slate-100"
              >
                <span className="inline-flex items-center gap-2">
                  <Archive
                    className="h-4 w-4 shrink-0 text-slate-700"
                    aria-hidden="true"
                  />
                  <span>All tables (.zip)</span>
                </span>
                <span className="font-mono text-[11px] text-slate-500">
                  ZIP
                </span>
              </a>

              <hr className="my-1 border-slate-200" />

              {TAB_CONFIG.map((tab, idx) => (
                <a
                  key={tab.key}
                  ref={(el) => {
                    menuItemRefs.current[idx + 1] = el;
                  }}
                  role="menuitem"
                  href={csvTableUrl(sessionId, tab.key)}
                  download={tables[tab.key].filename}
                  onClick={() => setDownloadMenuOpen(false)}
                  className="flex items-center justify-between gap-2 rounded-md px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 focus:bg-slate-100"
                >
                  <span className="inline-flex items-center gap-2">
                    <FileSpreadsheet
                      className="h-3.5 w-3.5 shrink-0 text-slate-500"
                      aria-hidden="true"
                    />
                    <span className="font-mono">{tables[tab.key].filename}</span>
                  </span>
                  <span className="text-[11px] text-slate-400">CSV</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sub-bar: Search Box + Row Count */}
      <div className="flex flex-wrap items-center justify-between gap-4">
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
            className="w-full rounded-md border border-slate-300 bg-slate-50/70 py-2 pr-8 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-800 focus:bg-white"
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

        <div className="flex items-center gap-4 text-xs text-slate-600">
          <span className="font-mono tabular-nums" aria-live="polite">
            Showing{" "}
            <strong className="font-semibold text-slate-900">
              {filteredRows.length}
            </strong>{" "}
            of{" "}
            <strong className="font-semibold text-slate-900">
              {currentTable.rows.length}
            </strong>{" "}
            rows ·{" "}
            <strong className="font-semibold text-slate-900">
              {currentTable.columns.length}
            </strong>{" "}
            columns
          </span>
        </div>
      </div>

      {/* Tabpanel containing the scrollable CSV table (no hidden columns, sticky first column, visible horizontal scroll, 14px minimum table text) */}
      <div
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${activeTab}`}
        className="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-slate-200"
      >
        <div
          tabIndex={0}
          role="region"
          aria-labelledby={captionId}
          className="table-wrapper min-h-0 flex-1"
        >
          <table className="min-w-max w-full border-separate border-spacing-0 text-left text-sm text-slate-800">
            <caption id={captionId} className="visually-hidden">
              {currentTable.filename} — Raw unformatted source records (
              {filteredRows.length} rows displayed, all{" "}
              {currentTable.columns.length} columns visible)
            </caption>
            <thead className="sticky top-0 z-20 bg-slate-100 text-sm font-bold text-slate-800">
              <tr>
                {currentTable.columns.map((col, colIdx) => (
                  <th
                    key={col}
                    scope="col"
                    className={`border-b border-slate-300 bg-slate-100 px-4 py-3 font-mono text-sm whitespace-nowrap ${
                      colIdx === 0
                        ? "sticky left-0 z-30 border-r border-slate-300 bg-slate-100 text-left shadow-[2px_0_4px_-2px_rgba(15,23,42,0.12)]"
                        : NUMERIC_ALIGN_COLUMNS.has(col)
                          ? "text-right"
                          : "text-left"
                    }`}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 text-sm">
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={currentTable.columns.length}
                    className="px-6 py-12 text-center text-sm text-slate-600"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Inbox
                        className="h-6 w-6 text-slate-400"
                        aria-hidden="true"
                      />
                      <p className="font-semibold text-slate-800">
                        No matching rows found
                      </p>
                      <p className="text-sm text-slate-500">
                        No rows in{" "}
                        <code className="font-mono font-semibold">
                          {currentTable.filename}
                        </code>{" "}
                        match &ldquo;{searchQuery}&rdquo;.
                      </p>
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery("")}
                          className="mt-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Clear filter
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, rowIdx) => {
                  const rowId = row[0] ?? `row-${rowIdx}`;
                  const isEven = rowIdx % 2 === 1;
                  return (
                    <tr
                      key={`${rowId}-${rowIdx}`}
                      className={`group transition-colors hover:bg-amber-50/70 ${
                        isEven ? "bg-slate-50" : "bg-white"
                      }`}
                    >
                      {row.map((cell, cellIdx) => {
                        const colName = currentTable.columns[cellIdx] ?? "";
                        const isMono = MONOSPACE_COLUMNS.has(colName);
                        const isNumeric = NUMERIC_ALIGN_COLUMNS.has(colName);

                        // First column is the sticky row header (tx_id, wb_id, bank_ref)
                        if (cellIdx === 0) {
                          return (
                            <th
                              key={`${colName}-${cellIdx}`}
                              scope="row"
                              className={`sticky left-0 z-10 border-r border-b border-slate-200 px-4 py-3 font-mono text-sm font-semibold whitespace-pre tabular-nums text-slate-900 shadow-[2px_0_4px_-2px_rgba(15,23,42,0.08)] group-hover:bg-amber-50 ${
                                isEven ? "bg-slate-50" : "bg-white"
                              }`}
                            >
                              {cell}
                            </th>
                          );
                        }

                        return (
                          <td
                            key={`${colName}-${cellIdx}`}
                            className={`border-b border-slate-200/70 px-4 py-3 text-sm whitespace-pre ${
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
