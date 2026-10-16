import {
  calculateRecoveryEstimate,
  type CalculatorInputs,
  type CalculatorInputKey,
} from "./calculator-estimates.ts";
import {
  FOUNDING_INITIAL_COMMITMENT,
  FOUNDING_MONTHLY_FEE,
} from "../packages/brand/src/pricing-copy.ts";

export const BRIEF_TITLE = "Revenue Recovery Assessment";
export const COVERAGE_OPTIONS = [
  { value: "jobsite", label: "Busy periods" },
  { value: "after-hours", label: "After hours" },
  { value: "both", label: "Both" },
  { value: "covered", label: "Already covered" },
] as const;
export type CoverageGap = (typeof COVERAGE_OPTIONS)[number]["value"];
export const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
export const count = (value: number) =>
  value > 0 && value < 0.01
    ? "<0.01"
    : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(
        value,
      );

/** Presentation only; never used to calculate revenue or saved totals. */
export function potentialJobSummary(monthlyJobs: number, yearlyJobs: number) {
  if (yearlyJobs === 0) return "No potential jobs at these inputs.";
  if (yearlyJobs < 1) return "Less than 1 potential job per year.";
  const monthly = monthlyJobs >= 0.9;
  const jobs = Math.round(monthly ? monthlyJobs : yearlyJobs);
  return `About ${count(jobs)} potential ${jobs === 1 ? "job" : "jobs"} per ${monthly ? "month" : "year"}`;
}
export const HANDOFF_STATUS = "Inspection awaiting confirmation.";
export const FOLLOW_UP_CONVERSATION = [
  {
    speaker: "Roofing company",
    text: "Sorry we missed your call. What roofing issue can we help with?",
  },
  { speaker: "Homeowner", text: "There's a leak near the chimney." },
  {
    speaker: "Roofing company",
    text: "What's the property address, and when would you like an inspection?",
  },
  {
    speaker: "Homeowner",
    text: "214 Oak Lane. Sometime this week would help.",
  },
] as const;
export const HANDOFF_EXAMPLE = [
  { label: "Roofing issue", value: "Leak near the chimney" },
  { label: "Location", value: "214 Oak Lane" },
  { label: "Timing", value: "Inspection requested this week" },
  { label: "Next action", value: "Office to call and confirm the inspection" },
] as const;
export const OPERATING_COPY = {
  title: "Who owns the follow-up after a missed call?",
  problem:
    "Demand you paid or worked to generate can go unanswered. Without consistent follow-up, office workload grows and suitable inquiries can stall before an inspection - even in a well-run company.",
  solution:
    "Assign a person or service to reconnect with callers, gather the roofing details, check the fit and give your team a clear next step.",
  roofReplyTitle: "RoofReply manages that process.",
  roofReplyBody:
    "RoofReply manages the initial text, conversation and qualification. Your team receives the roofing issue, location, timing and next action, reducing the chasing and coordination for your owner and office. We implement, monitor and report on the workflow. Your team confirms inspections, prepares quotes and closes jobs.",
  auditPurpose:
    "Review your estimate, understand current coverage and decide whether a focused recovery workflow is worthwhile.",
};
export const ESTIMATE_LIMIT =
  "Based on the assumptions below. Revenue excludes job costs and service fees and is not guaranteed revenue or a verified loss.";
export const REFINE_COPY =
  "You can review four recent weeks of calls, identify unique new roofing inquiries and check which your team already reached.";

