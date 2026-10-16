import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { evaluateQuotaStatus } from "@/lib/usage-control";
import {
  requireAuthenticatedClerkId,
  requireOpsAdmin,
} from "./authHelpers.util";

// Default quota limits
const DEFAULT_QUOTAS = {
  monthlySmslimit: 2000,
  monthlyAiLimit: 2000,
  monthlyLeadLimit: 500,
  dailySmsLimit: 200,
  dailyAiLimit: 100,
  dailyLeadLimit: 50,
};

// Rate limit windows (in milliseconds)
const RATE_LIMIT_WINDOWS = {
  missedCall: 5 * 60 * 1000, // 5 minutes - prevent rapid missed call SMS
  webhookBurst: 60 * 1000, // 1 minute - prevent webhook flooding
  smsPerNumber: 60 * 60 * 1000, // 1 hour - per phone number rate limit
};

// Rate limit thresholds
const RATE_LIMITS = {
  missedCallsPerWindow: 2, // Max 2 missed call SMS per phone per 5 min
  webhooksPerMinute: 100, // Max 100 webhooks per minute per user
  smsPerHourPerNumber: 10, // Max 10 SMS per hour to same number
};

// Get today's date in YYYY-MM-DD format
function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}

// Get current month in YYYY-MM format
function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

// Initialize or get usage quotas for a user
export const getOrCreateQuotas = mutation({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    await requireAuthenticatedClerkId(ctx, clerkId);

    const existing = await ctx.db
      .query("usageQuotas")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .first();

    if (existing) {
      return existing;
    }

    // Create default quotas
    const quotaId = await ctx.db.insert("usageQuotas", {
      clerkId,
      ...DEFAULT_QUOTAS,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return await ctx.db.get(quotaId);
  },
});

// Get today's usage for a user
export const getTodayUsage = query({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    await requireAuthenticatedClerkId(ctx, clerkId);

    const today = getTodayDate();
    return await ctx.db
      .query("usageTracking")
      .withIndex("by_clerk_and_date", (q) =>
        q.eq("clerkId", clerkId).eq("date", today)
      )
      .first();
  },
});

// Get monthly usage totals for a user
export const getMonthlyUsage = query({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    await requireAuthenticatedClerkId(ctx, clerkId);

    const currentMonth = getCurrentMonth();

    // Get all usage records for current month
    const usageRecords = await ctx.db
      .query("usageTracking")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .collect();

    // Filter to current month and sum up
    const monthlyRecords = usageRecords.filter((r) =>
      r.date.startsWith(currentMonth)
    );

    return {
      smsOutbound: monthlyRecords.reduce((sum, r) => sum + r.smsOutbound, 0),
      smsInbound: monthlyRecords.reduce((sum, r) => sum + r.smsInbound, 0),
      aiCalls: monthlyRecords.reduce((sum, r) => sum + r.aiCalls, 0),
      aiTokensUsed: monthlyRecords.reduce((sum, r) => sum + r.aiTokensUsed, 0),
      leadsCreated: monthlyRecords.reduce((sum, r) => sum + r.leadsCreated, 0),
      missedCallsSms: monthlyRecords.reduce(
        (sum, r) => sum + r.missedCallsSms,
        0
      ),
      ownerNotifications: monthlyRecords.reduce(
        (sum, r) => sum + r.ownerNotifications,
        0
      ),
      recordCount: monthlyRecords.length,
    };
  },
});

