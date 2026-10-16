import { v } from "convex/values";
export const attributionValidator = v.object({
  utm_source: v.optional(v.string()),
  utm_medium: v.optional(v.string()),
  utm_campaign: v.optional(v.string()),
  utm_content: v.optional(v.string()),
  utm_term: v.optional(v.string()),
});
export const followUpVersionValidator = v.union(v.literal("assessment_follow_up_v1"), v.literal("kit_follow_up_v1"));
export const followUpRequestValidator = v.object({ version: followUpVersionValidator, accepted: v.literal(true) });
export const followUpReceiptValidator = v.object({ version: followUpVersionValidator, wording: v.string(), requestedAt: v.number() });
