import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { completeEnrollment } from "./conciergeEnrollment.util";
import {
  hasOpsAdminAccess,
  requireAuthenticatedClerkId,
} from "./authHelpers.util";

// Get or create user
export const getOrCreateUser = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuthenticatedClerkId(ctx, args.clerkId);

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (existing) {
      // Keep the contact shown during enrollment aligned with Clerk's primary email.
      if (args.email.trim() && !existing.onboardingCompleted)
        await ctx.db.patch(existing._id, {
          email: args.email.trim().slice(0, 320),
          ...(args.name ? { name: args.name.trim().slice(0, 200) } : {}),
          updatedAt: Date.now(),
        });
      return existing._id;
    }

    const now = Date.now();
    const userId = await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email.trim().slice(0, 320),
      ...(args.name ? { name: args.name.trim().slice(0, 200) } : {}),
      onboardingCompleted: false,
      onboardingStep: 0,
      createdAt: now,
      updatedAt: now,
    });

    return userId;
  },
});

// Get user by Clerk ID
export const getUserByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    await requireAuthenticatedClerkId(ctx, args.clerkId);

    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
  },
});

// Update onboarding step
export const updateOnboardingStep = mutation({
  args: {
    clerkId: v.string(),
    step: v.number(),
    completed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAuthenticatedClerkId(ctx, args.clerkId);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) throw new Error("User not found");

    if (args.completed === true) {
      await completeEnrollment(ctx, args.clerkId);
      return;
    }

    await ctx.db.patch(user._id, {
      onboardingStep: args.step,
      onboardingCompleted: user.onboardingCompleted,
      updatedAt: Date.now(),
    });
  },
});

// Check if user has completed onboarding
export const hasCompletedOnboarding = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    await requireAuthenticatedClerkId(ctx, args.clerkId);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    return user?.onboardingCompleted ?? false;
  },
});

export const hasOpsAccess = query({
  args: {},
  handler: async (ctx) => {
    return hasOpsAdminAccess(ctx);
  },
});
