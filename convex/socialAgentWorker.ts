import { v } from "convex/values";
import { internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { agentSettings } from "./socialAgent";
import { claimHash, requireRunClaim, workerClaim } from "./socialAgentWorkerAuth";
import { GENERATION_DEADLINE_MS, LOCAL_EXECUTION, SUBSCRIPTION_MODEL, WORKER_OFFLINE_MS } from "../agents/social/src/local-worker";
import { socialSourceVersion } from "@roofreply/social-agent/content";

async function worker(ctx: MutationCtx, workerId: string) {
  if (!/^[a-zA-Z0-9-]{10,80}$/.test(workerId)) throw new Error("Invalid worker identity.");
  const row = await ctx.db.query("socialAgentWorkers").withIndex("by_worker", q => q.eq("workerId", workerId)).unique();
  if (row) return row;
  // This installation supports one registered Mac. Registration is explicit.
  if (await ctx.db.query("socialAgentWorkers").first()) throw new Error("Another Mac is already registered.");
  return (await ctx.db.get(await ctx.db.insert("socialAgentWorkers", { workerId, lastSeenAt: Date.now(), state: "starting" })))!;
}

export const heartbeat = internalMutation({
  args: { workerId: v.string(), problem: v.optional(v.string()) },
  handler: async (ctx, a) => {
    const row = await worker(ctx, a.workerId);
    await ctx.db.patch(row._id, {
      lastSeenAt: Date.now(),
      ...(a.problem ? { state: "blocked", error: a.problem.slice(0, 500) } : {}),
    });
    return { state: a.problem ? "blocked" : row.state };
  },
});

export const verified = internalMutation({
  args: { workerId: v.string(), model: v.string() },
  handler: async (ctx, a) => {
    if (a.model !== SUBSCRIPTION_MODEL) throw new Error("Unexpected subscription model.");
    const row = await worker(ctx, a.workerId);
    await ctx.db.patch(row._id, { verifiedAt: Date.now(), verifiedModel: a.model, lastSeenAt: Date.now(), state: "ready", error: undefined });
  },
});

async function expireRun(ctx: MutationCtx, run: Doc<"socialAgentRuns">, error: string) {
  await ctx.db.patch(run._id, { status: "failed", error, updatedAt: Date.now(), workerFinishedAt: Date.now() });
}

export const claim = internalMutation({
  args: { workerId: v.string(), token: v.string() },
  handler: async (ctx, a) => {
    if (!/^[a-zA-Z0-9-]{32,100}$/.test(a.token)) throw new Error("Invalid claim token.");
    const row = await worker(ctx, a.workerId);
    const settings = await agentSettings(ctx);
    if (!row.verifiedAt || row.verifiedModel !== SUBSCRIPTION_MODEL || row.state === "blocked" ||
        (settings?.workerId && settings.workerId !== a.workerId)) return null;
    if (settings?.experimentEndsAt && settings.experimentEndsAt <= Date.now()) return null;
    const hash = await claimHash(a.token);
    const runs = await ctx.db.query("socialAgentRuns").withIndex("by_created").collect();
    // A retry of a lost claim response returns the same receipt, never another job.
    const same = runs.find(r => r.workerId === a.workerId && r.claimHash === hash);
    if (same) return { runId: same._id, sessionId: same.eveRunId, status: same.status, deadline: same.dispatchUntil! };
    for (const run of runs) {
      if (run.executionMode !== LOCAL_EXECUTION || !["pending", "running", "rejected"].includes(run.status)) continue;
      const post = run.assignmentId ? await ctx.db.get(run.assignmentId) : null;
      if (run.dispatchUntil && run.dispatchUntil <= Date.now())
        await expireRun(ctx, run, "Local generation exceeded its 20-minute time window.");
      else if (run.assignmentId && (!post || !post.open || post.cancelRequested || post.content || post.dueAt <= Date.now() + 900000))
        await expireRun(ctx, run, "Local generation missed the publication cutoff or the assignment closed.");
    }
    // Re-read after expiry. Ready sessions retain exclusivity until the worker finishes its root turn.
    const current = await ctx.db.query("socialAgentRuns").withIndex("by_created").collect();
    if (current.some(r => r.dispatchUntil && r.dispatchUntil > Date.now() && !r.workerFinishedAt &&
      (r.executionMode === LOCAL_EXECUTION ? !["failed", "cancelled"].includes(r.status) : ["running", "rejected"].includes(r.status)))) return null;
    for (const run of current) {
      const local = run.executionMode === LOCAL_EXECUTION || (settings?.executionMode === LOCAL_EXECUTION && !run.dispatchUntil && !run.eveRunId);
      if (!local || run.status !== "pending" || run.dispatchUntil || run.eveRunId) continue;
      if (run.sourceVersion !== socialSourceVersion()) {
        await expireRun(ctx, run, "Assignment source is stale; request a new preview.");
        continue;
      }
      const post = run.assignmentId ? await ctx.db.get(run.assignmentId) : null;
      if (run.assignmentId && (!post || !post.open || post.cancelRequested || post.content || post.dueAt <= Date.now() + 900000)) {
        await expireRun(ctx, run, "Local generation missed the publication cutoff or the assignment closed.");
        continue;
      }
      if (run.assignmentId && settings?.mode !== "automatic") continue;
      const deadline = Math.min(Date.now() + GENERATION_DEADLINE_MS, post ? post.dueAt - 900000 : Infinity);
      await ctx.db.patch(run._id, { executionMode: LOCAL_EXECUTION, workerId: a.workerId, claimHash: hash, dispatchUntil: deadline, status: "running", updatedAt: Date.now() });
      await ctx.db.patch(row._id, { activeRunId: run._id, lastSeenAt: Date.now(), state: "running" });
      await ctx.scheduler.runAt(deadline, internal.socialAgentWorker.expire, { runId: run._id });
      return { runId: run._id, status: "running", deadline };
    }
    await ctx.db.patch(row._id, { state: "ready", activeRunId: undefined, lastSeenAt: Date.now() });
    return null;
  },
});

export const expire = internalMutation({
  args: { runId: v.id("socialAgentRuns") },
  handler: async (ctx, a) => {
    const run = await ctx.db.get(a.runId);
    if (run?.executionMode === LOCAL_EXECUTION && run.dispatchUntil && run.dispatchUntil <= Date.now() && ["pending", "running", "rejected"].includes(run.status))
      await expireRun(ctx, run, "Local generation exceeded its time window. Request a new revision; no duplicate session was started.");
  },
});

export const authorize = internalQuery({
  args: { runId: v.id("socialAgentRuns"), claim: workerClaim },
  handler: async (ctx, a) => {
    const run = await ctx.db.get(a.runId);
    if (!run) throw new Error("Unknown assignment.");
    await requireRunClaim(run, a.claim);
    return true;
  },
});

export const receipt = internalQuery({
  args: { workerId: v.string(), token: v.string() },
  handler: async (ctx, a) => {
    const hash = await claimHash(a.token);
    const run = (await ctx.db.query("socialAgentRuns").collect()).find(r => r.workerId === a.workerId && r.claimHash === hash);
    return run ? { runId: run._id, sessionId: run.eveRunId, status: run.status, deadline: run.dispatchUntil!, finished: !!run.workerFinishedAt } : null;
  },
});

export const finish = internalMutation({
  args: { runId: v.id("socialAgentRuns"), claim: workerClaim, error: v.optional(v.string()) },
  handler: async (ctx, a) => {
    const run = await ctx.db.get(a.runId);
    if (!run) throw new Error("Unknown assignment.");
    await requireRunClaim(run, a.claim);
    if (!a.error && !["ready", "accepted"].includes(run.status)) throw new Error("Run has no approved result.");
    await ctx.db.patch(run._id, { workerFinishedAt: Date.now(), ...(!["ready", "accepted"].includes(run.status) ? { status: "failed", error: a.error?.slice(0, 500), updatedAt: Date.now() } : {}) });
    const row = await worker(ctx, a.claim!.workerId);
    await ctx.db.patch(row._id, { activeRunId: undefined, ...(row.state !== "blocked" ? { state: "ready" } : {}) });
  },
});

export const cutover = internalMutation({
  args: { workerId: v.string(), operator: v.string() },
  handler: async (ctx, a) => {
    if (!(process.env.SOCIAL_OPERATOR_CLERK_IDS || "").split(",").map(x => x.trim()).includes(a.operator)) throw new Error("Forbidden.");
    const settings = await agentSettings(ctx);
    const row = await worker(ctx, a.workerId);
    if (!settings || !row.verifiedAt || row.verifiedModel !== SUBSCRIPTION_MODEL || row.verifiedAt < Date.now() - 86400000 || row.lastSeenAt < Date.now() - WORKER_OFFLINE_MS || row.state === "blocked") throw new Error("Verify the local worker before cutover.");
    const runs = await ctx.db.query("socialAgentRuns").collect();
    if (runs.some(r => r.executionMode !== LOCAL_EXECUTION && r.dispatchUntil && ["running", "rejected"].includes(r.status))) throw new Error("Wait for hosted sessions to settle.");
    const approved = runs.some(r => r.executionMode === LOCAL_EXECUTION && r.workerId === a.workerId && r.mode === "preview" && r.status === "ready" && r.workerFinishedAt && r.sourceVersion === socialSourceVersion());
    if (!approved) throw new Error("Complete a reviewed local preview before cutover.");
    await ctx.db.patch(settings._id, { executionMode: LOCAL_EXECUTION, workerId: a.workerId, updatedAt: Date.now() });
    return { executionMode: LOCAL_EXECUTION };
  },
});
