import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  requireAuthenticatedClerkId,
  requireOpsAdmin,
} from "./authHelpers.util";
import { checklistKey, checklistStatus } from "./conciergeValidators";
import {
  conciergeBlockers,
  CONCIERGE_CHECKLIST,
  pendingContactChannels,
  type CustomerConcierge,
} from "../lib/concierge";
import { readinessBlockers } from "../lib/automation-policy";
import { customerFields } from "./pilotValidators";
import { customerUpdates } from "./onboarding";
import { invalidateConciergeReview } from "./conciergeEnrollment.util";
import type { MutationCtx } from "./_generated/server";

async function findRecord(ctx: MutationCtx, clerkId: string) {
  const record = await ctx.db
    .query("onboardingConcierge")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
    .unique();
  if (!record) throw new Error("Enrollment not found");
  return record;
}

export const customerProgress = query({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }): Promise<CustomerConcierge | null> => {
    await requireAuthenticatedClerkId(ctx, clerkId);
    const record = await ctx.db
      .query("onboardingConcierge")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();
    if (!record) return null;
    const account = await ctx.db
      .query("onboarding")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();
    const complete = (key: string) =>
      record.checklist.some(
        (item) => item.key === key && item.status === "complete",
      );
    // Explicit projection: never expose private notes, references or operator identifiers.
    return {
      contactPreference: record.contactPreference,
      enrolledAt: record.enrolledAt,
      followUpDueAt: record.followUpDueAt,
      emailContactedAt: record.emailContactedAt,
      smsContactedAt: record.smsContactedAt,
      kickoffAt: record.kickoffAt,
      nextAction: record.nextAction,
      nextActionOwner: record.nextActionOwner,
      waitingOn: CONCIERGE_CHECKLIST.filter((definition) =>
        record.checklist.some(
          (item) => item.key === definition.key && item.status === "waiting",
        ),
      ).map((definition) => definition.title),
      setupComplete: [
        "preferences",
        "registration",
        "routing",
        "engagement",
      ].every(complete),
      testComplete:
        complete("rehearsal") &&
        !!account &&
        !readinessBlockers(account).length,
    };
  },
});

export const enrollments = query({
  args: {},
  handler: async (ctx) => {
    await requireOpsAdmin(ctx);
    const records = await ctx.db
      .query("onboardingConcierge")
      .withIndex("by_due")
      .collect();
    return Promise.all(
      records.map(async (record) => ({
        ...record,
        user: await ctx.db.get(record.userId),
        account: await ctx.db
          .query("onboarding")
          .withIndex("by_clerk_id", (q) => q.eq("clerkId", record.clerkId))
          .unique(),
        blockers: conciergeBlockers(record.checklist),
      })),
    );
  },
});

export const markContacted = mutation({
  args: {
    clerkId: v.string(),
    channel: v.union(v.literal("email"), v.literal("sms")),
  },
  handler: async (ctx, { clerkId, channel }) => {
    const operator = await requireOpsAdmin(ctx);
    const record = await findRecord(ctx, clerkId);
    if (!pendingContactChannels(record).includes(channel)) return;
    const now = Date.now();
    await ctx.db.patch(record._id, {
      ...(channel === "email"
        ? { emailContactedAt: now, emailContactedBy: operator }
        : { smsContactedAt: now, smsContactedBy: operator }),
      ...(pendingContactChannels(record).length === 1 &&
      !record.kickoffAt &&
      record.nextAction === "Arrange your kickoff conversation"
        ? {
            nextAction: "Reply to Berny to arrange your kickoff conversation",
            nextActionOwner: "customer" as const,
          }
        : {}),
      updatedAt: now,
    });
  },
});

export const updateCoordination = mutation({
  args: {
    clerkId: v.string(),
    kickoffAt: v.optional(v.union(v.number(), v.null())),
    nextAction: v.string(),
    nextActionOwner: v.union(v.literal("berny"), v.literal("customer")),
    privateNotes: v.string(),
  },
  handler: async (ctx, args) => {
    await requireOpsAdmin(ctx);
    const record = await findRecord(ctx, args.clerkId);
    if (
      !args.nextAction.trim() ||
      args.nextAction.length > 240 ||
      args.privateNotes.length > 4000
    )
      throw new Error(
        "Use a next action under 240 characters and private notes under 4,000 characters.",
      );
    if (
      typeof args.kickoffAt === "number" &&
      (!Number.isFinite(args.kickoffAt) || args.kickoffAt <= 0)
    )
      throw new Error("Enter a valid kickoff time.");
    await ctx.db.patch(record._id, {
      nextAction: args.nextAction.trim(),
      nextActionOwner: args.nextActionOwner,
      privateNotes: args.privateNotes.trim(),
      ...(args.kickoffAt !== undefined
        ? { kickoffAt: args.kickoffAt ?? undefined }
        : {}),
      updatedAt: Date.now(),
    });
  },
});

export const updateChecklist = mutation({
  args: {
    clerkId: v.string(),
    key: checklistKey,
    status: checklistStatus,
    reference: v.string(),
  },
  handler: async (ctx, args) => {
    const operator = await requireOpsAdmin(ctx);
    const record = await findRecord(ctx, args.clerkId);
    if (
      args.reference.length > 2000 ||
      (args.status === "complete" && !args.reference.trim())
    )
      throw new Error(
        "Record a confirmation or evidence reference before completing this item (up to 2,000 characters).",
      );
    if (
      args.key === "launch" &&
      args.status === "complete" &&
      record.checklist.some(
        (item) => item.key !== "launch" && item.status !== "complete",
      )
    )
      throw new Error(
        "Complete the other setup requirements before confirming launch approval.",
      );
    const now = Date.now();
    await ctx.db.patch(record._id, {
      checklist: record.checklist.map((item) =>
        item.key === args.key
          ? {
              key: args.key,
              status: args.status,
              reference: args.reference.trim(),
              updatedAt: now,
              updatedBy: operator,
            }
          : args.status !== "complete" && item.key === "launch"
            ? {
                ...item,
                status: "pending" as const,
                updatedAt: now,
                updatedBy: operator,
              }
            : item,
      ),
      updatedAt: now,
    });
    if (args.status !== "complete") {
      const account = await ctx.db
        .query("onboarding")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
        .unique();
      if (account?.activationMode === "live")
        await ctx.db.patch(account._id, {
          activationMode: "paused",
          updatedAt: now,
        });
    }
  },
});

// Operators can prepare preferences, but cannot manufacture customer SMS permission.
const configurationFields = {
  aiTone: customerFields.aiTone,
  leadHandoffMode: customerFields.leadHandoffMode,
  preferredJobTypes: customerFields.preferredJobTypes,
  filteredJobTypes: customerFields.filteredJobTypes,
  bookingLink: customerFields.bookingLink,
  handoffInstructions: customerFields.handoffInstructions,
  callApproach: customerFields.callApproach,
  thingsNotToSay: customerFields.thingsNotToSay,
};
export const updateConfiguration = mutation({
  args: { clerkId: v.string(), data: v.object(configurationFields) },
  handler: async (ctx, { clerkId, data }) => {
    await requireOpsAdmin(ctx);
    const account = await ctx.db
      .query("onboarding")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();
    if (!account) throw new Error("Account not found");
    await ctx.db.patch(account._id, {
      ...customerUpdates(data, account),
      updatedAt: Date.now(),
    });
    await invalidateConciergeReview(ctx, clerkId);
  },
});
