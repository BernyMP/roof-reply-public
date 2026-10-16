import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import {
  requireAuthenticatedClerkId,
  requireOpsAdmin,
} from "./authHelpers.util";

// Check if a phone number has opted out (globally)
export const isOptedOut = internalQuery({
  args: { phoneNumber: v.string() },
  handler: async (ctx, args) => {
    const optOut = await ctx.db
      .query("optOuts")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", args.phoneNumber))
      .first();

    return !!optOut;
  },
});

// Record an opt-out (when someone texts STOP)
export const recordOptOut = internalMutation({
  args: {
    phoneNumber: v.string(),
    telnyxPhoneNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if already opted out
    const existing = await ctx.db
      .query("optOuts")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", args.phoneNumber))
      .first();

    if (existing) {
      return existing._id;
    }

    // Record the opt-out
    return await ctx.db.insert("optOuts", {
      phoneNumber: args.phoneNumber,
      optedOutAt: Date.now(),
      telnyxPhoneNumber: args.telnyxPhoneNumber,
    });
  },
});

// Clear an opt-out (when someone texts START)
export const clearOptOut = internalMutation({
  args: {
    phoneNumber: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("optOuts")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", args.phoneNumber))
      .first();

    if (!existing) {
      return null;
    }

    await ctx.db.delete(existing._id);
    return existing._id;
  },
});

// Check if a campaign is approved for sending (10DLC compliance)
export const isCampaignApproved = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    await requireAuthenticatedClerkId(ctx, args.clerkId);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) return false;

    const onboarding = await ctx.db
      .query("onboarding")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .first();

    if (!onboarding) return false;

    // Campaign must be approved to send messages
    return onboarding.campaignStatus === "approved";
  },
});

// Update campaign status
export const updateCampaignStatus = mutation({
  args: {
    clerkId: v.string(),
    campaignId: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("submitted"),
      v.literal("approved"),
      v.literal("rejected")
    ),
  },
  handler: async (ctx, args) => {
    await requireOpsAdmin(ctx);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) throw new Error("User not found");

    const onboarding = await ctx.db
      .query("onboarding")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .first();

    if (!onboarding) throw new Error("Onboarding not found");

    const updates: Record<string, unknown> = {
      campaignStatus: args.status,
      activationMode: "paused", providerEvidence: undefined, rehearsalEvidence: undefined,
      updatedAt: Date.now(),
    };

    if (args.campaignId) {
      updates.campaignId = args.campaignId;
    }

    if (args.status === "submitted") {
      updates.campaignSubmittedAt = Date.now();
    }

    if (args.status === "approved") {
      updates.campaignApprovedAt = Date.now();
    }

    await ctx.db.patch(onboarding._id, updates);
  },
});

// Get campaign status for a user
export const getCampaignStatus = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    await requireAuthenticatedClerkId(ctx, args.clerkId);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) return null;

    const onboarding = await ctx.db
      .query("onboarding")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .first();

    if (!onboarding) return null;

    return {
      campaignId: onboarding.campaignId,
      status: onboarding.campaignStatus || "pending",
      submittedAt: onboarding.campaignSubmittedAt,
      approvedAt: onboarding.campaignApprovedAt,
    };
  },
});