// Increment usage counters (called from webhook)
export const incrementUsage = internalMutation({
  args: {
    clerkId: v.string(),
    smsOutbound: v.optional(v.number()),
    smsInbound: v.optional(v.number()),
    aiCalls: v.optional(v.number()),
    aiTokensUsed: v.optional(v.number()),
    leadsCreated: v.optional(v.number()),
    missedCallsSms: v.optional(v.number()),
    ownerNotifications: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const today = getTodayDate();
    const { clerkId, ...increments } = args;

    // Get or create today's record
    let usage = await ctx.db
      .query("usageTracking")
      .withIndex("by_clerk_and_date", (q) =>
        q.eq("clerkId", clerkId).eq("date", today)
      )
      .first();

    if (!usage) {
      // Create new daily record
      const usageId = await ctx.db.insert("usageTracking", {
        clerkId,
        date: today,
        smsOutbound: 0,
        smsInbound: 0,
        aiCalls: 0,
        aiTokensUsed: 0,
        leadsCreated: 0,
        missedCallsSms: 0,
        ownerNotifications: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      usage = await ctx.db.get(usageId);
    }

    if (!usage) throw new Error("Failed to get or create usage record");

    // Update with increments
    await ctx.db.patch(usage._id, {
      smsOutbound: usage.smsOutbound + (increments.smsOutbound || 0),
      smsInbound: usage.smsInbound + (increments.smsInbound || 0),
      aiCalls: usage.aiCalls + (increments.aiCalls || 0),
      aiTokensUsed: usage.aiTokensUsed + (increments.aiTokensUsed || 0),
      leadsCreated: usage.leadsCreated + (increments.leadsCreated || 0),
      missedCallsSms: usage.missedCallsSms + (increments.missedCallsSms || 0),
      ownerNotifications:
        usage.ownerNotifications + (increments.ownerNotifications || 0),
      updatedAt: Date.now(),
    });

    return true;
  },
});

// Check if user has exceeded their quotas
export const checkQuotaExceeded = internalQuery({
  args: {
    clerkId: v.string(),
    pendingSmsOutbound: v.optional(v.number()),
    pendingAiCalls: v.optional(v.number()),
    pendingLeadsCreated: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { clerkId, pendingSmsOutbound, pendingAiCalls, pendingLeadsCreated }
  ) => {
    // Get quotas
    const quotas = await ctx.db
      .query("usageQuotas")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .first();

    // If no quotas set, use defaults
    const limits = quotas || { ...DEFAULT_QUOTAS, isActive: true };

    // Get today's usage
    const today = getTodayDate();
    const todayUsage = await ctx.db
      .query("usageTracking")
      .withIndex("by_clerk_and_date", (q) =>
        q.eq("clerkId", clerkId).eq("date", today)
      )
      .first();

    // Get monthly usage
    const currentMonth = getCurrentMonth();
    const monthlyRecords = await ctx.db
      .query("usageTracking")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .collect();

    const monthlyUsage = monthlyRecords
      .filter((r) => r.date.startsWith(currentMonth))
      .reduce(
        (acc, r) => ({
          sms: acc.sms + r.smsOutbound,
          ai: acc.ai + r.aiCalls,
          leads: acc.leads + r.leadsCreated,
        }),
        { sms: 0, ai: 0, leads: 0 }
      );

    return evaluateQuotaStatus({
      limits,
      todayUsage: {
        smsOutbound: todayUsage?.smsOutbound ?? 0,
        aiCalls: todayUsage?.aiCalls ?? 0,
        leadsCreated: todayUsage?.leadsCreated ?? 0,
      },
      monthlyUsage: {
        smsOutbound: monthlyUsage.sms,
        aiCalls: monthlyUsage.ai,
        leadsCreated: monthlyUsage.leads,
      },
      pending: {
        smsOutbound: pendingSmsOutbound,
        aiCalls: pendingAiCalls,
        leadsCreated: pendingLeadsCreated,
      },
    });
  },
});

// Rate limiting: Check if action should be allowed
export const checkRateLimit = internalMutation({
  args: {
    key: v.string(), // e.g., "missed_call:+15551234567"
    limit: v.number(),
    windowMs: v.number(),
  },
  handler: async (ctx, { key, limit, windowMs }) => {
    const now = Date.now();

    // Get existing rate limit record
    const existing = await ctx.db
      .query("rateLimits")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();

    if (!existing) {
      // Create new rate limit record
      await ctx.db.insert("rateLimits", {
        key,
        count: 1,
        windowStart: now,
        expiresAt: now + windowMs,
      });
      return { allowed: true, remaining: limit - 1 };
    }

    // Check if window has expired
    if (now > existing.expiresAt) {
      // Reset the window
      await ctx.db.patch(existing._id, {
        count: 1,
        windowStart: now,
        expiresAt: now + windowMs,
      });
      return { allowed: true, remaining: limit - 1 };
    }

    // Window still active, check count
    if (existing.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfter: existing.expiresAt - now,
      };
    }

    // Increment count
    await ctx.db.patch(existing._id, {
      count: existing.count + 1,
    });

    return { allowed: true, remaining: limit - existing.count - 1 };
  },
});

// Clean up expired rate limit records (run periodically)
export const cleanupExpiredRateLimits = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Get all rate limit records
    const records = await ctx.db.query("rateLimits").collect();

    let cleaned = 0;
    for (const record of records) {
      if (record.expiresAt < now) {
        await ctx.db.delete(record._id);
        cleaned++;
      }
    }

    return { cleaned };
  },
});