export function buildRecoveryBrief(
  inputs: CalculatorInputs,
  gap: CoverageGap = "both",
  contributionMargin: number | null = null,
  providedInputs: readonly CalculatorInputKey[] = [],
) {
  const estimate = calculateRecoveryEstimate(inputs);
  if (
    contributionMargin !== null &&
    (!Number.isFinite(contributionMargin) ||
      contributionMargin < 0 ||
      contributionMargin > 100)
  )
    throw new RangeError("Margin must be between 0 and 100, or unknown.");
  const contributionPerJob =
    contributionMargin === null
      ? null
      : (inputs.averageJobValue * contributionMargin) / 100;
  const breakEvenJobs = contributionPerJob
    ? Math.ceil(FOUNDING_INITIAL_COMMITMENT / contributionPerJob)
    : null;
  const recurringJobs = contributionPerJob
    ? Math.ceil(FOUNDING_MONTHLY_FEE / contributionPerJob)
    : null;
  const adjustmentNote = !estimate.existingFollowUpKnown
    ? "Existing follow-up has not been deducted because it is unknown; additional revenue has not been established."
    : inputs.existingRecoveryRate === 0
      ? "You entered 0% already reached, so no existing-follow-up deduction was applied."
      : `This estimate excludes the ${count(inputs.existingRecoveryRate!)}% of eligible inquiries you say your team already reaches.`;
  const resultExplanation = `${ESTIMATE_LIMIT} ${adjustmentNote}`;
  const status =
    estimate.yearlyRevenue === 0
      ? "no-opportunity"
      : estimate.yearlyClosedJobs < 1
        ? "small-opportunity"
        : gap === "covered"
          ? "verify-coverage"
          : !estimate.existingFollowUpKnown
            ? "verify-follow-up"
            : "review-opportunity";
  const auditFinding =
    "The audit checks what your current process already captures and whether the remaining opportunity could justify managed follow-up.";
  const finding = {
    title: "What to do next",
    body: {
      "no-opportunity":
        "These inputs show no revenue opportunity. If they reflect your business, this estimate does not support adding a paid recovery service.",
      "small-opportunity":
        "Improving your existing team’s follow-up may be enough; a paid service may not be worthwhile.",
      "verify-coverage":
        "The audit checks for gaps in your current coverage before adding a service that could duplicate your team’s work.",
      "verify-follow-up": auditFinding,
      "review-opportunity": auditFinding,
    }[status],
  };
  const source = (key: CalculatorInputKey) =>
    providedInputs.includes(key) ? "Your input" : "Example";
  const rows = [
    {
      label: "Missed calls / week",
      value: count(inputs.missedCallsPerWeek),
      source: source("missedCallsPerWeek"),
      group: "business",
    },
    {
      label: "Average job value",
      value: money(inputs.averageJobValue),
      source: source("averageJobValue"),
      group: "business",
    },
    {
      label: "Qualified inquiry to sale",
      value: `${count(inputs.closeRate)}%`,
      source: source("closeRate"),
      group: "business",
    },
    {
      label: "Legitimate, unique new inquiries",
      value: `${count(inputs.realLeadRate)}%`,
      source: source("realLeadRate"),
      group: "assumption",
    },
    {
      label: "Already reached by your team",
      value: estimate.existingFollowUpKnown
        ? `${count(inputs.existingRecoveryRate!)}%`
        : "Unknown",
      source: estimate.existingFollowUpKnown ? "Your estimate" : "Not adjusted",
      group: "assumption",
    },
    {
      label: "Reply to follow-up",
      value: `${count(inputs.engagementRate)}%`,
      source: source("engagementRate"),
      group: "assumption",
    },
    {
      label: "Replies that fit your work",
      value: `${count(inputs.qualificationRate)}%`,
      source: source("qualificationRate"),
      group: "assumption",
    },
  ];
  return {
    estimate,
    status,
    finding,
    resultExplanation,
    jobSummary: potentialJobSummary(
      estimate.monthlyClosedJobs,
      estimate.yearlyClosedJobs,
    ),
    jobDetails: `Modeled averages: ${count(estimate.monthlyClosedJobs)} jobs/month; ${count(estimate.yearlyClosedJobs)} jobs/year.`,
    rows,
    contributionMargin,
    contributionPerJob,
    breakEvenJobs,
    recurringJobs,
    flow: [
      { label: "Missed calls", value: estimate.monthlyMissedCalls },
      { label: "New inquiries", value: estimate.monthlyLegitimateInquiries },
      {
        label: estimate.existingFollowUpKnown
          ? "Still unreached"
          : "Before adjustment",
        value: estimate.monthlyEligibleInquiries,
      },
      { label: "Conversations", value: estimate.monthlyConversations },
      { label: "Qualified inquiries", value: estimate.monthlyQualifiedLeads },
      { label: "Sold-job equivalents", value: estimate.monthlyClosedJobs },
    ],
  };
}
