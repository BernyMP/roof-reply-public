import { v } from "convex/values";
export const contactPreference = v.union(
  v.literal("email"),
  v.literal("sms"),
  v.literal("both"),
);
export const checklistKey = v.union(
  v.literal("preferences"),
  v.literal("registration"),
  v.literal("routing"),
  v.literal("engagement"),
  v.literal("rehearsal"),
  v.literal("launch"),
);
export const checklistStatus = v.union(
  v.literal("pending"),
  v.literal("waiting"),
  v.literal("complete"),
);
export const checklistItem = v.object({
  key: checklistKey,
  status: checklistStatus,
  reference: v.string(),
  updatedAt: v.number(),
  updatedBy: v.string(),
});
