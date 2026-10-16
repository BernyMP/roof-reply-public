import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { EVENT_DEMO, eventDemoDay, isUsDemoPhone } from "../lib/event-demo-policy";
import { demoConsentReference } from "./demoSessionPolicy.util";
import { readinessBlockers } from "../lib/automation-policy";

export function isEventDemoAccount(a: Doc<"onboarding">) {
  return a.isDemoAccount && a.clerkId === process.env.EVENT_DEMO_ACCOUNT_CLERK_ID;
}
export function eventDemoEnabled() {
  return process.env.EVENT_DEMO_ENABLED === "true" && process.env.EVENT_DEMO_RATES_VERIFIED === "true";
}
export async function demoDay(ctx: MutationCtx) {
  const day = eventDemoDay();
  let row = await ctx.db.query("eventDemoDays").withIndex("by_day", (q) => q.eq("day", day)).unique();
  if (!row) {
    const id = await ctx.db.insert("eventDemoDays", { day, participants: 0, attempts: 0, reservedCents: 0 });
    row = (await ctx.db.get(id))!;
  }
  return row;
}
export async function reserveDemoCost(ctx: MutationCtx, sessionId: Id<"demoSessions">, key: string, kind: "sms" | "ai") {
  const session = await ctx.db.get(sessionId);
  if (!session?.eventDemo) return true;
  if (!eventDemoEnabled() || session.terminationReason === "budget") return false;
  const previous = await ctx.db.query("eventDemoCosts").withIndex("by_key", (q) => q.eq("key", key)).unique();
  if (previous) return true;
  const day = await demoDay(ctx);
  const cents = kind === "sms" ? EVENT_DEMO.smsCents : EVENT_DEMO.aiCents;
  if (day.reservedCents + cents > EVENT_DEMO.budgetCents) {
    await ctx.db.patch(sessionId, { state: "completed", terminationReason: "budget", updatedAt: Date.now() });
    return false;
  }
  if (kind === "ai" && (session.aiCallCount ?? 0) >= EVENT_DEMO.aiCalls) return false;
  await ctx.db.patch(day._id, { reservedCents: day.reservedCents + cents });
  await ctx.db.insert("eventDemoCosts", { key, day: day.day, sessionId, kind, cents, createdAt: Date.now() });
  if (kind === "ai") await ctx.db.patch(sessionId, { aiCallCount: (session.aiCallCount ?? 0) + 1 });
  return true;
}

export async function admitEventDemo(ctx: MutationCtx, a: Doc<"onboarding">, phone: string, key: string, source: "website" | "call" | "operator") {
  if (!isEventDemoAccount(a) || !eventDemoEnabled() || a.activationMode === "paused" || !a.activationMode || readinessBlockers(a, false).length)
    return { ok: false as const, status: "unavailable", message: "The live demo is temporarily unavailable. Please try again later." };
  if (!isUsDemoPhone(phone))
    return { ok: false as const, status: "invalid", message: "Enter a valid US phone number." };
  const consentReference = await demoConsentReference(ctx, a, phone);
  // Calls must use a web opt-in, including calls from the account owner's phone.
  const consent = await ctx.db.query("demoSmsOptIns").withIndex("by_phone_created_at", (q) => q.eq("phoneNumber", phone)).order("desc").first();
  if (!consentReference || (source === "call" && !consent))
    return { ok: false as const, status: "consent_required", message: "Request the demo on the website first. Reply START if you previously opted out." };
  const request = await ctx.db.query("eventDemoRequests").withIndex("by_key", (q) => q.eq("key", key)).unique();
  if (request) {
    if (request.phone !== phone) return { ok: false as const, status: "invalid", message: "Request does not match this phone." };
    return { ok: true as const, status: "duplicate", sessionId: request.sessionId };
  }
  const now = Date.now();
  const previous = await ctx.db.query("demoSessions").withIndex("by_pair", (q) => q.eq("sender", a.telnyxPhoneNumber!).eq("recipient", phone)).order("desc").first();
  if (previous) {
    const pending = await ctx.db.query("outboundMessages").withIndex("by_session", (q) => q.eq("demoSessionId", previous._id)).collect();
    if (pending.some((m) => ["queued", "sending", "accepted", "uncertain"].includes(m.state)) ||
        (previous.state === "active" && now - (previous.lastActivityAt ?? previous.updatedAt) < EVENT_DEMO.idleMs)) {
      await ctx.db.insert("eventDemoRequests", { key, phone, sessionId: previous._id, createdAt: now });
      return { ok: true as const, status: "active", sessionId: previous._id };
    }
    if (previous.state === "active") await ctx.db.patch(previous._id, { state: "completed", terminationReason: "inactive", updatedAt: now });
  }
  const day = await demoDay(ctx);
  const participant = await ctx.db.query("eventDemoParticipants").withIndex("by_day_phone", (q) => q.eq("day", day.day).eq("phone", phone)).unique();
  if ((!participant && day.participants >= EVENT_DEMO.participants) || (participant && participant.attempts >= EVENT_DEMO.attempts))
    return { ok: false as const, status: "daily_limit", message: "Today's demo limit has been reached. Limits reset at midnight Pacific time." };
  if (participant && now - participant.lastStartAt < EVENT_DEMO.cooldownMs)
    return { ok: false as const, status: "cooldown", message: "Please wait one minute before starting another demo." };
  if (day.reservedCents + EVENT_DEMO.smsCents > EVENT_DEMO.budgetCents)
    return { ok: false as const, status: "budget", message: "Today's demo budget has been used. Please try again tomorrow." };
  const sessionId = await ctx.db.insert("demoSessions", {
    clerkId: a.clerkId, operatorId: source, sender: a.telnyxPhoneNumber!, recipient: phone,
    businessName: "RoofReply", consentReference, state: "active", bookingEnabled: false,
    eventDemo: true, day: day.day, messageCount: 0, outboundCount: 0, aiCallCount: 0,
    createdAt: now, updatedAt: now, lastActivityAt: now,
  });
  const leadId = await ctx.db.insert("leads", { userId: a.userId, clerkId: a.clerkId, demoSessionId: sessionId, phoneNumber: phone, channel: source === "call" ? "call" : "sms", status: "new", userNotified: false, createdAt: now, updatedAt: now });
  await ctx.db.patch(sessionId, { leadId });
  await ctx.db.insert("eventDemoRequests", { key, phone, sessionId, createdAt: now });
  await ctx.db.patch(day._id, { participants: day.participants + (participant ? 0 : 1), attempts: day.attempts + 1 });
  if (participant) await ctx.db.patch(participant._id, { attempts: participant.attempts + 1, lastStartAt: now });
  else await ctx.db.insert("eventDemoParticipants", { day: day.day, phone, attempts: 1, lastStartAt: now });
  // Reserve the opening before accepting enrollment. beginSend reuses this key.
  await reserveDemoCost(ctx, sessionId, `${sessionId}:opening:${day.day}`, "sms");
  return { ok: true as const, status: "queued", sessionId, leadId };
}
