"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { readinessBlockers, type ReadyAccount } from "@/lib/automation-policy";
import { accountPresentation } from "@/lib/account-presentation";
import { formatPhoneNumber } from "@/lib/format-phone";
import { Button } from "@/components/ui/button";
export function PilotReadiness({ account }: { account: ReadyAccount }) {
  const deliveries = useQuery(api.pilot.deliveryForViewer, {});
  const blockers = readinessBlockers(account);
  const state = accountPresentation(account);
  const [copy, setCopy] = useState("");
  const checks = [
    {
      title: "Number routing",
      missing: "Number routing has not been verified",
      detail:
        "Your operator assigns the number and verifies its voice and messaging configuration.",
    },
    {
      title: "Carrier approval",
      missing: "Provider approval evidence is missing",
      detail:
        "Your operator records verified brand and campaign approval before activation.",
    },
    {
      title: "SMS keyword handling",
      missing: "STOP/START/HELP response handling has not been verified",
      detail: "Verify STOP, START, and HELP responses with your operator.",
    },
    {
      title: "Owner SMS permission",
      missing: "Owner SMS permission is missing or out of date",
      detail:
        "Review the alert phone and its SMS permission in Lead delivery settings.",
    },
    {
      title: "Missed-call forwarding",
      missing: "Conditional missed-call forwarding has not been verified",
      detail:
        "Ask your operator to verify conditional missed-call forwarding. Answered business calls must not trigger a text.",
    },
    {
      title: "Live rehearsal",
      missing: "Live rehearsal evidence is missing",
      detail:
        "Complete the live acceptance checks with your operator. Provider acceptance alone does not prove delivery.",
    },
  ];
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        <strong className="text-foreground">{state.label}</strong> ·{" "}
        {state.detail}
      </p>
      <section className="rr-app-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
          <div>
            <h2 className="font-semibold">Your intake number</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {account.telnyxPhoneNumber
                ? formatPhoneNumber(account.telnyxPhoneNumber)
                : "Your operator will assign a number."}
            </p>
          </div>
          {account.telnyxPhoneNumber && (
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    account.telnyxPhoneNumber!,
                  );
                  setCopy("Number copied.");
                } catch {
                  setCopy(
                    "Could not copy. Select the number to copy it manually.",
                  );
                }
              }}
            >
              Copy number
            </Button>
          )}
          {copy && (
            <p className="w-full text-sm" role="status">
              {copy}
            </p>
          )}
        </div>
        <ol className="divide-y">
          {checks.map((check, index) => {
            const complete = !blockers.includes(check.missing);
            return (
              <li key={check.title}>
                <details className="p-5" open={!complete}>
                  <summary className="cursor-pointer text-sm font-medium">
                    {index + 1}. {check.title}
                    <span className="ml-3 text-xs font-normal text-muted-foreground">
                      {complete ? "Verified" : "Needs attention"}
                    </span>
                  </summary>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                    {check.detail}
                  </p>
                  {index === 3 && (
                    <Link
                      className="rr-text-link mt-2 inline-block"
                      href="/dashboard/config#handoff"
                    >
                      Review SMS permission →
                    </Link>
                  )}
                </details>
              </li>
            );
          })}
        </ol>
        {blockers
          .filter((b) => !checks.some((c) => c.missing === b))
          .map((b) => (
            <p key={b} className="border-t p-5 text-sm text-amber-900">
              {b}
            </p>
          ))}
      </section>
      <div className="flex flex-wrap items-start justify-between gap-4 text-sm">
        <p className="max-w-lg text-muted-foreground">
          Your operator manages activation. Samples demonstrate the workflow;
          they do not establish live readiness.
        </p>
        <Link className="rr-text-link" href="/dashboard/demo">
          Open guided demo →
        </Link>
      </div>
      <details className="rr-app-card p-5">
        <summary className="cursor-pointer text-sm font-medium">
          Recent delivery results
        </summary>
        <div className="mt-4 space-y-3">
          {deliveries === undefined ? (
            <p>Loading delivery results…</p>
          ) : deliveries.length ? (
            deliveries.map((m) => (
              <div key={m._id} className="text-sm">
                <p>
                  {m.purpose.replaceAll("_", " ")} ·{" "}
                  {m.state === "accepted" ? "Awaiting delivery" : m.state}
                </p>
                {m.error && <p className="text-muted-foreground">{m.error}</p>}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No outbound delivery evidence yet.
            </p>
          )}
        </div>
      </details>
    </div>
  );
}
