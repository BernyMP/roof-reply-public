import {
  CORE_PRICE_COPY,
  INCLUDED_FOLLOWUPS_COPY,
  ENTERPRISE_SCOPE_COPY,
  QUALIFICATION_ASSURANCE_COPY,
  FREE_USAGE_COPY,
  FREE_EXIT_COPY,
} from "./pricing-copy.ts";

export const SERVICE_TITLE =
  "Managed Missed-Call Recovery for Residential Roofers";
export const SERVICE_DESCRIPTION =
  "RoofReply installs and manages missed-call follow-up for residential roofers, qualifies roofing opportunities, and supports inspection handoff. Book a 20-minute fit call.";
export const CORE_PROMISE =
  "RoofReply installs and manages a system that follows up with missed roofing callers, qualifies the job, collects the details, and moves the homeowner toward an inspection before the opportunity goes cold.";
export const HOMEPAGE_DESCRIPTION =
  "RoofReply manages missed-call follow-up for residential roofers. Get the free Rescue Kit with an office plan, callback scripts, and a tracking sheet, or book a 20-minute audit.";
export const REPORTING_MEASURES = [
  [
    "Eligible missed calls",
    "Prospect calls within the agreed roofing scope, reconciled with your call records.",
  ],
  [
    "Follow-ups delivered",
    "Initial follow-ups with delivery evidence, separate from queued or failed messages.",
  ],
  [
    "Recovered conversations",
    "Eligible prospects who reply and restart a service conversation.",
  ],
  [
    "Qualified opportunities",
    "Inquiries reviewed against the qualification criteria agreed during onboarding.",
  ],
  [
    "Booked inspections",
    "Inspections confirmed by your roofing team; a sent booking link is not a booking.",
  ],
  [
    "Human handoffs",
    "Conversations passed to your team for sales follow-up or further review.",
  ],
] as const;
export const marketingFaqs = [
  {
    question: "Who is RoofReply for?",
    answer:
      "Established, owner-led residential roofing companies with existing inbound lead generation, a defined service area, and someone responsible for sales follow-up. Typically, that means 3–25 employees and at least 20 plausible missed or after-hours prospect calls per month. Larger teams can be a fit when implementation can move without a lengthy procurement process. It is not designed to generate first leads for a brand-new business or replace an internal call center.",
  },
  {
    question: "Can I keep my business number?",
    answer:
      "Yes. We help configure conditional missed-call forwarding from your existing number. Answered calls stay with your business; RoofReply does not answer live voice calls. The audit identifies a controlled starting point, such as one number, branch, or after-hours window, subject to your phone system's routing capabilities.",
  },
  {
    question: "What counts as an eligible roofing prospect?",
    answer:
      "We agree on your prospect-call scope during onboarding. Reporting separates relevant new residential roofing inquiries from spam, vendors, existing customers, and unrelated calls. This is an operator-reviewed classification, not a promise that every irrelevant caller can be identified before the first follow-up.",
  },
  {
    question: "What does RoofReply manage?",
    answer:
      "We install the missed-call recovery workflow, configure your service area and qualification criteria, manage the text conversation, gather roofing details, and hand inquiries to your team. We monitor and refine the workflow, provide direct founder support, and prepare a monthly recovery report. Setup includes required permissions, carrier approval, routing checks and a live rehearsal before activation.",
  },
  {
    question: "What does my roofing team handle?",
    answer:
      "Your team reviews handoffs, follows up with homeowners, confirms inspections, and closes the job. RoofReply works alongside your existing processes and CRM. It is a managed recovery service, not a CRM replacement, call center, or marketing agency.",
  },
  {
    question: "Does RoofReply book inspections?",
    answer:
      "RoofReply moves the homeowner toward an inspection through contractor follow-up or a configured scheduling link. Sending a link does not confirm an appointment. Your team confirms booked inspections for monthly reporting; closed jobs and revenue depend on your sales follow-up.",
  },
  {
    question: "What is included in monthly reporting?",
    answer:
      "Your founder-prepared report covers eligible missed calls, follow-ups delivered, recovered conversations, qualified opportunities, booked inspections and human handoffs. We reconcile available records with your team's feedback, confirm inspections with you, and exclude demo and sample activity. These are managed reports, not an automated revenue dashboard.",
  },
  {
    question: "What does the founding offer cost?",
    answer: `${CORE_PRICE_COPY} ${INCLUDED_FOLLOWUPS_COPY}. ${ENTERPRISE_SCOPE_COPY}`,
  },
  {
    question: "Are results guaranteed?",
    answer: QUALIFICATION_ASSURANCE_COPY,
  },
  { question: "What counts toward the $100 allowance?", answer: FREE_USAGE_COPY },
  { question: "What happens when the free period ends?", answer: FREE_EXIT_COPY },
  {
    question: "How is SMS permission handled?",
    answer:
      "The optional guided demonstration uses a consenting test phone. Live setup includes required SMS permissions and STOP, START, and HELP handling. Messages support service-related roofing inquiries, not promotional campaigns. You can book an audit without opting in to SMS.",
  },
];

// Retained for detailed homepage explorations; the simplified homepage does not render FAQs.
export const homepageFaqs = marketingFaqs.filter(({ question }) => [
  "Who is RoofReply for?",
  "Can I keep my business number?",
  "What does RoofReply manage?",
  "What does my roofing team handle?",
  "Does RoofReply book inspections?",
  "How is SMS permission handled?",
].includes(question));
