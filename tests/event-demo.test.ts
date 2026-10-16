import test from "node:test";
import assert from "node:assert/strict";
import { v } from "convex/values";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import { internalAction } from "../convex/_generated/server";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ACCOUNT_SMS_CONSENT_TEXT, ACCOUNT_SMS_CONSENT_VERSION } from "../lib/account-sms-consent";
import { DEMO_SMS_CONSENT_TEXT, DEMO_SMS_CONSENT_VERSION } from "../lib/ten-dlc-demo-campaign";
import { eventDemoDay, EVENT_DEMO } from "../lib/event-demo-policy";
import { reserveDemoCost } from "../convex/eventDemoPolicy.util";
const modules = Object.fromEntries(readdirSync(new URL("../convex/", import.meta.url)).filter((f) => f.endsWith(".ts")).map((f) => [`../convex/${f}`, () => import(fileURLToPath(new URL(`../convex/${f}`, import.meta.url)))]));
modules["../convex/_generated/server.ts"] = () => import("../convex/_generated/server");
modules["../convex/automationActions.ts"] = async () => ({ process: internalAction({ args: { conversationKey: v.string() }, handler: async () => {} }) });
const sender = "+12025550102", phone = "+12025550199";
async function setup() {
  process.env.EVENT_DEMO_ACCOUNT_CLERK_ID = "event-owner";
  process.env.EVENT_DEMO_ENABLED = "true";
  process.env.EVENT_DEMO_RATES_VERIFIED = "true";
  process.env.EVENT_DEMO_CALLS_ENABLED = "true";
  process.env.OPS_ADMIN_CLERK_IDS = "operator";
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { clerkId: "event-owner", email: "event@example.test", onboardingCompleted: true, onboardingStep: 5, createdAt: 1, updatedAt: 1 });
    await ctx.db.insert("onboarding", { userId, clerkId: "event-owner", isDemoAccount: true, telnyxPhoneNumber: sender, messagingProfileId: "profile", voiceApplicationId: "voice", provisioningStatus: "ready", campaignStatus: "approved", campaignId: "campaign", verificationStatus: "approved", providerEvidence: "verified", keywordHandling: "telnyx", activationMode: "rehearsal", bookingDeliveryPhone: "+12025550190", accountSmsConsentGranted: true, accountSmsConsentPhone: "+12025550190", accountSmsConsentText: ACCOUNT_SMS_CONSENT_TEXT, accountSmsConsentVersion: ACCOUNT_SMS_CONSENT_VERSION, createdAt: 1, updatedAt: 1 });
  });
  return t;
}
function record(id = crypto.randomUUID(), number = phone) {
  return { id, type: "roofreply_demo_sms_opt_in" as const, phoneNumber: number, rawPhone: number, name: null, company: null, timestamp: new Date().toISOString(), sourceUrl: "https://www.roofreply.com/demo-sms", ipAddress: "event-wifi", userAgent: null, consentText: DEMO_SMS_CONSENT_TEXT, consentVersion: DEMO_SMS_CONSENT_VERSION };
}
async function start(t: Awaited<ReturnType<typeof setup>>, number = phone) {
  const result = await t.mutation(internal.eventDemo.enroll, { record: record(undefined, number) });
  assert.equal(result.ok, true);
  assert.ok("sessionId" in result);
  return result.sessionId!;
}
async function finish(t: Awaited<ReturnType<typeof setup>>, sessionId: Awaited<ReturnType<typeof start>>) {
  await t.run(async (ctx) => {
    await ctx.db.patch(sessionId, { state: "completed", lastActivityAt: Date.now() - 61000 });
    const p = await ctx.db.query("eventDemoParticipants").withIndex("by_day_phone", (q) => q.eq("day", eventDemoDay()).eq("phone", phone)).unique();
    if (p) await ctx.db.patch(p._id, { lastStartAt: Date.now() - 61000 });
  });
}
function sms(id: string, text = "Roof leak") {
  return JSON.stringify({ data: { id, event_type: "message.received", occurred_at: new Date().toISOString(), payload: { id: `provider-${id}`, direction: "inbound", from: { phone_number: phone }, to: [{ phone_number: sender }], text, type: "SMS" } } });
}
async function prepare(t: Awaited<ReturnType<typeof setup>>) {
  const event = await t.mutation(internal.automation.claim, { conversationKey: `${sender}:${phone}` });
  assert.ok(event);
  return { event, prepared: await t.mutation(internal.automation.prepare, { eventId: event._id, attempt: event.attempts }) };
}

