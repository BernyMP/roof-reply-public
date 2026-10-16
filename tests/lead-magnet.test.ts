import test from "node:test";
import assert from "node:assert/strict";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { internal } from "../convex/_generated/api";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseLeadMagnetSubmission } from "../lib/lead-magnet-submission";
import {
  DEFAULT_CALCULATOR_INPUTS,
  calculateRecoveryEstimate,
} from "../lib/calculator-estimates";
const modules = Object.fromEntries(
  readdirSync(new URL("../convex/", import.meta.url))
    .filter((f) => f.endsWith(".ts"))
    .map((f) => [
      `../convex/${f}`,
      () => import(fileURLToPath(new URL(`../convex/${f}`, import.meta.url))),
    ]),
);
modules["../convex/_generated/server.ts"] = () =>
  import("../convex/_generated/server");

test("saved versioned lead agrees with the screen model and retains adjustment state", async () => {
  const t = convexTest(schema, modules);
  for (const [index, rate] of [null, 0, 50, 100].entries()) {
    const inputs = { ...DEFAULT_CALCULATOR_INPUTS, existingRecoveryRate: rate };
    const payload = parseLeadMagnetSubmission({
      ...inputs,
      name: "Test Owner",
      email: `qa-${index}@example.test`,
      monthlyRecovery: -1,
      yearlyRecovery: -1,
    });
    const id = await t.mutation(internal.leadMagnet.createLead, payload);
    const row = await t.run((ctx) => ctx.db.get(id));
    const estimate = calculateRecoveryEstimate(inputs);
    assert.equal(row?.monthlyRecovery, estimate.monthlyRevenue);
    assert.equal(row?.yearlyRecovery, estimate.yearlyRevenue);
    assert.equal(row?.calculationVersion, 2);
    assert.equal(row?.existingRecoveryRate, rate);
  }
});
test("legacy capture and existing historical records retain their semantics", async () => {
  const t = convexTest(schema, modules);
  const legacy = {
    name: "Legacy",
    email: "legacy@example.test",
    phoneNumber: "",
    averageJobValue: 5000,
    missedCallsPerWeek: 5,
    closeRate: 30,
    realLeadRate: 40,
    engagementRate: 50,
    qualificationRate: 70,
    monthlyRecovery: 4200,
    yearlyRecovery: 54600,
  };
  const id = await t.mutation(internal.leadMagnet.createLead, legacy);
  const before = await t.run((ctx) => ctx.db.get(id));
  const next = parseLeadMagnetSubmission({
    ...legacy,
    ...DEFAULT_CALCULATOR_INPUTS,
  });
  assert.equal(await t.mutation(internal.leadMagnet.createLead, next), id);
  const after = await t.run((ctx) => ctx.db.get(id));
  assert.deepEqual(after, before);
  assert.equal(after?.calculationVersion, undefined);
});

test("new assessments preserve unknowns, normalize branches and refresh the latest snapshot", async () => {
  const { SAMPLE_ASSESSMENT, DEFAULT_ASSESSMENT } =
    await import("../lib/missed-call-assessment");
  const t = convexTest(schema, modules);
  const payload = parseLeadMagnetSubmission({
    assessmentVersion: 1,
    email: "assessment@example.test",
    company: "García Roofing",
    answers: SAMPLE_ASSESSMENT,
  });
  const id = await t.mutation(internal.leadMagnet.createLead, payload);
  const first = await t.run((ctx) => ctx.db.get(id));
  assert.equal(first?.latestAssessment?.company, "García Roofing");
  assert.equal(
    first?.latestAssessment?.monthlyRecovery,
    payload.monthlyRecovery,
  );
  const update = parseLeadMagnetSubmission({
    assessmentVersion: 1,
    email: "assessment@example.test",
    company: "García & Muñoz",
    answers: {
      ...SAMPLE_ASSESSMENT,
      existingRecoveryRate: 50,
      process: "text",
      replyOwner: "no",
    },
  });
  assert.equal(await t.mutation(internal.leadMagnet.createLead, update), id);
  const second = await t.run((ctx) => ctx.db.get(id));
  assert.equal(second?.monthlyRecovery, first?.monthlyRecovery);
  assert.equal(second?.createdAt, first?.createdAt);
  assert.equal(second?.latestAssessment?.answers.callbackSpeed, null);
  assert.equal(second?.latestAssessment?.ruleIds[1], "reply-ownership");
  assert.ok(Math.abs(second!.latestAssessment!.monthlyRecovery! - 2730) < 1e-8);
  const unknownId = await t.mutation(
    internal.leadMagnet.createLead,
    parseLeadMagnetSubmission({
      assessmentVersion: 1,
      email: "unknown@example.test",
      answers: DEFAULT_ASSESSMENT,
    }),
  );
  const unknown = await t.run((ctx) => ctx.db.get(unknownId));
  assert.equal(unknown?.averageJobValue, undefined);
  assert.equal(unknown?.monthlyRecovery, undefined);
  assert.equal(unknown?.latestAssessment?.monthlyRecovery, null);
});

