import { SOCIAL_CONFIG } from "@roofreply/social-agent/config";
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { internal } from "../convex/_generated/api";
import { SUBSCRIPTION_MODEL, LOCAL_EXECUTION } from "../agents/social/src/local-worker";

beforeEach(t => { Object.assign(SOCIAL_CONFIG, { enabled: true, sampleApproved: true, instagramBioConfirmed: true }); if ("mock" in t) t.mock.timers.enable({ apis: ["setTimeout"] }); });
function setup() {
  const modules = Object.fromEntries(readdirSync(new URL("../convex/", import.meta.url)).filter(f => f.endsWith(".ts")).map(f => [`../convex/${f}`, () => import(fileURLToPath(new URL(`../convex/${f}`, import.meta.url)))]));
  modules["../convex/_generated/server.ts"] = () => import("../convex/_generated/server");
  return convexTest(schema, modules);
}
const workerId = "worker-1234567890";
const proof = { workerId, token: "123456789012345678901234567890123456" };
async function localRun(t: ReturnType<typeof setup>, name = "preview-one") {
  const runId = await t.mutation(internal.socialAgent.createRun, { requestId: name, date: "2026-12-01", slot: "morning" });
  await t.run(ctx => ctx.db.patch(runId, { executionMode: LOCAL_EXECUTION }));
  await t.mutation(internal.socialAgentWorker.verified, { workerId, model: SUBSCRIPTION_MODEL });
  return runId;
}

test("a verified worker atomically claims one run; lost responses reuse its receipt", async () => {
  const t = setup();
  const first = await localRun(t);
  await localRun(t, "preview-two");
  const receipt = await t.mutation(internal.socialAgentWorker.claim, proof);
  assert.equal(receipt?.runId, first);
  assert.deepEqual(await t.mutation(internal.socialAgentWorker.claim, proof), receipt);
  assert.equal(await t.mutation(internal.socialAgentWorker.claim, { ...proof, token: "different123456789012345678901234567890" }), null);
  await assert.rejects(t.mutation(internal.socialAgentWorker.claim, { workerId: "another-worker-123", token: proof.token }));
  assert.equal(await t.mutation(internal.socialAgent.dispatch, { runId: first }), false);
});