// Internal version for cron jobs
export const cleanupExpiredRateLimitsInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Get all rate limit records
    const records = await ctx.db.query("rateLimits").collect();

    let cleaned = 0;
    for (const record of records) {
      if (record.expiresAt < now) {
        await ctx.db.delete(record._id);
        cleaned++;
      }
    }

    console.log(`[Cron] Cleaned up ${cleaned} expired rate limit records`);
    return { cleaned };
  },
});

// Update user quotas (admin function)
export const updateQuotas = mutation({
  args: {
    clerkId: v.string(),
    monthlySmslimit: v.optional(v.number()),
    monthlyAiLimit: v.optional(v.number()),
    monthlyLeadLimit: v.optional(v.number()),
    dailySmsLimit: v.optional(v.number()),
    dailyAiLimit: v.optional(v.number()),
    dailyLeadLimit: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { clerkId, ...updates } = args;
    await requireOpsAdmin(ctx);
    for(const value of Object.values(updates))if(typeof value==="number"&&(!Number.isSafeInteger(value)||value<0))throw new Error("Quotas must be non-negative whole numbers");

    const existing = await ctx.db
      .query("usageQuotas")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .first();

    if (!existing) {
      // Create with defaults + overrides
      const quotaId = await ctx.db.insert("usageQuotas", {
        clerkId,
        ...DEFAULT_QUOTAS,
        ...updates,
        isActive: updates.isActive ?? true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return await ctx.db.get(quotaId);
    }

    // Update existing
    await ctx.db.patch(existing._id, {
      ...updates,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(existing._id);
  },
});

// Get usage summary for dashboard
export const getUsageSummary = query({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    await requireAuthenticatedClerkId(ctx, clerkId);

    const today = getTodayDate();
    const currentMonth = getCurrentMonth();

    // Get quotas
    const quotas = await ctx.db
      .query("usageQuotas")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .first();

    const limits = quotas || DEFAULT_QUOTAS;

    // Get today's usage
    const todayUsage = await ctx.db
      .query("usageTracking")
      .withIndex("by_clerk_and_date", (q) =>
        q.eq("clerkId", clerkId).eq("date", today)
      )
      .first();

    // Get monthly usage
    const monthlyRecords = await ctx.db
      .query("usageTracking")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .collect();

    const monthlyUsage = monthlyRecords
      .filter((r) => r.date.startsWith(currentMonth))
      .reduce(
        (acc, r) => ({
          smsOutbound: acc.smsOutbound + r.smsOutbound,
          aiCalls: acc.aiCalls + r.aiCalls,
          leadsCreated: acc.leadsCreated + r.leadsCreated,
        }),
        { smsOutbound: 0, aiCalls: 0, leadsCreated: 0 }
      );

    return {
      daily: {
        sms: {
          used: todayUsage?.smsOutbound || 0,
          limit: limits.dailySmsLimit,
        },
        ai: { used: todayUsage?.aiCalls || 0, limit: limits.dailyAiLimit },
        leads: {
          used: todayUsage?.leadsCreated || 0,
          limit: limits.dailyLeadLimit,
        },
      },
      monthly: {
        sms: {
          used: monthlyUsage.smsOutbound,
          limit: limits.monthlySmslimit,
        },
        ai: { used: monthlyUsage.aiCalls, limit: limits.monthlyAiLimit },
        leads: {
          used: monthlyUsage.leadsCreated,
          limit: limits.monthlyLeadLimit,
        },
      },
    };
  },
});

// Get current quota settings for the signed-in user's account
export const getQuotaSettings = query({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    await requireOpsAdmin(ctx);

    const quotas = await ctx.db
      .query("usageQuotas")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .first();

    return quotas || { ...DEFAULT_QUOTAS, isActive: true };
  },
});

// Export constants for use in webhook
export { RATE_LIMIT_WINDOWS, RATE_LIMITS };
