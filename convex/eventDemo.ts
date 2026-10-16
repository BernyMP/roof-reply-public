import { ConvexError } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { optInRecord } from "./demoSmsConsent";
import { admitEventDemo, eventDemoEnabled } from "./eventDemoPolicy.util";
import { requireOpsAdmin } from "./authHelpers.util";
import { EVENT_DEMO, eventDemoDay, isUsDemoPhone } from "../lib/event-demo-policy";
import { DEMO_SMS_CONSENT_TEXT, DEMO_SMS_CONSENT_VERSION } from "../lib/ten-dlc-demo-campaign";

export const enroll = internalMutation({
  args: { record: optInRecord },
  handler: async (ctx, { record }) => {
    const unavailable = { ok: false as const, status: "unavailable", message: "The live demo is temporarily unavailable. Please try again later." };
    if (!eventDemoEnabled()) return unavailable;
    if (record.consentText !== DEMO_SMS_CONSENT_TEXT || record.consentVersion !== DEMO_SMS_CONSENT_VERSION || !isUsDemoPhone(record.phoneNumber) || record.id.length > 100)
      return { ok: false as const, status: "invalid", message: "Enter a valid US phone number and accept the current SMS consent." };
    const a = await ctx.db.query("onboarding").withIndex("by_clerk_id", (q) => q.eq("clerkId", process.env.EVENT_DEMO_ACCOUNT_CLERK_ID ?? "")).unique();
    if (!a) return unavailable;
    const now = Date.now();
    for (const [window, limit] of [[60000, 120], [3600000, 600]]) {
      const key = `event-demo:${record.ipAddress ?? "unknown"}:${window}`;
      const row = await ctx.db.query("rateLimits").withIndex("by_key", (q) => q.eq("key", key)).first();
      if (row && row.expiresAt > now && row.count >= limit)
        return { ok: false as const, status: "rate_limited", message: "Too many requests. Please try again in a minute." };
      if (row) await ctx.db.patch(row._id, row.expiresAt > now ? { count: row.count + 1 } : { count: 1, windowStart: now, expiresAt: now + window });
      else await ctx.db.insert("rateLimits", { key, count: 1, windowStart: now, expiresAt: now + window });
    }
    const consent = await ctx.db.query("demoSmsOptIns").withIndex("by_record_id", (q) => q.eq("recordId", record.id)).unique();
    if (consent && consent.phoneNumber !== record.phoneNumber)
      return { ok: false as const, status: "invalid", message: "Please submit a new request." };
    if (!consent) await ctx.db.insert("demoSmsOptIns", {
      recordId: record.id, type: record.type, phoneNumber: record.phoneNumber, rawPhone: record.rawPhone,
      name: record.name, company: record.company, timestamp: record.timestamp, sourceUrl: record.sourceUrl,
      ipAddress: record.ipAddress, userAgent: record.userAgent, consentText: record.consentText,
      consentVersion: record.consentVersion, createdAt: now,
    });
    const result = await admitEventDemo(ctx, a, record.phoneNumber, `web:${record.id}`, "website");
    if (!result.ok || result.status !== "queued") return result;
    await ctx.db.insert("automationEvents", {
      eventId: `event-demo:${record.id}`, conversationKey: `${a.telnyxPhoneNumber}:${record.phoneNumber}`,
      clerkId: a.clerkId, demoSessionId: result.sessionId, leadId: result.leadId,
      type: "demo.start", sender: a.telnyxPhoneNumber!, recipient: record.phoneNumber, providerId: "",
      text: "", occurredAt: now, receivedAt: now, status: "queued", attempts: 0,
    });
    await ctx.scheduler.runAfter(0, internal.automationActions.process, { conversationKey: `${a.telnyxPhoneNumber}:${record.phoneNumber}` });
    return result;
  },
});

export const inspect = query({
  args: {},
  handler: async (ctx) => {
    await requireOpsAdmin(ctx);
    const day = eventDemoDay();
    const usage = await ctx.db.query("eventDemoDays").withIndex("by_day", (q) => q.eq("day", day)).unique();
    const a = await ctx.db.query("onboarding").withIndex("by_clerk_id", (q) => q.eq("clerkId", process.env.EVENT_DEMO_ACCOUNT_CLERK_ID ?? "")).unique();
    const sessions = a ? await ctx.db.query("demoSessions").withIndex("by_account", (q) => q.eq("clerkId", a.clerkId)).order("desc").take(200) : [];
    const recent = sessions.filter((s) => s.eventDemo && s.day === day);
    const messages = await Promise.all(recent.map((s) => ctx.db.query("outboundMessages").withIndex("by_session", (q) => q.eq("demoSessionId", s._id)).collect()));
    return { enabled: eventDemoEnabled() && a?.activationMode !== "paused", day, participants: usage?.participants ?? 0,
      attempts: usage?.attempts ?? 0, reservedCents: usage?.reservedCents ?? 0, limits: EVENT_DEMO,
      failures: messages.flat().filter((m) => ["failed", "uncertain"].includes(m.state)).length,
      sessions: recent.map((s) => ({ id: s._id, phone: s.recipient, state: s.state, reason: s.terminationReason, messages: s.messageCount ?? 0 })),
    };
  },
});
export const pause = mutation({
  args: {},
  handler: async (ctx) => {
    await requireOpsAdmin(ctx);
    const a = await ctx.db.query("onboarding").withIndex("by_clerk_id", (q) => q.eq("clerkId", process.env.EVENT_DEMO_ACCOUNT_CLERK_ID ?? "")).unique();
    if (!a?.isDemoAccount) throw new ConvexError("Demo account unavailable");
    await ctx.db.patch(a._id, { activationMode: "paused", updatedAt: Date.now() });
  },
});
