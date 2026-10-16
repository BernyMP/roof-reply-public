import { v } from "convex/values";
const nullableNumber = v.union(v.number(), v.null());
export const assessmentSnapshotValidator = v.object({
  assessmentVersion: v.literal(1),
  calculationVersion: v.literal(2),
  answers: v.object({
    missedCallsPerWeek: nullableNumber,
    averageJobValue: nullableNumber,
    jobType: v.union(
      v.literal("repairs"),
      v.literal("replacements"),
      v.literal("mixed"),
      v.literal("unknown"),
    ),
    timing: v.union(
      v.literal("business-hours"),
      v.literal("after-hours"),
      v.literal("both"),
      v.literal("unknown"),
    ),
    process: v.union(
      v.literal("callback"),
      v.literal("text"),
      v.literal("both"),
      v.literal("none"),
      v.literal("unknown"),
    ),
    callbackSpeed: v.union(
      v.literal("fast"),
      v.literal("same-day"),
      v.literal("next-day"),
      v.literal("unknown"),
      v.null(),
    ),
    replyOwner: v.union(
      v.literal("yes"),
      v.literal("sometimes"),
      v.literal("no"),
      v.literal("unknown"),
      v.null(),
    ),
    realLeadRate: v.number(),
    engagementRate: v.number(),
    qualificationRate: v.number(),
    closeRate: v.number(),
    existingRecoveryRate: nullableNumber,
    grossMargin: nullableNumber,
    suppliedRates: v.array(
      v.union(
        v.literal("realLeadRate"),
        v.literal("engagementRate"),
        v.literal("qualificationRate"),
        v.literal("closeRate"),
      ),
    ),
  }),
  company: v.string(),
  status: v.string(),
  ruleIds: v.array(v.string()),
  monthlyRecovery: nullableNumber,
  yearlyRecovery: nullableNumber,
  monthlyJobs: nullableNumber,
  yearlyJobs: nullableNumber,
});
