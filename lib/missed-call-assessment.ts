import { z } from "zod";
import {
  calculateRecoveryFunnel,
  calculateRecoveryEstimate,
} from "./calculator-estimates.ts";
import {
  count,
  money,
  potentialJobSummary,
  ESTIMATE_LIMIT,
  FOLLOW_UP_CONVERSATION,
  HANDOFF_EXAMPLE,
} from "./recovery-brief.ts";


export const ASSESSMENT_VERSION = 1 as const;
export const JOB_TYPES = [
  { value: "repairs", label: "Repairs" },
  { value: "replacements", label: "Replacements" },
  { value: "mixed", label: "A mix of both" },
  { value: "unknown", label: "I’m not sure" },
] as const;
export const TIMINGS = [
  { value: "business-hours", label: "During business hours" },
  { value: "after-hours", label: "After hours" },
  { value: "both", label: "Both" },
  { value: "unknown", label: "I’m not sure" },
] as const;
export const PROCESSES = [
  { value: "callback", label: "Someone calls back" },
  { value: "text", label: "An automatic text is sent" },
  { value: "both", label: "Both" },
  { value: "none", label: "Follow-up is inconsistent or absent" },
  { value: "unknown", label: "I’m not sure" },
] as const;
export const SPEEDS = [
  { value: "fast", label: "Within 15 minutes" },
  { value: "same-day", label: "Later the same day" },
  { value: "next-day", label: "The next business day or later" },
  { value: "unknown", label: "It varies or I’m not sure" },
] as const;
export const OWNERS = [
  { value: "yes", label: "Yes, someone owns it" },
  { value: "sometimes", label: "Sometimes, but ownership varies" },
  { value: "no", label: "No consistent owner" },
  { value: "unknown", label: "I’m not sure" },
] as const;
const percent = z.number().finite().min(0).max(100);
export const rateKeys = [
  "realLeadRate",
  "engagementRate",
  "qualificationRate",
  "closeRate",
] as const;
export type RateKey = (typeof rateKeys)[number];
export const assessmentAnswersSchema = z
  .object({
    missedCallsPerWeek: z.number().finite().min(0).max(1000).nullable(),
    averageJobValue: z.number().finite().min(0).max(1_000_000).nullable(),
    jobType: z.enum(["repairs", "replacements", "mixed", "unknown"]),
    timing: z.enum(["business-hours", "after-hours", "both", "unknown"]),
    process: z.enum(["callback", "text", "both", "none", "unknown"]),
    callbackSpeed: z
      .enum(["fast", "same-day", "next-day", "unknown"])
      .nullable(),
    replyOwner: z.enum(["yes", "sometimes", "no", "unknown"]).nullable(),
    realLeadRate: percent,
    engagementRate: percent,
    qualificationRate: percent,
    closeRate: percent,
    existingRecoveryRate: percent.nullable(),
    grossMargin: percent.nullable(),
    suppliedRates: z.array(z.enum(rateKeys)).max(4),
  })
  .superRefine((a, ctx) => {
    if (a.process === "callback" && a.callbackSpeed === null)
      ctx.addIssue({
        code: "custom",
        path: ["callbackSpeed"],
        message: "Choose a callback time.",
      });
    if ((a.process === "text" || a.process === "both") && a.replyOwner === null)
      ctx.addIssue({
        code: "custom",
        path: ["replyOwner"],
        message: "Choose reply ownership.",
      });
  });
