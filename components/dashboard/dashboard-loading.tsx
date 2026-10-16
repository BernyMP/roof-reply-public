"use client";

import { Loader2 } from "lucide-react";

type DashboardLoadingProps = {
  label?: string;
};

export function DashboardLoading({
  label = "Loading dashboard",
}: DashboardLoadingProps) {
  return (
    <div className="rr-app-page">
      <div className="rr-app-wrap max-w-5xl space-y-5">
        <section className="rr-app-card p-5 sm:p-6">
          <div className="flex items-center gap-3 text-[var(--rr-app-muted)]">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            <p className="text-sm font-medium">{label}</p>
          </div>
          <div className="mt-5 space-y-3">
            <div className="h-3 w-32 rounded-full bg-[var(--rr-app-surface-2)]" />
            <div className="h-7 w-64 max-w-full rounded-full bg-[var(--rr-app-surface-2)]" />
            <div className="h-3 w-full max-w-xl rounded-full bg-[var(--rr-app-surface-2)]" />
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-3">
          {["first", "second", "third"].map((item) => (
            <div
              key={item}
              className="rr-app-card min-h-32 animate-pulse p-5"
              aria-hidden="true"
            >
              <div className="h-3 w-20 rounded-full bg-[var(--rr-app-surface-2)]" />
              <div className="mt-5 h-6 w-28 rounded-full bg-[var(--rr-app-surface-2)]" />
              <div className="mt-3 h-3 w-full rounded-full bg-[var(--rr-app-surface-2)]" />
              <div className="mt-2 h-3 w-2/3 rounded-full bg-[var(--rr-app-surface-2)]" />
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
