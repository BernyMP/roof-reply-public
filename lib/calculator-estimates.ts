export const CALCULATION_VERSION = 2 as const;
export const WEEKS_PER_YEAR = 52;
export const MONTHS_PER_YEAR = 12;

export interface CalculatorInputs {
  averageJobValue: number;
  missedCallsPerWeek: number;
  /** Qualified roofing inquiry to sold job, not quote to sale. */
  closeRate: number;
  /** Legitimate, unique new inquiries; existing follow-up is excluded separately. */
  realLeadRate: number;
  engagementRate: number;
  qualificationRate: number;
  /** null/omitted means unknown, never a factual zero. */
  existingRecoveryRate?: number | null;
  calculationVersion?: typeof CALCULATION_VERSION;
}
export type CalculatorInputKey = Exclude<
  keyof CalculatorInputs,
  "calculationVersion"
>;
export interface RecoveryEstimate {
  calculationVersion: typeof CALCULATION_VERSION;
  existingFollowUpKnown: boolean;
  monthlyMissedCalls: number;
  yearlyMissedCalls: number;
  monthlyLegitimateInquiries: number;
  yearlyLegitimateInquiries: number;
  monthlyEligibleInquiries: number;
  yearlyEligibleInquiries: number;
  monthlyConversations: number;
  yearlyConversations: number;
  monthlyQualifiedLeads: number;
  yearlyQualifiedLeads: number;
  monthlyClosedJobs: number;
  yearlyClosedJobs: number;
  monthlyRevenue: number;
  yearlyRevenue: number;
}
export const DEFAULT_REAL_LEAD_RATE = 40;
export const DEFAULT_ENGAGEMENT_RATE = 50;
export const DEFAULT_QUALIFICATION_RATE = 70;
export const DEFAULT_AVERAGE_JOB_VALUE = 5000;
export const DEFAULT_MISSED_CALLS_PER_WEEK = 6;
export const DEFAULT_CLOSE_RATE = 30;
export const DEFAULT_CALCULATOR_INPUTS: CalculatorInputs = {
  averageJobValue: DEFAULT_AVERAGE_JOB_VALUE,
  missedCallsPerWeek: DEFAULT_MISSED_CALLS_PER_WEEK,
  closeRate: DEFAULT_CLOSE_RATE,
  realLeadRate: DEFAULT_REAL_LEAD_RATE,
  engagementRate: DEFAULT_ENGAGEMENT_RATE,
  qualificationRate: DEFAULT_QUALIFICATION_RATE,
  existingRecoveryRate: null,
  calculationVersion: CALCULATION_VERSION,
};
function bounded(value: number, key: string, max: number) {
  if (!Number.isFinite(value) || value < 0 || value > max)
    throw new RangeError(
      `${key} must be a finite number between 0 and ${max}.`,
    );
}
export type FunnelInputs = Omit<CalculatorInputs, "averageJobValue">;
export type RecoveryFunnel = Omit<
  RecoveryEstimate,
  "monthlyRevenue" | "yearlyRevenue"
>;
export function validateCalculatorInputs(inputs: CalculatorInputs) {
  bounded(inputs.averageJobValue, "averageJobValue", 1_000_000);
  validateFunnelInputs(inputs);
}
function validateFunnelInputs(inputs: FunnelInputs) {
  bounded(inputs.missedCallsPerWeek, "missedCallsPerWeek", 1000);
  for (const key of [
    "closeRate",
    "realLeadRate",
    "engagementRate",
    "qualificationRate",
  ] as const)
    bounded(inputs[key], key, 100);
  if (inputs.existingRecoveryRate != null)
    bounded(inputs.existingRecoveryRate, "existingRecoveryRate", 100);
  if (
    inputs.calculationVersion !== undefined &&
    inputs.calculationVersion !== CALCULATION_VERSION
  )
    throw new RangeError("Unsupported calculation version.");
}
export function calculateRecoveryFunnel(inputs: FunnelInputs): RecoveryFunnel {
  validateFunnelInputs(inputs);
  const yearlyMissedCalls = inputs.missedCallsPerWeek * WEEKS_PER_YEAR;
  const yearlyLegitimateInquiries =
    (yearlyMissedCalls * inputs.realLeadRate) / 100;
  const existingFollowUpKnown = inputs.existingRecoveryRate != null;
  const yearlyEligibleInquiries =
    yearlyLegitimateInquiries * (1 - (inputs.existingRecoveryRate ?? 0) / 100);
  const yearlyConversations =
    (yearlyEligibleInquiries * inputs.engagementRate) / 100;
  const yearlyQualifiedLeads =
    (yearlyConversations * inputs.qualificationRate) / 100;
  const yearlyClosedJobs = (yearlyQualifiedLeads * inputs.closeRate) / 100;
  return {
    calculationVersion: CALCULATION_VERSION,
    existingFollowUpKnown,
    yearlyMissedCalls,
    monthlyMissedCalls: yearlyMissedCalls / MONTHS_PER_YEAR,
    yearlyLegitimateInquiries,
    monthlyLegitimateInquiries: yearlyLegitimateInquiries / MONTHS_PER_YEAR,
    yearlyEligibleInquiries,
    monthlyEligibleInquiries: yearlyEligibleInquiries / MONTHS_PER_YEAR,
    yearlyConversations,
    monthlyConversations: yearlyConversations / MONTHS_PER_YEAR,
    yearlyQualifiedLeads,
    monthlyQualifiedLeads: yearlyQualifiedLeads / MONTHS_PER_YEAR,
    yearlyClosedJobs,
    monthlyClosedJobs: yearlyClosedJobs / MONTHS_PER_YEAR,
  };
}

export function calculateRecoveryEstimate(
  inputs: CalculatorInputs,
): RecoveryEstimate {
  validateCalculatorInputs(inputs);
  const funnel = calculateRecoveryFunnel(inputs);
  const yearlyRevenue = funnel.yearlyClosedJobs * inputs.averageJobValue;
  return {
    ...funnel,
    yearlyRevenue,
    monthlyRevenue: yearlyRevenue / MONTHS_PER_YEAR,
  };
}
