import { captureMetadataSchema } from "./lead-capture-metadata.ts";
import {
  assessmentAnswersSchema,
  buildAssessment,
} from "./missed-call-assessment.ts";
import { z } from "zod";
import {
  CALCULATION_VERSION,
  calculateRecoveryEstimate,
} from "./calculator-estimates.ts";
const legacySchema = z.object({
  name: z.string().trim().min(1),
  email: z
    .string()
    .trim()
    .email()
    .transform((value) => value.toLowerCase()),
  phoneNumber: z.string().trim().optional().default(""),
  averageJobValue: z.number().finite(),
  missedCallsPerWeek: z.number().finite(),
  closeRate: z.number().finite(),
  realLeadRate: z.number().finite(),
  engagementRate: z.number().finite(),
  qualificationRate: z.number().finite(),
  monthlyRecovery: z.number().finite(),
  yearlyRecovery: z.number().finite(),
});
const versionedSchema = legacySchema.extend({
  name: legacySchema.shape.name.max(100),
  calculationVersion: z.literal(CALCULATION_VERSION),
  existingRecoveryRate: z.number().finite().min(0).max(100).nullable(),
});
const assessmentSubmissionSchema = z.object({
  assessmentVersion: z.literal(1),
  answers: assessmentAnswersSchema,
  email: legacySchema.shape.email.pipe(z.string().max(254)),
  name: z.string().trim().max(100).optional().default(""),
  company: z.string().trim().max(100).optional().default(""),
  ...captureMetadataSchema.shape,
});
export function assessmentSnapshot(
  answers: Parameters<typeof buildAssessment>[0],
  company: string,
) {
  const b = buildAssessment(answers);
  return {
    assessmentVersion: b.assessmentVersion,
    calculationVersion: b.calculationVersion,
    answers: b.answers,
    company,
    status: b.status,
    ruleIds: b.findings.map((f) => f.id),
    monthlyRecovery: b.estimate?.monthlyRevenue ?? null,
    yearlyRecovery: b.estimate?.yearlyRevenue ?? null,
    monthlyJobs: b.funnel?.monthlyClosedJobs ?? null,
    yearlyJobs: b.funnel?.yearlyClosedJobs ?? null,
  };
}
/** New submissions are recomputed; unversioned clients retain the legacy contract. */
export function parseLeadMagnetSubmission(raw: unknown) {
  if (typeof raw === "object" && raw !== null && "assessmentVersion" in raw) {
    const lead = assessmentSubmissionSchema.parse(raw);
    if (lead.followUpRequest && !lead.company) throw new Error("Company is required for follow-up");
    const snapshot = assessmentSnapshot(lead.answers, lead.company);
    const a = snapshot.answers;
    return {
      ...captureMetadataSchema.parse(lead),
      name: lead.name,
      email: lead.email,
      phoneNumber: "",
      closeRate: a.closeRate,
      realLeadRate: a.realLeadRate,
      engagementRate: a.engagementRate,
      qualificationRate: a.qualificationRate,
      ...(a.averageJobValue === null
        ? {}
        : { averageJobValue: a.averageJobValue }),
      ...(a.missedCallsPerWeek === null
        ? {}
        : { missedCallsPerWeek: a.missedCallsPerWeek }),
      ...(snapshot.monthlyRecovery === null
        ? {}
        : {
            monthlyRecovery: snapshot.monthlyRecovery,
            yearlyRecovery: snapshot.yearlyRecovery!,
          }),
      calculationVersion: 2 as const,
      existingRecoveryRate: a.existingRecoveryRate,
      latestAssessment: snapshot,
    };
  }
  const hasVersion =
    typeof raw === "object" && raw !== null && "calculationVersion" in raw;
  if (!hasVersion) return legacySchema.parse(raw);
  const lead = versionedSchema.parse(raw);
  const estimate = calculateRecoveryEstimate(lead);
  return {
    ...lead,
    monthlyRecovery: estimate.monthlyRevenue,
    yearlyRecovery: estimate.yearlyRevenue,
  };
}
