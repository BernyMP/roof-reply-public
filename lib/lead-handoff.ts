export const LEAD_HANDOFF_MODES = [
  "review_first",
  "booking_link",
  "review_and_booking",
  "emergency_escalation",
] as const;

export type LeadHandoffMode = (typeof LEAD_HANDOFF_MODES)[number];

export type LeadHandoffStatus =
  | "qualified"
  | "needs_followup"
  | "booking_link_sent"
  | "needs_contractor_review";

export interface ResolveLeadHandoffInput {
  mode?: string | null;
  isQualified: boolean;
  urgency?: "low" | "medium" | "high" | null;
  bookingLink?: string | null;
  jobType?: string | null;
  autoBookingJobTypes?: string[] | null;
}

export interface LeadHandoffDecision {
  mode: LeadHandoffMode;
  shouldSendBookingLink: boolean;
  shouldNotifyContractor: boolean;
  status: LeadHandoffStatus;
  reason: string;
}

export const LEAD_HANDOFF_LABELS: Record<LeadHandoffMode, string> = {
  review_first: "Review first",
  booking_link: "Send Calendly link",
  review_and_booking: "Review + Calendly",
  emergency_escalation: "Emergency review first",
};

export function normalizeLeadHandoffMode(
  mode?: string | null
): LeadHandoffMode {
  return LEAD_HANDOFF_MODES.includes(mode as LeadHandoffMode)
    ? (mode as LeadHandoffMode)
    : "review_first";
}

function hasEligibleJobType(jobType?: string | null, allowed?: string[] | null) {
  if (!allowed || allowed.length === 0) return true;
  if (!jobType) return false;

  const normalizedJobType = jobType.toLowerCase();
  return allowed.some((allowedJob) => {
    const normalizedAllowed = allowedJob.replace(/_/g, " ").toLowerCase();
    const allowedTokens = normalizedAllowed
      .split(" ")
      .filter((token) => !["job", "jobs", "repair", "repairs"].includes(token));

    return (
      normalizedJobType.includes(normalizedAllowed) ||
      allowedTokens.every((token) =>
        normalizedJobType.includes(token.replace(/s$/, ""))
      )
    );
  });
}

export function resolveLeadHandoff(
  input: ResolveLeadHandoffInput
): LeadHandoffDecision {
  const mode = normalizeLeadHandoffMode(input.mode);
  const hasBookingLink = Boolean(input.bookingLink?.trim());

  if (!input.isQualified) {
    return {
      mode,
      shouldSendBookingLink: false,
      shouldNotifyContractor: true,
      status: "needs_followup",
      reason: "Lead is not qualified enough for automatic Calendly handoff.",
    };
  }

  if (input.urgency === "high") {
    return {mode:"emergency_escalation",shouldSendBookingLink:false,shouldNotifyContractor:true,status:"needs_contractor_review",reason:"High urgency requires contractor review before scheduling."};
  }

  if (mode === "review_first") {
    return {
      mode,
      shouldSendBookingLink: false,
      shouldNotifyContractor: true,
      status: "needs_contractor_review",
      reason: "Account is configured for contractor review before Calendly handoff.",
    };
  }

  if (mode === "booking_link") {
    if (!hasBookingLink) {
      return {
        mode,
        shouldSendBookingLink: false,
        shouldNotifyContractor: true,
        status: "needs_contractor_review",
        reason: "Booking mode is enabled but no Calendly booking link is configured.",
      };
    }

    if (!hasEligibleJobType(input.jobType, input.autoBookingJobTypes)) {
      return {
        mode,
        shouldSendBookingLink: false,
        shouldNotifyContractor: true,
        status: "needs_contractor_review",
        reason: "Job type is not configured for automatic Calendly handoff.",
      };
    }

    return {
      mode,
      shouldSendBookingLink: true,
      shouldNotifyContractor: false,
      status: "booking_link_sent",
      reason: "Qualified lead can receive the Calendly booking link directly.",
    };
  }

  if (mode === "review_and_booking") {
    return {
      mode,
      shouldSendBookingLink: hasBookingLink,
      shouldNotifyContractor: true,
      status: hasBookingLink ? "booking_link_sent" : "needs_contractor_review",
      reason: hasBookingLink
        ? "Qualified lead gets the Calendly booking link and contractor review summary."
        : "Review and booking mode is enabled but no Calendly booking link is configured.",
    };
  }


  if (!hasBookingLink) {
    return {
      mode,
      shouldSendBookingLink: false,
      shouldNotifyContractor: true,
      status: "needs_contractor_review",
      reason: "No Calendly booking link is configured for automatic handoff.",
    };
  }

  if (!hasEligibleJobType(input.jobType, input.autoBookingJobTypes)) {
    return {
      mode,
      shouldSendBookingLink: false,
      shouldNotifyContractor: true,
      status: "needs_contractor_review",
      reason: "Job type is not configured for automatic Calendly handoff.",
    };
  }

  return {
    mode,
    shouldSendBookingLink: true,
    shouldNotifyContractor: false,
    status: "booking_link_sent",
    reason: "Non-emergency qualified lead can receive the Calendly booking link.",
  };
}
