import { Phone, ArrowUpRight } from "lucide-react";
import { leadNextStep, type LeadStatus } from "@/lib/lead-presentation";
import { formatPhoneNumber } from "@/lib/format-phone";

export function LeadSummary({
  lead,
}: {
  lead: {
    status: LeadStatus;
    urgency?: "low" | "medium" | "high";
    phoneNumber: string;
    sampleKey?: string;
    summary?: string;
    jobType?: string;
    location?: string;
  };
}) {
  const next = leadNextStep(lead);
  return (
    <div className="space-y-5">
      <div className="rr-next-action">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#87300d]">
          Next step
        </p>
        <h3 className="mt-2 font-semibold">{next.title}</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {next.detail}
        </p>
        {!lead.sampleKey && lead.status !== "not_qualified" && (
          <a
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
            href={`tel:${lead.phoneNumber}`}
          >
            <Phone size={16} aria-hidden="true" />
            Call homeowner
            <ArrowUpRight size={14} aria-hidden="true" />
          </a>
        )}
        {lead.sampleKey && (
          <p className="mt-3 text-xs text-muted-foreground">
            Sample inquiry · no customer to contact
          </p>
        )}
      </div>
      <div>
        <h3 className="text-sm font-semibold">What the homeowner needs</h3>
        <p className="mt-2 break-words text-sm leading-6">
          {lead.summary || "Details will appear as the conversation continues."}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-4 rounded-lg border p-4 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Roofing issue</dt>
          <dd className="mt-1">{lead.jobType || "Not shared yet"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Location</dt>
          <dd className="mt-1">{lead.location || "Not shared yet"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Urgency</dt>
          <dd className="mt-1">
            {lead.urgency === "high"
              ? "High · review promptly"
              : lead.urgency === "medium"
                ? "Medium"
                : lead.urgency === "low"
                  ? "Low"
                  : "Not established yet"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Callback number</dt>
          <dd className="mt-1">{formatPhoneNumber(lead.phoneNumber)}</dd>
        </div>
      </dl>
    </div>
  );
}