test("enrollment atomically records consent, queues one opening, reserves cost and deduplicates retries", async () => {
  const t = await setup(); const input = record();
  const a = await t.mutation(internal.eventDemo.enroll, { record: input });
  const b = await t.mutation(internal.eventDemo.enroll, { record: input });
  assert.ok("sessionId" in a && "sessionId" in b);
  assert.equal(a.status, "queued"); assert.equal(b.status, "duplicate"); assert.equal(a.sessionId, b.sessionId);
  await t.run(async (ctx) => {
    const days = await ctx.db.query("eventDemoDays").collect(); assert.equal(days[0].participants, 1); assert.equal(days[0].attempts, 1); assert.equal(days[0].reservedCents, EVENT_DEMO.smsCents);
    assert.equal((await ctx.db.query("automationEvents").collect()).length, 1);
    assert.equal((await ctx.db.query("demoSmsOptIns").collect()).length, 1);
  });
  const { event } = await prepare(t);
  const out = await t.query(internal.automation.outbox, { eventId: event._id }); assert.equal(out.length, 1);
  const send = await t.mutation(internal.automation.beginSend, { id: out[0]._id, attempt: event.attempts }); assert.ok(send);
  await t.run(async (ctx) => assert.equal((await ctx.db.query("eventDemoDays").collect())[0].reservedCents, EVENT_DEMO.smsCents));
});
test("three starts are allowed; fourth is blocked after completed sessions", async () => {
  const t = await setup();
  for (let i = 0; i < 3; i++) await finish(t, await start(t));
  const r = await t.mutation(internal.eventDemo.enroll, { record: record() }); assert.equal(r.status, "daily_limit");
});
test("simultaneous final participant slots cannot exceed 50 and shared Wi-Fi admits more than five", async () => {
  const t = await setup();
  for (let i = 0; i < 49; i++) await start(t, `+1202555${String(1000 + i).padStart(4, "0")}`);
  const r = await Promise.all([1050, 1051].map((i) => t.mutation(internal.eventDemo.enroll, { record: record(undefined, `+1202555${i}`) })));
  assert.equal(r.filter((a) => a.ok).length, 1);
  await t.run(async (ctx) => assert.equal((await ctx.db.query("eventDemoDays").collect())[0].participants, 50));
});
test("new request for an active session consumes neither a start nor another opening", async () => {
  const t = await setup(); const id = await start(t); const r = await t.mutation(internal.eventDemo.enroll, { record: record() });
  assert.ok("sessionId" in r);
  assert.equal(r.status, "active"); assert.equal(r.sessionId, id);
});
test("daily budget and uncertain reservations cannot be overspent", async () => {
  const t = await setup(); const id = await start(t);
  await t.run(async (ctx) => { const d = (await ctx.db.query("eventDemoDays").collect())[0]; await ctx.db.patch(d._id, { reservedCents: 999 }); });
  assert.equal(await t.run((ctx) => reserveDemoCost(ctx, id, "ai-1", "ai")), true);
  assert.equal(await t.run((ctx) => reserveDemoCost(ctx, id, "sms-1", "sms")), false);
  await t.run(async (ctx) => assert.equal((await ctx.db.query("eventDemoDays").collect())[0].reservedCents, 1000));
});
test("pause and STOP prevent an already queued opening from sending", async () => {
  const t = await setup(); await start(t); const { event } = await prepare(t);
  const out = await t.query(internal.automation.outbox, { eventId: event._id });
  await t.mutation(internal.automation.ingest, { body: sms("stop", "STOP") });
  assert.equal(await t.mutation(internal.automation.beginSend, { id: out[0]._id, attempt: event.attempts }), null);
  await assert.rejects(t.query(api.eventDemo.inspect, {}));
  await t.withIdentity({ subject: "operator" }).mutation(api.eventDemo.pause, {});
  assert.equal((await t.mutation(internal.eventDemo.enroll, { record: record(undefined, "+12025550188") })).status, "unavailable");
});
test("at most 20 messages are processed and a completed session never reopens", async () => {
  const t = await setup(); const id = await start(t);
  // Complete the queued start without sending externally.
  const opening = await prepare(t); await t.mutation(internal.automation.finish, { eventId: opening.event._id, attempt: opening.event.attempts });
  await t.run((ctx) => ctx.db.patch(id, { messageCount: 17, outboundCount: 8 }));
  await t.mutation(internal.automation.ingest, { body: sms("last", "details ".repeat(100)) });
  const { event, prepared } = await prepare(t); assert.equal(prepared?.readyToSend, true);
  await t.mutation(internal.automation.finish, { eventId: event._id, attempt: event.attempts });
  await t.mutation(internal.automation.ingest, { body: sms("extra") });
  const extra = await prepare(t); assert.equal(extra.prepared, null);
  await t.run(async (ctx) => { const s = (await ctx.db.get(id))!; assert.ok(s.messageCount! <= 20); assert.equal(s.state, "completed"); const events = await ctx.db.query("automationEvents").collect(); assert.ok(events.every((e) => e.text.length <= 320)); });
});
test("AI attempts are reserved individually and the ninth is the hard limit", async () => {
  const t = await setup(); const id = await start(t);
  for (let i = 0; i < 9; i++) assert.equal(await t.run((ctx) => reserveDemoCost(ctx, id, `ai-${i}`, "ai")), true);
  assert.equal(await t.run((ctx) => reserveDemoCost(ctx, id, "ai-over", "ai")), false);
  assert.equal(await t.run((ctx) => reserveDemoCost(ctx, id, "ai-0", "ai")), true);
});
test("missing consent and non-designated accounts cannot admit calls", async () => {
  const t = await setup();
  const call = JSON.stringify({ data: { id: "call", event_type: "call.initiated", occurred_at: new Date().toISOString(), payload: { call_control_id: "call", call_session_id: "call", from: phone, to: sender, direction: "incoming" } } });
  assert.equal((await t.mutation(internal.automation.ingest, { body: call })).status, "ignored");
  await t.run(async (ctx) => assert.equal((await ctx.db.query("demoSessions").collect()).length, 0));
});
