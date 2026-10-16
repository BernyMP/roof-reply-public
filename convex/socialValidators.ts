import { v } from "convex/values";
export const socialQualityScores = v.object({
  hook: v.number(),
  usefulness: v.number(),
  specificity: v.number(),
  design: v.number(),
  platformFit: v.number(),
});

export const socialContent = v.object({
  topic: v.union(
    v.literal("missed_calls"),
    v.literal("follow_up"),
    v.literal("product"),
    v.literal("example"),
    v.literal("audit"),
  ),
  hook: v.string(),
  facebook: v.string(),
  instagram: v.string(),
  graphic: v.object({
    template: v.union(
      v.literal("headline"),
      v.literal("checklist"),
      v.literal("conversation"),
      v.literal("editorial"),
    ),
    headline: v.string(),
    body: v.string(),
    items: v.array(v.string()),
    labels: v.optional(v.array(v.string())),
    evidenceLabel: v.optional(
      v.union(
        v.literal("ILLUSTRATIVE EXAMPLE"),
        v.literal("A TEST YOU CAN RUN"),
        v.literal("SOURCE-GROUNDED EXAMPLE"),
      ),
    ),
    design: v.optional(
      v.union(
        v.literal("cover"),
        v.literal("split"),
        v.literal("statement"),
        v.literal("field-guide"),
        v.literal("flow"),
        v.literal("dialogue"),
        v.literal("comparison"),
        v.literal("script"),
        v.literal("decision"),
        v.literal("annotated"),
        v.literal("story"),
        v.literal("calculation"),
      ),
    ),
  }),
  sources: v.array(
    v.union(
      v.literal("promise"),
      v.literal("description"),
      v.literal("capabilities"),
      v.literal("pricing"),
    ),
  ),
  editorial: v.optional(v.any()),
  action: v.optional(
    v.union(
      v.literal("none"),
      v.literal("save"),
      v.literal("reflect"),
      v.literal("audit"),
    ),
  ),
});
export const socialDelivery = v.object({
  status: v.union(
    v.literal("pending"),
    v.literal("submitting"),
    v.literal("unknown"),
    v.literal("scheduled"),
    v.literal("sent"),
    v.literal("error"),
    v.literal("cancelled"),
  ),
  attempts: v.number(),
  id: v.optional(v.string()),
  error: v.optional(v.string()),
  externalLink: v.optional(v.string()),
});
export const socialPatch = {
  content: v.optional(socialContent),
  sourceVersion: v.optional(v.string()),
  imageId: v.optional(v.id("_storage")),
  generationAttempts: v.optional(v.number()),
  facebook: v.optional(socialDelivery),
  instagram: v.optional(socialDelivery),
  error: v.optional(v.string()),
  open: v.optional(v.boolean()),
  cancelRequested: v.optional(v.boolean()),
  nextCheckAt: v.optional(v.number()),
};