export type AssessmentAnswers = z.infer<typeof assessmentAnswersSchema>;
export const DEFAULT_ASSESSMENT: AssessmentAnswers = {
  missedCallsPerWeek: null,
  averageJobValue: null,
  jobType: "unknown",
  timing: "unknown",
  process: "unknown",
  callbackSpeed: null,
  replyOwner: null,
  realLeadRate: 40,
  engagementRate: 50,
  qualificationRate: 70,
  closeRate: 30,
  existingRecoveryRate: null,
  grossMargin: null,
  suppliedRates: [],
};
export const SAMPLE_ASSESSMENT: AssessmentAnswers = {
  ...DEFAULT_ASSESSMENT,
  missedCallsPerWeek: 6,
  averageJobValue: 5000,
  jobType: "mixed",
  timing: "after-hours",
  process: "callback",
  callbackSpeed: "next-day",
};
export function normalizeAssessment(raw: AssessmentAnswers): AssessmentAnswers {
  const a = assessmentAnswersSchema.parse(raw);
  return {
    ...a,
    callbackSpeed: a.process === "callback" ? a.callbackSpeed : null,
    replyOwner:
      a.process === "text" || a.process === "both" ? a.replyOwner : null,
    suppliedRates: [...new Set(a.suppliedRates)],
  };
}
const optionLabel = (
  options: readonly { value: string; label: string }[],
  value: string | null,
) => options.find((o) => o.value === value)?.label ?? "Unknown";
export const RATE_LABELS: Record<RateKey, string> = {
  realLeadRate: "Legitimate, unique new inquiries",
  engagementRate: "Reply to follow-up",
  qualificationRate: "Replies that fit your work",
  closeRate: "Qualified inquiry to sale",
};
export interface AssessmentFinding {
  id: string;
  title: string;
  evidence: string;
  action: string;
}
function processFinding(a: AssessmentAnswers): AssessmentFinding {
  const timingLabel =
    a.timing === "both"
      ? "Business hours and after hours"
      : a.timing === "unknown"
        ? "Missed-call timing unknown"
        : optionLabel(TIMINGS, a.timing);
  const processLabel =
    a.process === "both"
      ? "Callback and automatic text"
      : a.process === "unknown"
        ? "Follow-up process unknown"
        : optionLabel(PROCESSES, a.process);
  const evidence = `${timingLabel} · ${processLabel}${a.process === "callback" ? ` · ${optionLabel(SPEEDS, a.callbackSpeed)}` : a.replyOwner ? ` · ${optionLabel(OWNERS, a.replyOwner)}` : ""}.`;
  let id = "verify-process",
    title = "Current coverage needs confirming.",
    action =
      "Review a few recent missed calls with your office. Establish who followed up, whether the caller was reached and what happened next.";
  if (a.process === "callback") {
    if (
      a.callbackSpeed === "next-day" &&
      (a.timing === "after-hours" || a.timing === "both")
    ) {
      id = "after-hours";
      title = "Check what happens before the next-day callback.";
      action =
        "Agree who handles after-hours missed inquiries and who follows through when a homeowner replies. Start with the interval before the next callback.";
    } else if (a.callbackSpeed === "fast") {
      id = "verify-reconnection";
      title = "You already have a prompt callback process.";
      action =
        "Check whether recent callbacks reached the homeowner and produced a clear next action before adding another service.";
    } else {
      id = "callback-window";
      title = "Callback timing leaves a period worth reviewing.";
      action =
        "Check which callers remain unreached. Agree who covers that interval and who takes over when the usual person is unavailable.";
    }
  } else if (a.process === "text" || a.process === "both") {
    if (a.replyOwner === "sometimes" || a.replyOwner === "no") {
      id = "reply-ownership";
      title = "The first text is covered; the conversation may not be.";
      action =
        "Assign an owner and backup for incoming replies. Give each suitable inquiry a roofing summary and a clear next action for your team.";
    } else if (a.replyOwner === "yes") {
      id = "verify-handoff";
      title = "You have an established follow-up process.";
      action =
        "Check a few recent conversations. Confirm that suitable inquiries reached the right person with enough detail to arrange the next step.";
    }
  } else if (a.process === "none") {
    id = "assign-owner";
    title = "Follow-up needs a clear owner.";
    action =
      "Assign responsibility for the initial response, conversation and handoff. Name a backup so missed inquiries do not depend on whoever has time.";
  }
  return { id, title, evidence, action };
}
export function buildAssessment(raw: AssessmentAnswers) {
  const answers = normalizeAssessment(raw);
  const a = answers;
  const funnel =
    a.missedCallsPerWeek === null
      ? null
      : calculateRecoveryFunnel({
          ...a,
          missedCallsPerWeek: a.missedCallsPerWeek,
          calculationVersion: 2,
        });
  const estimate =
    a.missedCallsPerWeek === null || a.averageJobValue === null
      ? null
      : calculateRecoveryEstimate({
          ...a,
          missedCallsPerWeek: a.missedCallsPerWeek,
          averageJobValue: a.averageJobValue,
          calculationVersion: 2,
        });
  const process = processFinding(a);
  const status =
    estimate?.yearlyRevenue === 0 || funnel?.yearlyClosedJobs === 0
      ? "zero"
      : funnel && funnel.yearlyClosedJobs < 1
        ? "low"
        : !estimate
          ? "incomplete"
          : "review";
  const opportunity: AssessmentFinding = {
    id: status,
    title:
      status === "zero"
        ? "These inputs do not support adding a paid recovery service."
        : status === "low"
          ? "Improving your existing process may be enough."
          : status === "incomplete"
            ? "The opportunity is not yet quantified."
            : "There is a modeled opportunity to review.",
    evidence: estimate
      ? `${money(estimate.monthlyRevenue)} per average month; ${money(estimate.yearlyRevenue)} annually, using the inputs and assumptions below.`
      : funnel
        ? `${potentialJobSummary(funnel.monthlyClosedJobs, funnel.yearlyClosedJobs)} Job value is unknown.`
        : "Missed-call volume is unknown, so no job or revenue estimate is shown.",
    action:
      status === "zero"
        ? a.existingRecoveryRate === 100
          ? "You report reaching every eligible inquiry. Verify that coverage before adding a service that could duplicate your team’s work."
          : "Check whether these inputs reflect a typical period. If they do, this estimate does not support paying for recovery."
        : status === "low"
          ? "Start by improving your existing team’s follow-up. A paid recovery service may not be worthwhile at this volume."
          : status === "incomplete"
            ? a.missedCallsPerWeek === null
              ? "Use a recent call log to estimate unanswered calls in a typical week. You can still act on the coverage finding below."
              : "Use the average sold-job value for this work to put a revenue amount against the modeled jobs."
            : process.action,
  };
  const primary = status === "review" ? process : opportunity;
  const uncertainty =
    a.missedCallsPerWeek === null
      ? "A typical missed-call count is needed to quantify the opportunity."
      : a.averageJobValue === null
        ? "A job value matching this work is needed to estimate revenue."
        : a.existingRecoveryRate === null
          ? "How many of these inquiries your current process already reaches. Check that before attributing additional work to a new service."
          : "Whether your stated reach rate and the conversion assumptions match actual call and job records.";
  const adjustment =
    a.existingRecoveryRate === null
      ? "Existing follow-up has not been deducted because it is unknown; additional revenue has not been established."
      : a.existingRecoveryRate === 0
        ? "You entered 0% already reached, so no existing-follow-up deduction was applied."
        : `This estimate excludes the ${count(a.existingRecoveryRate)}% of eligible inquiries you say your team already reaches.`;
  const rows = [
    {
      label: "Missed calls / week",
      value:
        a.missedCallsPerWeek === null ? "Unknown" : count(a.missedCallsPerWeek),
      source: a.missedCallsPerWeek === null ? "Unknown" : "Your input",
    },
    {
      label: "Work / job value",
      value: `${optionLabel(JOB_TYPES, a.jobType)} / ${a.averageJobValue === null ? "Unknown" : money(a.averageJobValue)}`,
      source: a.averageJobValue === null ? "Value unknown" : "Your input",
    },
    ...rateKeys.map((key) => ({
      label: RATE_LABELS[key],
      value: `${count(a[key])}%`,
      source: a.suppliedRates.includes(key)
        ? "Your input"
        : "Illustrative assumption",
    })),
    {
      label: "Already reached by your team",
      value:
        a.existingRecoveryRate === null
          ? "Unknown"
          : `${count(a.existingRecoveryRate)}%`,
      source: a.existingRecoveryRate === null ? "Not deducted" : "Your input",
    },
    ...(a.grossMargin === null
      ? []
      : [
          {
            label: "Gross margin",
            value: `${count(a.grossMargin)}%`,
            source: "Your input",
          },
        ]),
  ];
  const grossProfit =
    estimate && a.grossMargin !== null
      ? {
          monthly: (estimate.monthlyRevenue * a.grossMargin) / 100,
          yearly: (estimate.yearlyRevenue * a.grossMargin) / 100,
        }
      : null;
  const costCopy = a.grossMargin === null ? null
    : "The founding offer has no setup or service fee for up to 30 days or $100 usage, whichever comes first. Paid continuation is agreed separately; gross profit is not a promise of recovered work.";
  const replacement = a.jobType === "replacements";
  const conversation = replacement
    ? [
        {
          speaker: "Roofing company",
          text: "Sorry we missed your call. What roofing work can we help with?",
        },
        {
          speaker: "Homeowner",
          text: "We’d like an estimate to replace our roof.",
        },
        {
          speaker: "Roofing company",
          text: "What’s the property address, and when would you like an inspection?",
        },
        {
          speaker: "Homeowner",
          text: "214 Oak Lane. Sometime this week would help.",
        },
      ]
    : FOLLOW_UP_CONVERSATION;
  const handoff = HANDOFF_EXAMPLE.map((row) =>
    row.label === "Roofing issue" && replacement
      ? { ...row, value: "Roof replacement estimate requested" }
      : row,
  );
  return {
    assessmentVersion: ASSESSMENT_VERSION,
    calculationVersion: 2 as const,
    answers,
    funnel,
    estimate,
    status,
    takeaway: primary.title,
    firstAction: primary.action,
    findings: [opportunity, process],
    uncertainty,
    resultExplanation: `${estimate ? ESTIMATE_LIMIT : "Job estimates use the assumptions below and are not guaranteed outcomes."} ${funnel ? adjustment : "No revenue estimate is available at these inputs."}`,
    jobSummary: funnel
      ? potentialJobSummary(funnel.monthlyClosedJobs, funnel.yearlyClosedJobs)
      : "Add a missed-call count to estimate potential jobs.",
    jobDetails: funnel
      ? `Modeled averages: ${count(funnel.monthlyClosedJobs)} jobs/month; ${count(funnel.yearlyClosedJobs)} jobs/year.`
      : "",
    rows,
    grossProfit,
    costCopy,
    conversation,
    handoff,
    auditCopy:
      status === "zero" || status === "low"
        ? "An audit is optional. Start with your existing process; these inputs do not establish a case for paid recovery."
        : "Review your estimate and current coverage, then decide whether the remaining opportunity could justify managed follow-up.",
  };
}
export type Assessment = ReturnType<typeof buildAssessment>;
