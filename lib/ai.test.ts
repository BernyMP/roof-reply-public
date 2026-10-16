import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { generateAiResponse } from "./ai.ts";
import { nextIntakeQuestion } from "./intake-policy.ts";
import { buildRoofingLeadPrompt, roofingHandoffReply, type RoofingLeadContext } from "../agents/roofing-lead/src/conversation.ts";

const context: RoofingLeadContext = {
  businessName: "Example Roofing",
  aiTone: "friendly",
  preferredJobTypes: ["roof repair", "roof replacement"],
  serviceAreas: ["Tempe"],
  leadHandoffMode: "booking_link",
  bookingLink: "https://example.test/book",
};
const result = {
  message: "What's the property address, including the city?",
  name: null,
  jobType: "Tile roof repair",
  location: null,
  urgency: "medium",
  summary: "Reports a cracked tile; no active water intrusion reported.",
  isQualified: false,
  conversationComplete: false,
  requiresHumanReview: false,
  recommendedHandoff: "review_first",
  shouldSendBookingLink: false,
  shouldNotifyContractor: false,
  handoffReason: null,
};

function mockModel(t: TestContext, output: unknown) {
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-only";
  t.after(() => {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  });
  return t.mock.method(globalThis, "fetch", async (_url: unknown, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body));
    assert.equal(request.messages[0].content, buildRoofingLeadPrompt(context));
    assert.ok(request.response_format.json_schema.schema.required.includes("requiresHumanReview"));
    return Response.json({ choices: [{ message: { content: JSON.stringify(output) } }] });
  });
}

test("production intake uses the shared specialist instructions and keeps missing facts unknown", async (t) => {
  mockModel(t, result);
  const reply = await generateAiResponse([{ role: "user", content: "One cracked tile, no leaking." }], context);
  assert.equal(reply.leadInfo.jobType, "Tile roof repair");
  assert.equal(reply.leadInfo.urgency, "medium");
  assert.equal(reply.leadInfo.name, undefined);
  assert.equal(reply.conversationComplete, false);
});

test("human review stops qualification even when the model marks a complete lead eligible for booking", async (t) => {
  mockModel(t, { ...result, name: "Alex", location: "Tempe", isQualified: true, conversationComplete: true, requiresHumanReview: true });
  const reply = await generateAiResponse([{ role: "user", content: "I'm Alex in Tempe. Please have a person call about my repair." }], context);
  assert.equal(reply.requiresHumanReview, true);
  assert.equal(reply.leadInfo.isQualified, false);
  assert.doesNotMatch(reply.message, /\?|book|confirmed/i);
});

test("a callback request can exit intake without inventing a name or address", async (t) => {
  mockModel(t, { ...result, jobType: null, urgency: null, summary: "Requests a callback from a person.", requiresHumanReview: true });
  const reply = await generateAiResponse([{ role: "user", content: "Can a person call me?" }], context);
  assert.equal(reply.requiresHumanReview, true);
  assert.equal(reply.conversationComplete, false);
  assert.equal(reply.leadInfo.name, undefined);
  assert.equal(reply.leadInfo.location, undefined);
  assert.doesNotMatch(reply.message, /\?/);
});

test("urgent incomplete intake does not keep asking questions or promise a crew", async (t) => {
  mockModel(t, { ...result, urgency: "high", message: "What name should I pass to the team?" });
  const reply = await generateAiResponse([{ role: "user", content: "Water is pouring in and the ceiling is falling." }], context);
  assert.equal(reply.conversationComplete, false);
  assert.equal(reply.leadInfo.urgency, "high");
  assert.match(reply.message, /urgent review/);
  assert.match(reply.message, /immediate danger/);
  assert.doesNotMatch(reply.message, /\?|dispatched|on the way/);
});

test("a replacement fallback asks about timing while a leak fallback asks about water", () => {
  assert.match(nextIntakeQuestion({ jobType: "Replacement estimate" }), /planning ahead/);
  assert.doesNotMatch(nextIntakeQuestion({ jobType: "Replacement estimate" }), /water/);
  assert.match(nextIntakeQuestion({ jobType: "Leak repair" }), /water coming inside/);
});

test("a premature model completion cannot bypass missing intake facts", async (t) => {
  mockModel(t, { ...result, conversationComplete: true, isQualified: true });
  const reply = await generateAiResponse([{ role: "user", content: "A tile cracked." }], context);
  assert.equal(reply.conversationComplete, false);
  assert.equal(reply.leadInfo.isQualified, false);
});

test("invalid model replies still fail closed to contractor follow-up", async (t) => {
  mockModel(t, { ...result, message: "Visit https://untrusted.test to book" });
  await assert.rejects(generateAiResponse([{ role: "user", content: "Need a repair" }], context), /contractor follow-up required/);
});

test("ambiguous short numbers never manufacture an emergency or call the model", async (t) => {
  const fetch = mockModel(t, result);
  const reply = await generateAiResponse([
    { role: "assistant", content: "Is water coming inside now?" },
    { role: "user", content: "Only 1" },
  ], context);
  assert.equal(fetch.mock.callCount(), 0);
  assert.equal(reply.leadInfo.urgency, undefined);
  assert.equal(reply.conversationComplete, false);
});

test("handoff text respects urgency and human review before booking, within the reply limit", () => {
  for (const input of [{}, { shouldSendBookingLink: true }, { requiresHumanReview: true, shouldSendBookingLink: true }, { urgency: "high", shouldSendBookingLink: true }]) {
    const reply = roofingHandoffReply(input);
    assert.ok(reply.length <= 240);
    assert.doesNotMatch(reply, /https?:|\?/);
    if (input.requiresHumanReview || input.urgency === "high") assert.doesNotMatch(reply, /scheduling link/);
  }
  assert.match(roofingHandoffReply({ shouldSendBookingLink: true }), /isn't confirmed/);
});
