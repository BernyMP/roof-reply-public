export const leadStatusLabels = {
  new: "New",
  qualifying: "In conversation",
  qualified: "Qualified",
  not_qualified: "Not qualified",
  needs_followup: "Needs follow-up",
  booking_link_sent: "Booking link sent",
  needs_contractor_review: "Needs your review",
  appointment_booked: "Appointment booked",
} as const;
export type LeadStatus = keyof typeof leadStatusLabels;
export type LeadFilter = "all" | "needs_action" | "qualified" | "not_qualified";
export const leadFilters: [LeadFilter, string][] = [
  ["all", "All leads"],
  ["needs_action", "Needs action"],
  ["qualified", "Qualified"],
  ["not_qualified", "Not qualified"],
];
export const needsActionStatuses: readonly string[] = [
  "new",
  "qualifying",
  "needs_followup",
  "needs_contractor_review",
];
export function needsAction(status: string) {
  return needsActionStatuses.includes(status);
}
export function matchesLeadFilter(status: string, filter: LeadFilter) {
  if (filter === "all") return true;
  if (filter === "needs_action") return needsAction(status);
  if (filter === "not_qualified") return status === "not_qualified";
  return ["qualified", "booking_link_sent", "appointment_booked"].includes(
    status,
  );
}
export function isRealLead(lead: {
  sampleKey?: string;
  demoSessionId?: unknown;
}) {
  return !lead.sampleKey && !lead.demoSessionId;
}
export function maskedLeadPhone(phone: string) {
  return "••• ••• " + phone.slice(-4);
}
export function parseLeadView(params: { get(name: string): string | null }) {
  const value = params.get("filter");
  const filter: LeadFilter = leadFilters.some(([key]) => key === value)
    ? (value as LeadFilter)
    : "all";
  const rawPage = params.get("page") || "1";
  const page =
    /^\d+$/.test(rawPage) && Number.isSafeInteger(Number(rawPage))
      ? Math.max(1, Number(rawPage))
      : 1;
  return { filter, page, lead: params.get("lead") || null };
}
export function leadViewUrl(view: {
  filter: LeadFilter;
  page: number;
  lead?: string | null;
}) {
  const params = new URLSearchParams();
  if (view.filter !== "all") params.set("filter", view.filter);
  if (view.page > 1) params.set("page", String(view.page));
  if (view.lead) params.set("lead", view.lead);
  const search = params.toString();
  return "/dashboard/leads" + (search ? "?" + search : "");
}

export function leadNextStep(lead: {
  status: LeadStatus;
  urgency?: "low" | "medium" | "high";
}) {
  if (lead.status === "not_qualified")
    return {
      title: "No follow-up needed",
      detail:
        "This inquiry is marked as not qualified. You can update its status if that changes.",
    };
  if (lead.status === "appointment_booked")
    return {
      title: "Prepare for the inspection",
      detail: "Check the agreed time and homeowner details before your visit.",
    };
  if (lead.urgency === "high")
    return {
      title: "Review this urgent inquiry",
      detail:
        "This lead is marked high urgency. Review the details and contact the homeowner promptly.",
    };
  if (lead.status === "booking_link_sent")
    return {
      title: "Confirm the next step",
      detail:
        "A booking link was shared. Check your calendar or contact the homeowner; a sent link is not a confirmed inspection.",
    };
  if (lead.status === "qualifying")
    return {
      title: "Review the conversation",
      detail:
        "RoofReply is collecting details. Check the conversation before following up.",
    };
  if (lead.status === "new")
    return {
      title: "Review the new inquiry",
      detail:
        "Check the available details and decide whether the homeowner needs a call.",
    };
  return {
    title: "Follow up with the homeowner",
    detail:
      "Review the summary, then call to confirm the job and agree on the next step.",
  };
}
