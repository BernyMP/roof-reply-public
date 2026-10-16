import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

const IP_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const MAX_OPT_INS_PER_IP_PER_WINDOW = 5;
const PHONE_DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;

export const optInRecord = v.object({
  id: v.string(),
  type: v.literal("roofreply_demo_sms_opt_in"),
  phoneNumber: v.string(),
  rawPhone: v.string(),
  name: v.union(v.string(), v.null()),
  company: v.union(v.string(), v.null()),
  timestamp: v.string(),
  sourceUrl: v.union(v.string(), v.null()),
  ipAddress: v.union(v.string(), v.null()),
  userAgent: v.union(v.string(), v.null()),
  consentText: v.string(),
  consentVersion: v.string(),
});

const captureResult = v.object({
  ok: v.boolean(),
  status: v.union(
    v.literal("captured"),
    v.literal("duplicate"),
    v.literal("rate_limited")
  ),
  id: v.union(v.id("demoSmsOptIns"), v.null()),
  message: v.union(v.string(), v.null()),
});

export const capture = internalMutation({
  args: {
    record: optInRecord,
  },
  returns: captureResult,
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("demoSmsOptIns")
      .withIndex("by_record_id", (q) => q.eq("recordId", args.record.id))
      .unique();

    if (existing) {
      return {
        ok: true,
        status: "duplicate" as const,
        id: existing._id,
        message: null,
      };
    }

    const now = Date.now();
    const recentPhoneOptIn = await ctx.db
      .query("demoSmsOptIns")
      .withIndex("by_phone_created_at", (q) =>
        q.eq("phoneNumber", args.record.phoneNumber)
      )
      .filter((q) =>
        q.gte(q.field("createdAt"), now - PHONE_DUPLICATE_WINDOW_MS)
      )
      .order("desc")
      .first();

    if (recentPhoneOptIn) {
      return {
        ok: true,
        status: "duplicate" as const,
        id: recentPhoneOptIn._id,
        message: null,
      };
    }

    if (args.record.ipAddress) {
      const recentIpOptIns = await ctx.db
        .query("demoSmsOptIns")
        .withIndex("by_ip_created_at", (q) =>
          q.eq("ipAddress", args.record.ipAddress)
        )
        .filter((q) =>
          q.gte(q.field("createdAt"), now - IP_RATE_LIMIT_WINDOW_MS)
        )
        .take(MAX_OPT_INS_PER_IP_PER_WINDOW);

      if (recentIpOptIns.length >= MAX_OPT_INS_PER_IP_PER_WINDOW) {
        return {
          ok: false,
          status: "rate_limited" as const,
          id: null,
          message: "Too many demo SMS requests. Please try again later.",
        };
      }
    }

    const id = await ctx.db.insert("demoSmsOptIns", {
      recordId: args.record.id,
      type: args.record.type,
      phoneNumber: args.record.phoneNumber,
      rawPhone: args.record.rawPhone,
      name: args.record.name,
      company: args.record.company,
      timestamp: args.record.timestamp,
      sourceUrl: args.record.sourceUrl,
      ipAddress: args.record.ipAddress,
      userAgent: args.record.userAgent,
      consentText: args.record.consentText,
      consentVersion: args.record.consentVersion,
      createdAt: now,
    });

    return {
      ok: true,
      status: "captured" as const,
      id,
      message: null,
    };
  },
});
