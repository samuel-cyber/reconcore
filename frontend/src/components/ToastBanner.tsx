"use client";

import React from "react";
import { AlertCircle, Info, X } from "lucide-react";
import { useSession } from "@/lib/session-context";

export default function ToastBanner() {
  const { toast, dismissToast } = useSession();

  if (!toast) return null;

  const isError = toast.type === "error";

  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      className="fixed top-4 right-4 z-50 flex max-w-md items-start gap-3 rounded-lg border px-4 py-3 shadow-lg transition-all"
      style={{
        backgroundColor: isError ? "#fef2f2" : "#f8fafc",
        borderColor: isError ? "#dc2626" : "#334155",
        color: isError ? "#7f1d1d" : "#0f172a",
      }}
    >
      {isError ? (
        <AlertCircle
          className="mt-0.5 h-4 w-4 shrink-0 text-red-700"
          aria-hidden="true"
        />
      ) : (
        <Info
          className="mt-0.5 h-4 w-4 shrink-0 text-slate-700"
          aria-hidden="true"
        />
      )}
      <div className="min-w-0 flex-1 text-xs leading-relaxed">
        {toast.code && (
          <div className="font-mono text-[10px] font-bold uppercase opacity-75">
            {toast.code}
          </div>
        )}
        <div className="font-medium">{toast.message}</div>
      </div>
      <button
        type="button"
        onClick={dismissToast}
        aria-label="Dismiss notification"
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded opacity-70 hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

