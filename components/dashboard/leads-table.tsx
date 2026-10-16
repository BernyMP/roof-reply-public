"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { ConversationThread } from "./conversation-thread";
import { LeadSummary } from "./lead-summary";
import { cn } from "@/lib/utils";
import {
  leadFilters,
  leadStatusLabels,
  matchesLeadFilter,
  maskedLeadPhone,
  parseLeadView,
  leadViewUrl,
  type LeadStatus,
  type LeadFilter,
} from "@/lib/lead-presentation";

const PAGE_SIZE = 8;
function leadName(lead: Doc<"leads">) {
  return lead.name || maskedLeadPhone(lead.phoneNumber);
}
function dateLabel(time: number) {
  return new Date(time).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
export function LeadsTable() {
  const { user } = useUser();
  const router = useRouter();
  const params = useSearchParams();
  const view = parseLeadView(params);
  const leads = useQuery(
    api.leads.getLeads,
    user ? { clerkId: user.id } : "skip",
  );
  const filtered = (leads || []).filter((lead) =>
    matchesLeadFilter(lead.status, view.filter),
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(view.page, pageCount);
  const pageLeads = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selected = leads?.find((lead) => lead._id === view.lead);
  const previousSelection = useRef<string | null>(null);
  useEffect(() => {
    if (!view.lead && previousSelection.current) {
      document.getElementById("lead-row-" + previousSelection.current)?.focus();
    }
    previousSelection.current = view.lead;
  }, [view.lead]);
  function navigate(filter: LeadFilter, page: number, lead?: string | null) {
    router.push(leadViewUrl({ filter, page, lead }), { scroll: false });
  }
  if (leads === undefined)
    return (
      <p role="status" className="p-6 text-muted-foreground">
        Loading leads…
      </p>
    );
  return (
    <div className="rr-app-card overflow-hidden">
      <div
        className={cn(
          "flex flex-wrap gap-2 border-b p-3",
          view.lead && "hidden md:flex",
        )}
        aria-label="Lead filters"
      >
        {leadFilters.map(([filter, label]) => (
          <Button
            key={filter}
            variant={view.filter === filter ? "secondary" : "ghost"}
            aria-pressed={view.filter === filter}
            onClick={() => navigate(filter, 1)}
          >
            {label}
          </Button>
        ))}
      </div>
      <div className="grid min-h-[560px] md:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]">
        <div
          className={cn("min-w-0 md:border-r", view.lead && "hidden md:block")}
        >
          {pageLeads.length ? (
            <ul className="divide-y" aria-label="Leads">
              {pageLeads.map((lead) => (
                <li key={lead._id}>
                  <button
                    id={"lead-row-" + lead._id}
                    onClick={() => navigate(view.filter, page, lead._id)}
                    aria-current={
                      selected?._id === lead._id ? "true" : undefined
                    }
                    className={cn(
                      "block w-full space-y-2 p-4 text-left hover:bg-muted/60",
                      selected?._id === lead._id &&
                        "bg-orange-50 hover:bg-orange-50",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium">{leadName(lead)}</span>
                      {lead.sampleKey && (
                        <span className="rr-label">Sample</span>
                      )}
                      {lead.urgency === "high" && (
                        <span className="rounded bg-orange-100 px-2 py-1 text-xs font-medium text-orange-950">
                          Urgent
                        </span>
                      )}
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      {lead.jobType || "Details pending"} ·{" "}
                      {lead.location || "Location not shared"}
                    </p>
                    <p className="text-xs font-medium">
                      {leadStatusLabels[lead.status]}
                    </p>
                    <time
                      className="block text-xs text-muted-foreground"
                      dateTime={new Date(lead.createdAt).toISOString()}
                    >
                      {dateLabel(lead.createdAt)}
                    </time>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-6">
              <p className="font-medium">
                {leads.length ? "No leads match this filter" : "No leads yet"}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {leads.length
                  ? "Choose another filter to see your inquiries."
                  : "Customer conversations will appear here when they contact your configured line."}
              </p>
            </div>
          )}
          <div className="flex items-center justify-between gap-2 border-t p-3">
            <Button
              variant="ghost"
              size="sm"
              disabled={page === 1}
              onClick={() => navigate(view.filter, page - 1)}
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              {page} / {pageCount}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={page === pageCount}
              onClick={() => navigate(view.filter, page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
        <div className={cn("min-w-0", !view.lead && "hidden md:block")}>
          {selected ? (
            <LeadDetail
              key={selected._id}
              lead={selected}
              onBack={() => navigate(view.filter, page)}
            />
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {view.lead ? (
                <>
                  <p>This lead is unavailable.</p>
                  <Button
                    className="mt-4"
                    variant="outline"
                    onClick={() => navigate(view.filter, page)}
                  >
                    Back to leads
                  </Button>
                </>
              ) : (
                "Choose a lead to see the details and next step."
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
function LeadDetail({
  lead,
  onBack,
}: {
  lead: Doc<"leads">;
  onBack: () => void;
}) {
  const { user } = useUser();
  const detail = useQuery(api.leads.getLeadWithMessagesForViewer, {
    leadId: lead._id,
  });
  const updateStatus = useMutation(api.leads.updateLeadStatusForViewer);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);
  async function saveStatus(status: LeadStatus) {
    if (!user || saving) return;
    setSaving(true);
    setResult("");
    try {
      await updateStatus({ clerkId: user.id, leadId: lead._id, status });
      setResult("Status saved.");
    } catch {
      setResult("Could not update status. Please try again.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <section aria-label="Selected lead">
      <div className="space-y-4 border-b p-5">
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← Back to leads
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              ref={heading}
              tabIndex={-1}
              className="text-xl font-semibold outline-none"
            >
              {leadName(lead)}
            </h2>
            {lead.sampleKey && <span className="rr-label ml-3">Sample</span>}
          </div>
          <div>
            <label
              htmlFor="lead-status"
              className="mb-1 block text-xs text-muted-foreground"
            >
              Lead status
            </label>
            <select
              id="lead-status"
              value={lead.status}
              disabled={saving}
              onChange={(e) => void saveStatus(e.target.value as LeadStatus)}
              className="h-10 max-w-full rounded-lg border bg-background px-3 text-sm"
            >
              {Object.entries(leadStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {result && (
          <p role="status" className="text-sm">
            {result}
          </p>
        )}
        <LeadSummary lead={lead} />
        {(lead.handoffReason || lead.bookingUrlSent) && (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">
              Follow-up details
            </summary>
            {lead.handoffReason && <p className="mt-2">{lead.handoffReason}</p>}
            {lead.bookingUrlSent && (
              <p className="mt-2">
                <a
                  className="underline"
                  href={lead.bookingUrlSent}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open shared booking link
                </a>{" "}
                · A link is not a confirmed appointment.
              </p>
            )}
          </details>
        )}
      </div>
      <details className="group">
        <summary className="cursor-pointer p-5 text-sm font-semibold">
          View full conversation
          {detail ? ` · ${detail.messages.length} messages` : ""}
        </summary>
        <div className="flex h-[480px] flex-col border-t">
          <ConversationThread
            key={lead._id}
            messages={detail?.messages || []}
            customerName={leadName(lead)}
            businessName="Roofing team"
            emptyText={
              detail === undefined
                ? "Loading conversation…"
                : "No messages yet."
            }
          />
        </div>
      </details>
    </section>
  );
}
