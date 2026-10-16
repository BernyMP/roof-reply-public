export const CONTACT_PREFERENCES = ["email", "sms", "both"] as const;
export type ContactPreference = (typeof CONTACT_PREFERENCES)[number];
export const CONTACT_LABELS = { email: "Email", sms: "Text", both: "Both" };
export const CONTACT_VERBS = {
  email: "email",
  sms: "text",
  both: "email and text",
};
export const CONCIERGE_TIME_ZONE = "America/Phoenix";

export const CONCIERGE_CHECKLIST = [
  {
    key: "preferences",
    title: "Your roofing work and follow-up",
    detail:
      "Confirm desired/excluded jobs, qualification criteria, reply style, restrictions, urgent handling, sales follow-up owner, and booking link if used.",
  },
  {
    key: "registration",
    title: "Business registration details",
    detail:
      "Verify legal/trading names, entity, address, registration identifier, website, authorized contact, and permissions in the private provider process. Record a reference, not sensitive documents.",
  },
  {
    key: "routing",
    title: "Your existing phone setup",
    detail:
      "Record phone provider, authorized access, starting number/branch, and agreed unanswered/busy or after-hours routing.",
  },
  {
    key: "engagement",
    title: "Your engagement and recovery target",
    detail:
      "Confirm agreement/payment, actual missed-call baseline, qualification target, reporting contact, and agreed activation date.",
  },
  {
    key: "rehearsal",
    title: "Test the complete experience",
    detail:
      "Confirm customer-specific approval, conditional forwarding, delivered replies/handoffs in three conversations, and STOP/START/HELP. Existing technical checks still apply.",
  },
  {
    key: "launch",
    title: "Customer approval to launch",
    detail:
      "Record the customer's final approval, activation date, and operating handoff. Complete all other items first.",
  },
] as const;
export type ChecklistKey = (typeof CONCIERGE_CHECKLIST)[number]["key"];
export type ChecklistItem = {
  key: ChecklistKey;
  status: "pending" | "waiting" | "complete";
  reference: string;
  updatedAt: number;
  updatedBy: string;
};
export type CustomerConcierge = {
  contactPreference: ContactPreference;
  enrolledAt: number;
  followUpDueAt: number;
  emailContactedAt?: number;
  smsContactedAt?: number;
  kickoffAt?: number;
  nextAction: string;
  nextActionOwner: "berny" | "customer";
  setupComplete: boolean;
  testComplete: boolean;
  waitingOn?: string[];
};

// Phoenix stays UTC-7 year round. The deadline is the end of the enrollment day.
export function sameDayDeadline(timestamp: number) {
  const offset = 7 * 60 * 60 * 1000;
  const localDay = new Date(timestamp - offset);
  return (
    Date.UTC(
      localDay.getUTCFullYear(),
      localDay.getUTCMonth(),
      localDay.getUTCDate() + 1,
    ) +
    offset -
    1
  );
}
export function requestedChannels(
  preference: ContactPreference,
): ("email" | "sms")[] {
  return preference === "both" ? ["email", "sms"] : [preference];
}
export function pendingContactChannels(
  record: Pick<
    CustomerConcierge,
    "contactPreference" | "emailContactedAt" | "smsContactedAt"
  >,
) {
  return requestedChannels(record.contactPreference).filter((channel) =>
    channel === "email" ? !record.emailContactedAt : !record.smsContactedAt,
  );
}
export function conciergeBlockers(items: ChecklistItem[]) {
  return CONCIERGE_CHECKLIST.filter(
    (item) =>
      !items.some(
        (saved) =>
          saved.key === item.key &&
          saved.status === "complete" &&
          saved.reference.trim(),
      ),
  ).map((item) => item.title);
}
export function formatConciergeDate(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CONCIERGE_TIME_ZONE,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(timestamp);
}
export function conciergeContactCopy(
  record: CustomerConcierge,
  now: number,
  welcome = false,
) {
  const pending = pendingContactChannels(record);
  if (!pending.length)
    return "Berny has contacted you using your chosen setup preferences.";
  const channels = pending
    .map((channel) => CONTACT_VERBS[channel])
    .join(" and ");
  if (now > record.followUpDueAt)
    return `Your ${channels} follow-up is still pending. Contact Berny directly if you need a hand.`;
  if (welcome)
    return `Your details are in. I’ll ${channels} you today to arrange the next step. — Berny`;
  return `Berny will ${channels} you by ${formatConciergeDate(record.followUpDueAt)} to arrange the next step.`;
}
export function conciergeDrafts(name: string | undefined, business: string) {
  const greeting = name?.trim() ? `Hi ${name.trim()},` : "Hi,";
  return {
    subject: `Welcome to RoofReply, ${business}`,
    email: `${greeting}\n\nYour details are in, and I’m looking forward to getting RoofReply ready for ${business}.\n\nWe’ll confirm the roofing work you want, how your team follows up, and your existing phone setup. I’ll guide you through registration and routing, then we’ll test the complete experience together before anything goes live.\n\nWhat time works for a kickoff conversation? I already have the details you shared, so we can pick up from there. Please don’t send passwords or sensitive registration documents by email; we’ll handle those through the private setup process.\n\nBerny\nRoofReply`,
    sms: `${greeting} it’s Berny from RoofReply. I have your setup details for ${business}. What time works for a quick kickoff conversation?`,
  };
}