test("requested follow-up retains original attribution, canonical consent and stable conversion receipt", async () => {
  const { SAMPLE_ASSESSMENT } = await import("../lib/missed-call-assessment");
  const t = convexTest(schema, modules);
  const payload = parseLeadMagnetSubmission({
    assessmentVersion: 1, answers: SAMPLE_ASSESSMENT, company: "Test Roofing",
    email: "REQUESTED@example.test", attribution: { utm_source: "meta", utm_campaign: "az_follow_up_kit", email: "private@example.test" },
    followUpRequest: { version: "kit_follow_up_v1", accepted: true, requestedAt: 1, wording: "Ignore this" },
  });
  const id = await t.mutation(internal.leadMagnet.createLead, { ...payload, captureEventId: "opaque-original-event-123" });
  const first = await t.run(ctx => ctx.db.get(id));
  assert.equal(first?.email, "requested@example.test");
  assert.deepEqual(first?.originalAttribution, { utm_source: "meta", utm_campaign: "az_follow_up_kit" });
  assert.match(first!.followUpRequest!.wording, /three practical follow-up emails/);
  assert.ok(first!.followUpRequest!.requestedAt > 1);
  await t.mutation(internal.leadMagnet.createLead, { ...payload, attribution: { utm_source: "email" }, captureEventId: "retry-event-123456789" });
  const retry = await t.run(ctx => ctx.db.get(id));
  assert.deepEqual(retry?.followUpRequest, first?.followUpRequest);
  assert.deepEqual(retry?.originalAttribution, first?.originalAttribution);
  assert.deepEqual(await t.query(internal.leadMagnet.captureReceipt, { id }), { eventId: "opaque-original-event-123" });
  const exported = await t.query(internal.leadMagnet.listFollowUpRequests, { paginationOpts: { numItems: 50, cursor: null } });
  assert.equal(exported.page.length, 1);
  assert.equal(exported.page[0].company, "Test Roofing");
  assert.equal("latestAssessment" in exported.page[0], false);
  assert.equal("answers" in exported.page[0], false);
});

test("historical contacts are not enrolled until they explicitly request follow-up", async () => {
  const { SAMPLE_ASSESSMENT } = await import("../lib/missed-call-assessment");
  const t = convexTest(schema, modules);
  const raw = { assessmentVersion: 1, answers: SAMPLE_ASSESSMENT, email: "old@example.test", company: "Old Roofing" };
  const id = await t.mutation(internal.leadMagnet.createLead, parseLeadMagnetSubmission(raw));
  assert.equal((await t.query(internal.leadMagnet.listFollowUpRequests, { paginationOpts: { numItems: 50, cursor: null } })).page.length, 0);
  await t.mutation(internal.leadMagnet.createLead, { ...parseLeadMagnetSubmission({ ...raw, followUpRequest: { version: "assessment_follow_up_v1", accepted: true } }), captureEventId: "first-request-event-123" });
  assert.ok((await t.run(ctx => ctx.db.get(id)))?.followUpRequest);
});

test("authenticated ingestion returns one opaque event receipt across retries", async () => {
  const { SAMPLE_ASSESSMENT } = await import("../lib/missed-call-assessment");
  const previous = process.env.ROOFREPLY_SERVICE_SECRET;
  process.env.ROOFREPLY_SERVICE_SECRET = "test-service-secret";
  try {
    const t = convexTest(schema, modules);
    const lead = parseLeadMagnetSubmission({ assessmentVersion: 1, answers: SAMPLE_ASSESSMENT, company: "Test Roofing", email: "http@example.test", followUpRequest: { version: "assessment_follow_up_v1", accepted: true } });
    const request = { method: "POST", headers: { Authorization: "Bearer test-service-secret", "Content-Type": "application/json" }, body: JSON.stringify({ lead, ip: "192.0.2.1" }) };
    const first = await t.fetch("/ingest/lead-magnet", request);
    assert.equal(first.status, 200);
    const receipt = await first.json();
    assert.equal(receipt.captured, true);
    assert.match(receipt.eventId, /^[a-f0-9-]{36}$/);
    assert.deepEqual(await (await t.fetch("/ingest/lead-magnet", request)).json(), receipt);
    assert.equal((await t.fetch("/ingest/lead-magnet", { ...request, headers: {} })).status, 401);
  } finally {
    if (previous === undefined) delete process.env.ROOFREPLY_SERVICE_SECRET;
    else process.env.ROOFREPLY_SERVICE_SECRET = previous;
  }
});
