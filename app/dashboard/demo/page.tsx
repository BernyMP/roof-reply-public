"use client";
import { EventDemoStatus } from "@/components/dashboard/event-demo-status";
import { useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { RotateCcw, ArrowUpRight, Check, Loader2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConversationThread } from "@/components/dashboard/conversation-thread";
import { DashboardLoading } from "@/components/dashboard/dashboard-loading";
import { formatPhoneNumber } from "@/lib/format-phone";

export default function DemoPage() {
  const { user } = useUser();
  const account = useQuery(
    api.onboarding.getOnboarding,
    user ? { clerkId: user.id } : "skip",
  );
  const ops = useQuery(api.users.hasOpsAccess, user ? {} : "skip");
  const [name, setName] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const businessName =
    name ?? account?.legalBusinessName?.replace(/\s*[—-]\s*demo$/i, "") ?? "";
  const recipient = phone ?? account?.bookingDeliveryPhone ?? "";
  const data = useQuery(
    api.demoSessions.inspect,
    user && account?.isDemoAccount && ops
      ? { clerkId: user.id, recipient }
      : "skip",
  );
  const reset = useMutation(api.demoSessions.reset);
  const session = data?.session;
  const lead = data?.lead;
  const eligible = Boolean(
    account?.activationMode &&
    account.activationMode !== "paused" &&
    data?.consentReady,
  );
  const resetting = session?.state === "resetting";
  async function start() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/demo-sms/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName,
          recipient,
          bookingEnabled: booking,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Could not start the test.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the test.");
    } finally {
      setBusy(false);
    }
  }
  async function startOver() {
    if (!session || busy) return;
    setBusy(true);
    setError(null);
    try {
      await reset({ sessionId: session._id });
    } catch (e) {
      setError(
        e instanceof ConvexError && typeof e.data === "string"
          ? e.data
          : "Could not reset the test.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (
    !user ||
    account === undefined ||
    ops === undefined ||
    (ops && account?.isDemoAccount && data === undefined && phone === null)
  )
    return <DashboardLoading label="Loading demo" />;
  if (!ops || !account?.isDemoAccount)
    return (
      <div className="rr-app-page">
        <div className="rr-app-wrap max-w-3xl">
          <h1 className="text-2xl font-semibold">
            Try your customer experience
          </h1>
          <p className="mt-3 text-slate-600">
            Your RoofReply operator will guide you through a live text demo.
          </p>
        </div>
      </div>
    );
  return (
    <div className="rr-app-page">
      <div className="rr-app-wrap max-w-6xl space-y-6">
        <header>
          <p className="text-sm font-medium text-orange-800">Live SMS demo</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
            Be your next customer.
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
            Reply from your phone as a homeowner. See what your team receives
            here.
          </p>
        </header>
        <EventDemoStatus onSelect={setPhone} />
        <section
          className="rounded-2xl border border-slate-200 bg-[var(--rr-app-surface)] p-5 sm:p-6"
          aria-label="Test setup"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void start();
            }}
            className="flex flex-col gap-4 sm:flex-row sm:items-end"
          >
            <div className="flex-1 space-y-2">
              <Label htmlFor="demo-business">Business name</Label>
              <Input
                id="demo-business"
                value={session?.businessName ?? businessName}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                disabled={Boolean(session) || busy}
                placeholder="Your roofing company"
                className="rr-app-field h-11 text-slate-900"
                required
              />
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="demo-phone">Test phone</Label>
              <Input
                id="demo-phone"
                type="tel"
                value={recipient}
                onChange={(e) =>
                  setPhone(e.target.value.replace(/[\s()-]/g, ""))
                }
                disabled={busy || Boolean(session)}
                placeholder="+1 555 555 0123"
                className="rr-app-field h-11 text-slate-900"
                required
              />
            </div>
            {session ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => void startOver()}
                disabled={busy || resetting}
                className="h-11"
              >
                <RotateCcw className="mr-2 size-4" />
                {resetting ? "Finishing previous test…" : "Start over"}
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={
                  busy ||
                  !eligible ||
                  !businessName.trim() ||
                  data === undefined
                }
                className="h-11 bg-primary px-6 text-[#ffffff] hover:bg-primary/90"
              >
                {busy && <Loader2 className="mr-2 size-4 animate-spin" />}Start
                test
              </Button>
            )}
          </form>
          {!session && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
              <span>
                {data?.consentReady ? (
                  <>
                    <Check className="mr-1 inline size-3.5" />
                    SMS consent recorded
                  </>
                ) : (
                  <>
                    The tester must{" "}
                    <a
                      className="underline"
                      href="https://www.roofreply.com/demo-sms"
                      target="_blank"
                      rel="noreferrer"
                    >
                      record demo SMS consent
                    </a>{" "}
                    before starting.
                  </>
                )}
              </span>
              {account.bookingLink && (
                <details>
                  <summary className="cursor-pointer">Booking option</summary>
                  <label className="mt-2 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={booking}
                      onChange={(e) => setBooking(e.target.checked)}
                    />
                    Include the configured demo booking link
                  </label>
                </details>
              )}
            </div>
          )}
          {account.activationMode === "paused" && (
            <p className="mt-3 text-sm text-amber-800">
              Testing is paused.{" "}
              <Link href="/dashboard/ops" className="underline">
                Open operator settings
              </Link>{" "}
              to enable rehearsal.
            </p>
          )}
          {resetting && (
            <p role="status" className="mt-3 text-sm text-amber-800">
              Waiting for a pending text to finish. If delivery needs review,
              resolve it in{" "}
              <Link href="/dashboard/ops" className="underline">
                operator settings
              </Link>{" "}
              before starting again.
            </p>
          )}
          {error && (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {error}
            </p>
          )}
        </section>
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="flex h-[min(640px,75vh)] min-h-96 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-[var(--rr-app-surface)]">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="font-semibold text-slate-900">
                Customer conversation
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {session
                  ? `${session.businessName} · ${formatPhoneNumber(session.sender)}`
                  : "Your text exchange will appear here"}
              </p>
            </div>
            <ConversationThread
              messages={data?.messages ?? []}
              businessName={session?.businessName || businessName || "Business"}
              emptyText={
                resetting
                  ? "Clearing this test. Pending delivery records are being retained."
                  : "Start a test, then reply on your phone about a roofing problem."
              }
            />
            <p className="border-t border-slate-100 px-6 py-3 text-xs text-slate-500">
              Reply in your phone’s Messages app. Starting over clears this
              view, not texts on your phone.
            </p>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-[var(--rr-app-surface)] p-6">
            <h2 className="font-semibold text-slate-900">
              What your team receives
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              A clear inquiry, ready for follow-up.
            </p>
            {lead &&
            (lead.summary ||
              lead.jobType ||
              lead.name ||
              lead.conversationEnded) ? (
              <div className="mt-6 space-y-5">
                {lead.conversationEnded && (
                  <p
                    className={`text-sm font-medium ${lead.urgency === "high" ? "text-red-700" : "text-orange-800"}`}
                  >
                    {lead.urgency === "high"
                      ? "Urgent · follow up now"
                      : lead.status === "needs_followup"
                        ? "Needs follow-up"
                        : "Ready for your review"}
                  </p>
                )}
                {lead.summary && (
                  <p className="text-sm leading-6 text-slate-800">
                    {lead.summary}
                  </p>
                )}
                <dl className="space-y-4 text-sm">
                  {[
                    ["Customer", lead.name || "Not shared yet"],
                    ["Roofing issue", lead.jobType || "Not shared yet"],
                    ["Property", lead.location || "Not shared yet"],
                    [
                      "Urgency",
                      lead.urgency === "high"
                        ? "Urgent"
                        : lead.urgency === "medium"
                          ? "Soon"
                          : lead.urgency === "low"
                            ? "Planning ahead"
                            : "Not clear yet",
                    ],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs text-slate-500">{label}</dt>
                      <dd className="mt-1 text-slate-900">{value}</dd>
                    </div>
                  ))}
                </dl>
                {lead.bookingUrlSent && (
                  <a
                    href={lead.bookingUrlSent}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-orange-800"
                  >
                    View booking link <ArrowUpRight className="size-4" />
                  </a>
                )}
              </div>
            ) : (
              <p className="mt-8 text-sm leading-6 text-slate-500">
                As you reply, the roofing issue and customer details will appear
                here.
              </p>
            )}
            <p className="mt-8 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
              Demo results stay here. Contractor alerts won’t interrupt the
              customer’s text conversation.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