test("competing claim requests cannot start two assignments", async () => {
  const t = setup();
  await localRun(t);
  await localRun(t, "competing-preview");
  const results = await Promise.all([
    t.mutation(internal.socialAgentWorker.claim, proof),
    t.mutation(internal.socialAgentWorker.claim, { ...proof, token: "competing" + "0".repeat(32) }),
  ]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal((await t.query(internal.socialAgent.snapshot, {})).runs.filter(r => r.status === "running").length, 1);
});

test("hosted credentials, wrong claims, and stale claims cannot bind or generate", async () => {
  const t = setup();
  const runId = await localRun(t);
  await t.mutation(internal.socialAgentWorker.claim, proof);
  const reserve = { runId, key: "attempt", category: "model" as const, model: SUBSCRIPTION_MODEL };
  await assert.rejects(t.mutation(internal.socialAgent.reserve, reserve));
  await assert.rejects(t.mutation(internal.socialAgent.dispatch, { runId, eveRunId: "root" }));
  await assert.rejects(t.mutation(internal.socialAgent.reserve, { ...reserve, claim: { ...proof, token: "wrong" } }));
  await t.mutation(internal.socialAgent.dispatch, { runId, eveRunId: "root", claim: proof });
  await assert.rejects(t.mutation(internal.socialAgent.dispatch, { runId, eveRunId: "duplicate", claim: proof }));
  await t.run(ctx => ctx.db.patch(runId, { dispatchUntil: Date.now() - 1 }));
  await assert.rejects(t.mutation(internal.socialAgent.research, { runId, claim: proof, key: "stale", kind: "search", data: {} }));
  await t.mutation(internal.socialAgentWorker.expire, { runId });
  assert.equal((await t.query(internal.socialAgent.context, { runId })).run.status, "failed");
});

test("subscription usage has no API charges, records tokens, and enforces limits", async () => {
  const t = setup();
  const runId = await localRun(t);
  await t.mutation(internal.socialAgentWorker.claim, proof);
  const args = { runId, key: "model-one", category: "model" as const, model: SUBSCRIPTION_MODEL, claim: proof, role: "writer" as const };
  await assert.rejects(t.mutation(internal.socialAgent.reserve, { ...args, model: "gpt-4o-mini" }));
  const reservation = await t.mutation(internal.socialAgent.reserve, args);
  assert.equal(reservation.reservedUsd, 0);
  await assert.rejects(t.mutation(internal.socialAgent.reserve, { ...args, key: "while-unsettled" }));
  await assert.rejects(t.mutation(internal.socialAgent.settle, { id: reservation.id, actualUsd: 0.01, claim: proof }));
  await t.mutation(internal.socialAgent.settle, { id: reservation.id, actualUsd: 0, inputTokens: 400000, outputTokens: 1, claim: proof });
  await assert.rejects(t.mutation(internal.socialAgent.reserve, { ...args, key: "over-token-cap" }));
  const snapshot = await t.query(internal.socialAgent.snapshot, {});
  assert.equal(snapshot.usage[0].billing, "chatgpt-subscription");
  assert.equal(snapshot.usage[0].inputTokens, 400000);
  assert.equal(snapshot.runs[0].claimHash, undefined);
});

test("daily search limits remain enforced without a paid search reservation", async () => {
  const t = setup();
  const runId = await localRun(t);
  await t.mutation(internal.socialAgentWorker.claim, proof);
  for (let i = 0; i < 3; i++) assert.equal((await t.mutation(internal.socialAgent.reserve, { runId, claim: proof, key: String(i), category: "search" })).reservedUsd, 0);
  await assert.rejects(t.mutation(internal.socialAgent.reserve, { runId, claim: proof, key: "fourth", category: "search" }));
  for (let i = 0; i < 5; i++) await t.mutation(internal.socialAgent.reserve, { runId, claim: proof, key: String(i), category: "fetch" });
  await assert.rejects(t.mutation(internal.socialAgent.reserve, { runId, claim: proof, key: "sixth", category: "fetch" }));
});

test("blocked or unverified workers do not consume jobs; heartbeat cannot clear a block", async () => {
  const t = setup();
  await localRun(t);
  await t.mutation(internal.socialAgentWorker.heartbeat, { workerId, problem: "ChatGPT allowance exhausted." });
  await t.mutation(internal.socialAgentWorker.heartbeat, { workerId });
  assert.equal(await t.mutation(internal.socialAgentWorker.claim, proof), null);
  await t.mutation(internal.socialAgentWorker.verified, { workerId, model: SUBSCRIPTION_MODEL });
  assert.ok(await t.mutation(internal.socialAgentWorker.claim, proof));
});

test("finishing an approved root releases serialization without changing approval", async () => {
  const t = setup();
  const runId = await localRun(t);
  const second = await localRun(t, "second-preview");
  await t.mutation(internal.socialAgentWorker.claim, proof);
  await assert.rejects(t.mutation(internal.socialAgentWorker.finish, { runId, claim: proof }));
  await t.run(ctx => ctx.db.patch(runId, { status: "ready" }));
  await t.mutation(internal.socialAgentWorker.finish, { runId, claim: proof });
  const receipt = await t.mutation(internal.socialAgentWorker.claim, { ...proof, token: "another123456789012345678901234567890" });
  assert.equal(receipt?.runId, second);
  assert.equal((await t.query(internal.socialAgent.context, { runId })).run.status, "ready");
});

test("offline preview jobs wait and cancelled claims reject generation", async () => {
  const t = setup();
  const preview = await localRun(t);
  await t.run(ctx => ctx.db.patch(preview, { createdAt: Date.now() - 86400000 }));
  assert.equal((await t.query(internal.socialAgent.context, { runId: preview })).run.status, "pending");
  assert.equal((await t.mutation(internal.socialAgentWorker.claim, proof))?.runId, preview);
  await t.run(ctx => ctx.db.patch(preview, { status: "cancelled" }));
  await assert.rejects(t.mutation(internal.socialAgent.reserve, { runId: preview, claim: proof, category: "fetch", key: "late" }));
});

test("offline live assignments miss their publication cutoff without being dispatched", async () => {
  const t = setup();
  await t.run(ctx => ctx.db.insert("socialAgentSettings", { key: "social", mode: "automatic", executionMode: LOCAL_EXECUTION, cutoverAt: 0, trialAccepted: true, updatedAt: Date.now() }));
  await t.mutation(internal.social.fill, {});
  const post = (await t.query(internal.socialAgent.snapshot, {})).posts[0];
  const runId = await t.mutation(internal.socialAgent.createRun, { requestId: "missed-live-slot", date: post.date, slot: post.slot!, assignmentId: post._id });
  await t.run(ctx => ctx.db.patch(post._id, { dueAt: Date.now() + 899000 }));
  await t.mutation(internal.socialAgentWorker.verified, { workerId, model: SUBSCRIPTION_MODEL });
  assert.equal(await t.mutation(internal.socialAgentWorker.claim, proof), null);
  const state = await t.query(internal.socialAgent.context, { runId });
  assert.equal(state.run.status, "failed");
  assert.equal(state.run.eveRunId, undefined);
  assert.match(state.run.error!, /cutoff/);
});

test("cutover requires a completed local preview and preserves publication settings", async () => {
  const t = setup();
  process.env.SOCIAL_OPERATOR_CLERK_IDS = "local-test-operator";
  const runId = await localRun(t);
  await t.run(ctx => ctx.db.insert("socialAgentSettings", { key: "social", mode: "preview", trialAccepted: false, experimentEndsAt: Date.now() + 86400000, updatedAt: Date.now() }));
  await assert.rejects(t.mutation(internal.socialAgentWorker.cutover, { workerId, operator: "local-test-operator" }));
  await t.mutation(internal.socialAgentWorker.claim, proof);
  await t.run(ctx => ctx.db.patch(runId, { status: "ready" }));
  await t.mutation(internal.socialAgentWorker.finish, { runId, claim: proof });
  const before = (await t.query(internal.socialAgent.snapshot, {})).settings!;
  await t.mutation(internal.socialAgentWorker.cutover, { workerId, operator: "local-test-operator" });
  const after = (await t.query(internal.socialAgent.snapshot, {})).settings!;
  assert.equal(after.executionMode, LOCAL_EXECUTION);
  assert.equal(after.mode, before.mode);
  assert.equal(after.trialAccepted, before.trialAccepted);
  assert.equal(after.experimentEndsAt, before.experimentEndsAt);
});

test("HTTP worker proof cannot be supplied in JSON or used with the hosted credential", async () => {
  const t = setup();
  const runId = await localRun(t);
  await t.mutation(internal.socialAgentWorker.claim, proof);
  process.env.SOCIAL_AGENT_WORKER_SECRET = "worker-secret-123456789012345678901234567890";
  process.env.SOCIAL_AGENT_SERVICE_SECRET = "hosted-secret-123456789012345678901234567890";
  const body = JSON.stringify({ op: "reserve", input: { runId, key: "http-attempt", category: "model", model: SUBSCRIPTION_MODEL, claim: proof } });
  const call = (secret: string, headers = {}) => t.fetch("/social-agent/bridge", { method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json", ...headers }, body });
  assert.equal((await call(process.env.SOCIAL_AGENT_SERVICE_SECRET)).status, 409);
  assert.equal((await call(process.env.SOCIAL_AGENT_WORKER_SECRET)).status, 409);
  assert.equal((await call(process.env.SOCIAL_AGENT_WORKER_SECRET, { "x-roofreply-worker": workerId, "x-roofreply-claim": proof.token })).status, 200);
});
