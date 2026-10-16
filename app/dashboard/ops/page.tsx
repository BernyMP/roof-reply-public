"use client";
import { accountPresentation } from "@/lib/account-presentation";
import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useAction, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DashboardLoading } from "@/components/dashboard/dashboard-loading";
import { ConciergeQueue } from "@/components/dashboard/concierge-queue";
import type { Doc, Id } from "@/convex/_generated/dataModel";

function AccountControls({
  account: a,
}: {
  account: Doc<"onboarding"> & { blockers: string[] };
}) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    phoneNumber: a.telnyxPhoneNumber || "",
    phoneNumberId: a.telnyxPhoneNumberId || "",
    profileId: a.messagingProfileId || "",
    voiceId: a.voiceApplicationId || "",
    campaignId: a.campaignId || "",
    providerEvidence: a.providerEvidence || "",
    forwardingEvidence: a.forwardingEvidence || "",
    rehearsalEvidence: a.rehearsalEvidence || "",
    approved: a.campaignStatus === "approved",
    isDemoAccount: a.isDemoAccount || false,
    keywordHandling:
      a.keywordHandling || ("telnyx" as "telnyx" | "application"),
  });
  const verify = useAction(api.providerActions.verifyAssignment),
    save = useMutation(api.pilot.saveEvidence),
    activate = useMutation(api.pilot.activate),
    seed = useMutation(api.pilot.seedDemo);
  async function perform(operation: () => Promise<unknown>, message: string) {
    setBusy(true);
    setStatus("");
    try {
      await operation();
      setStatus(message);
    } catch (e) {
      setStatus(
        e instanceof ConvexError && typeof e.data === "string"
          ? e.data
          : e instanceof Error
            ? e.message
            : "Operation failed",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="rr-app-card space-y-5 p-6">
      <div>
        <h2 className="text-xl font-semibold">
          {a.legalBusinessName || "New roofing account"}
        </h2>
        <p className="mt-1 text-sm">
          {accountPresentation(a).label} · {a.telnyxPhoneNumber || "No number"}{" "}
          · {a.provisioningStatus || "Unverified routing"}
        </p>
      </div>
      <details className="rounded-lg border p-4">
        <summary className="cursor-pointer font-medium text-sm">
          Provider configuration and evidence
        </summary>
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["Phone number", "phoneNumber"],
                ["Telnyx number ID", "phoneNumberId"],
                ["Messaging profile ID", "profileId"],
                ["Voice application ID", "voiceId"],
              ] as const
            ).map(([label, key]) => (
              <div key={key}>
                <Label htmlFor={`${a._id}-${key}`}>{label}</Label>
                <Input
                  id={`${a._id}-${key}`}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <Button
            disabled={busy}
            onClick={() =>
              perform(
                () =>
                  verify({
                    clerkId: a.clerkId,
                    phoneNumber: form.phoneNumber,
                    phoneNumberId: form.phoneNumberId,
                    profileId: form.profileId,
                    voiceId: form.voiceId,
                  }),
                "Number and routing verified. Save approval evidence next.",
              )
            }
          >
            Verify and assign existing number
          </Button>
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["Campaign ID", "campaignId"],
                ["Provider approval evidence / reference", "providerEvidence"],
                ["Conditional forwarding verification", "forwardingEvidence"],
                [
                  "Three rehearsal results / message references",
                  "rehearsalEvidence",
                ],
              ] as const
            ).map(([label, key]) => (
              <div key={key}>
                <Label htmlFor={`${a._id}-${key}`}>{label}</Label>
                <Input
                  id={`${a._id}-${key}`}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-5 text-sm">
            <label>
              <input
                type="checkbox"
                checked={form.approved}
                onChange={(e) =>
                  setForm({ ...form, approved: e.target.checked })
                }
              />{" "}
              Provider brand and campaign approved
            </label>
            <label>
              <input
                type="checkbox"
                checked={form.isDemoAccount}
                onChange={(e) =>
                  setForm({ ...form, isDemoAccount: e.target.checked })
                }
              />{" "}
              Designated sample/demo account
            </label>
          </div>
          <label className="block text-sm">
            Verified keyword responder{" "}
            <select
              className="ml-3 rounded border p-2"
              value={form.keywordHandling}
              onChange={(e) =>
                setForm({
                  ...form,
                  keywordHandling: e.target.value as "telnyx" | "application",
                })
              }
            >
              <option value="telnyx">Telnyx auto-responses</option>
              <option value="application">RoofReply responses</option>
            </select>
          </label>
          <Button
            disabled={busy}
            onClick={() =>
              perform(
                () =>
                  save({
                    clerkId: a.clerkId,
                    campaignId: form.campaignId,
                    providerEvidence: form.providerEvidence,
                    forwardingEvidence: form.forwardingEvidence,
                    rehearsalEvidence: form.rehearsalEvidence,
                    approved: form.approved,
                    isDemoAccount: form.isDemoAccount,
                    keywordHandling: form.keywordHandling,
                  }),
                "Evidence saved. Account paused for activation review.",
              )
            }
          >
            Save evidence
          </Button>
        </div>
      </details>
      <h3 className="text-base font-semibold">Activation</h3>
      <div className="rounded-lg border p-4 text-sm">
        <p className="font-semibold">Live readiness</p>
        {a.blockers.length ? (
          <ul className="mt-2 list-disc pl-5">
            {a.blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        ) : (
          <p>
            Setup evidence is complete. Live activation also checks delivered
            messages.
          </p>
        )}
        <p className="mt-2">
          Rehearsal mode sends only to the account's consented owner phone.
          Customer setting changes pause automation for review.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        {(
          [
            ["Pause", "paused"],
            ["Enable rehearsal", "rehearsal"],
            ["Activate live", "live"],
          ] as const
        ).map(([label, mode]) => (
          <Button
            key={mode}
            variant={mode === "paused" ? "outline" : "default"}
            disabled={busy}
            onClick={() =>
              perform(
                () => activate({ clerkId: a.clerkId, mode }),
                `Account ${mode}.`,
              )
            }
          >
            {label}
          </Button>
        ))}
        <Button
          variant="outline"
          disabled={busy || !a.isDemoAccount}
          onClick={() =>
            perform(
              () => seed({ clerkId: a.clerkId }),
              "Four sample scenarios refreshed. No messages sent.",
            )
          }
        >
          Refresh four sample leads
        </Button>
      </div>
      <QuotaControls clerkId={a.clerkId} />
      {status && (
        <p role="status" className="rounded border p-3 text-sm">
          {status}
        </p>
      )}
    </section>
  );
}
function QuotaControls({ clerkId }: { clerkId: string }) {
  const quotas = useQuery(api.usageControl.getQuotaSettings, { clerkId });
  const update = useMutation(api.usageControl.updateQuotas);
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  if (!quotas) return null;
  const fields = [
    ["Daily SMS", "dailySmsLimit"],
    ["Monthly SMS", "monthlySmslimit"],
    ["Daily AI calls", "dailyAiLimit"],
    ["Monthly AI calls", "monthlyAiLimit"],
    ["Daily leads", "dailyLeadLimit"],
    ["Monthly leads", "monthlyLeadLimit"],
  ] as const;
  return (
    <details className="rounded border p-4">
      <summary className="cursor-pointer">Usage limits</summary>
      <form
        className="mt-4 space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          setBusy(true);
          try {
            await update({
              clerkId,
              ...Object.fromEntries(
                fields.map(([, key]) => [key, Number(data.get(key))]),
              ),
            });
            setResult("Usage limits saved.");
          } catch (e) {
            setResult(e instanceof Error ? e.message : "Could not save limits");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {fields.map(([label, key]) => (
            <label key={key} className="text-sm">
              {label}
              <Input
                type="number"
                name={key}
                min={0}
                step={1}
                required
                defaultValue={quotas[key]}
              />
            </label>
          ))}
        </div>
        <Button disabled={busy}>Save usage limits</Button>
        {result && <p role="status">{result}</p>}
      </form>
    </details>
  );
}
function MessageReview({
  message: m,
}: {
  message: {
    _id: Id<"outboundMessages">;
    providerId?: string;
    state: string;
    error?: string;
  };
}) {
  const reconcile = useAction(api.providerActions.reconcileMessage);
  const [providerId, setProviderId] = useState(m.providerId || "");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-4 space-y-2 rounded border p-3">
      <p className="break-all text-sm">
        {m.state}: {m._id} — {m.error || "Delivery confirmation pending"}
      </p>
      <div className="flex flex-wrap gap-2">
        <Input
          aria-label="Provider message ID for reconciliation"
          placeholder="Verified Telnyx message ID"
          value={providerId}
          onChange={(e) => setProviderId(e.target.value)}
        />
        <Button
          disabled={busy || !providerId}
          onClick={async () => {
            setBusy(true);
            try {
              await reconcile({ id: m._id, providerId });
              setResult("Provider evidence checked.");
            } catch (e) {
              setResult(e instanceof Error ? e.message : "Verification failed");
            } finally {
              setBusy(false);
            }
          }}
        >
          Check delivery
        </Button>
      </div>
      {result && <p role="status">{result}</p>}
    </div>
  );
}
function RetryEvent({ id }: { id: Id<"automationEvents"> }) {
  const retry = useMutation(api.automation.retryEvent);
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <span className="ml-3">
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await retry({ id });
            setResult("Retry queued");
          } catch (e) {
            setResult(e instanceof Error ? e.message : "Retry failed");
          } finally {
            setBusy(false);
          }
        }}
      >
        Retry failed work
      </Button>
      {result && <span role="status"> {result}</span>}
    </span>
  );
}
export default function OpsPage() {
  const { user, isLoaded } = useUser();
  const allowed = useQuery(api.users.hasOpsAccess, user ? {} : "skip");
  const accounts = useQuery(api.pilot.accounts, allowed ? {} : "skip"),
    failures = useQuery(api.automation.failures, allowed ? {} : "skip");
  if (!isLoaded || allowed === undefined)
    return <DashboardLoading label="Loading operator controls" />;
  if (!allowed)
    return (
      <div className="rr-app-page p-8">
        <h1>Operator access required</h1>
        <p>Your account needs operator access to manage activation.</p>
      </div>
    );
  return (
    <div className="rr-app-page">
      <div className="rr-app-wrap max-w-6xl space-y-6">
        <header>
          <h1 className="text-3xl font-semibold">Operator tools</h1>
          <p className="mt-2">
            Verify each account, rehearse the flow, then enable live messaging.
          </p>
        </header>
        <ConciergeQueue />
        <h2 className="text-lg font-semibold">Accounts</h2>
        {accounts === undefined && <p role="status">Loading accounts…</p>}
        {accounts?.map((a) => (
          <AccountControls key={a._id} account={a} />
        ))}
        <section className="rr-app-card p-6">
          <h2 className="text-xl font-semibold">Delivery issues</h2>
          <p className="mt-2 text-sm">
            Reconcile uncertain submissions in Telnyx before sending again.
            Provider acceptance is not proof of delivery.
          </p>
          {failures?.events.map((e) => (
            <p key={e._id} className="mt-3 break-words text-sm">
              Event {e._id}: {e.error || "Processing failed"}
              <RetryEvent id={e._id} />
            </p>
          ))}
          {failures?.messages.map((m) => (
            <MessageReview key={m._id} message={m} />
          ))}
          {failures?.pending.map((m) => (
            <MessageReview key={m._id} message={m} />
          ))}
          {failures?.stalled.map((e) => (
            <p key={e._id}>
              Stalled {e.status} event: {e._id}
            </p>
          ))}
          {failures &&
            !failures.events.length &&
            !failures.messages.length &&
            !failures.pending.length &&
            !failures.stalled.length && (
              <p className="mt-3">No failed or uncertain messages.</p>
            )}
        </section>
      </div>
    </div>
  );
}
