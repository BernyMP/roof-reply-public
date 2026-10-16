import { workerClaim, requireRunClaim } from "./socialAgentWorkerAuth";
import { LOCAL_EXECUTION, SUBSCRIPTION_MODEL } from "../agents/social/src/local-worker";
import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  contentSchema,
  socialSourceVersion,
  SOCIAL_SOURCES,
  SOCIAL_TOPICS,
  validateContent,
  phoenixDate,
} from "@roofreply/social-agent/content";
import {
  validatePreviewBrief,
  CREATIVE_VERSION,
  creativeBrief,
  creativeEvidenceCatalog,
  ideaHistory,
  validateCreativePlan,
  validateCreativeDraft,
  reviewChecksSchema,
  AGENT_LIMITS,
  dueAtForSlot,
  slotSchema,
  slotTopic,
  validateAgentDraft,
  assertRevisionReviewTarget,
  evidenceSchema,
  selectSlotLibraryContent,
  socialModelPolicy,
  editorialBrief,
  EXPERIMENT_BUDGET_USD,
  EXPERIMENT_DAYS,
} from "@roofreply/social-agent/agent-contract";
import { socialContent, socialQualityScores } from "./socialValidators";
import {
  SOCIAL_CONFIG,
  socialConfigurationErrors,
  socialConfigRevision,
} from "@roofreply/social-agent/config";

export async function agentSettings(ctx: QueryCtx | MutationCtx) {
  return await ctx.db
    .query("socialAgentSettings")
    .withIndex("by_key", (q) => q.eq("key", "social"))
    .unique();
}
async function currentRun(
  ctx: QueryCtx | MutationCtx,
  id: Id<"socialAgentRuns">,
) {
  const run = await ctx.db.get(id);
  if (!run) throw new Error("Run not found.");
  return run;
}
async function activeRun(
  ctx: QueryCtx | MutationCtx,
  id: Id<"socialAgentRuns">,
) {
  const run = await currentRun(ctx, id);
  if (
    !["pending", "running", "rejected"].includes(run.status) ||
    run.sourceVersion !== socialSourceVersion()
  )
    throw new Error("Run is stale or closed.");
  if (run.assignmentId) {
    const job = await ctx.db.get(run.assignmentId);
    if (
      !job ||
      !job.open ||
      job.cancelRequested ||
      job.content ||
      job.dueAt <= Date.now() + 900000
    )
      throw new Error("Assignment is no longer writable.");
    if ((await agentSettings(ctx))?.mode !== "automatic")
      throw new Error("Automatic generation paused.");
  }
  return run;
}
async function feedbackForRun(
  ctx: QueryCtx | MutationCtx,
  run: Doc<"socialAgentRuns">,
) {
  const lineage = new Set<Id<"socialAgentRuns">>([run._id]);
  let cursor = run;
  for (let depth = 0; depth < 10; depth++) {
    const match = /^(?:edit|revise)-([a-zA-Z0-9]+)-\d+$/.exec(cursor.requestId);
    const parentId = match && ctx.db.normalizeId("socialAgentRuns", match[1]);
    if (!parentId || lineage.has(parentId)) break;
    const parent = await ctx.db.get(parentId);
    if (!parent) break;
    lineage.add(parentId);
    cursor = parent;
  }
  const rows = await ctx.db
    .query("socialAgentFeedback")
    .withIndex("by_created")
    .order("desc")
    .take(100);
  return rows.filter((f) => !f.runId || lineage.has(f.runId)).slice(0, 20);
}
async function creativeHistory(
  ctx: QueryCtx | MutationCtx,
  run: { _id: Id<"socialAgentRuns">; assignmentId?: Id<"socialPosts"> },
) {
  const posts = await ctx.db
    .query("socialPosts")
    .withIndex("by_due")
    .order("desc")
    .collect();
  const published = posts
    .filter(
      (p) =>
        p._id !== run.assignmentId &&
        p.content &&
        (p.facebook.status === "sent" || p.instagram.status === "sent"),
    )
    .slice(0, 30);
  const queued = posts
    .filter(
      (p) =>
        p._id !== run.assignmentId &&
        p.content &&
        !p.cancelRequested &&
        p.facebook.status !== "sent" &&
        p.instagram.status !== "sent",
    )
    .slice(0, 30);
  const peers = (
    await ctx.db
      .query("socialAgentRuns")
      .withIndex("by_created")
      .order("desc")
      .collect()
  )
    .filter((r) => r._id !== run._id && r.status === "ready")
    .slice(0, 30);
  const drafts = (
    await Promise.all(
      peers.map((r) =>
        ctx.db
          .query("socialAgentDrafts")
          .withIndex("by_run", (q) =>
            q.eq("runId", r._id).eq("version", r.version),
          )
          .unique(),
      ),
    )
  ).filter((d) => d !== null);
  return {
    published: published.map((p) =>
      ideaHistory(p._id, p.dueAt, contentSchema.parse(p.content)),
    ),
    planned: [
      ...queued.map((p) =>
        ideaHistory(p._id, p.dueAt, contentSchema.parse(p.content)),
      ),
      ...drafts.map((d) =>
        ideaHistory(d.runId, d.createdAt, contentSchema.parse(d.content)),
      ),
    ]
      .sort((a, b) => b.at - a.at)
      .slice(0, 30),
  };
}
export const context = internalQuery({
  args: { runId: v.id("socialAgentRuns") },
  handler: async (ctx, { runId }) => {
    const run = await currentRun(ctx, runId);
    const history = await creativeHistory(ctx, run);
    const drafts = await ctx.db
      .query("socialAgentDrafts")
      .withIndex("by_run", (q) => q.eq("runId", runId))
      .collect();
    const posts = await ctx.db
      .query("socialPosts")
      .withIndex("by_due", (q) =>
        q.gte("dueAt", dueAtForSlot(run.date, run.slot) - 30 * 86400000),
      )
      .collect();
    const peers = await ctx.db
      .query("socialAgentRuns")
      .withIndex("by_created", (q) =>
        q.gte("createdAt", Date.now() - 30 * 86400000),
      )
      .collect();
    const peerDrafts = (
      await Promise.all(
        peers
          .filter(
            (r) =>
              r._id !== runId && r.mode === run.mode && r.status === "ready",
          )
          .map((r) =>
            ctx.db
              .query("socialAgentDrafts")
              .withIndex("by_run", (q) =>
                q.eq("runId", r._id).eq("version", r.version),
              )
              .unique(),
          ),
      )
    ).filter(Boolean);
    return {
      run: { ...run, claimHash: undefined },
      drafts,
      preferences: await ctx.db
        .query("socialAgentPreferences")
        .withIndex("by_version")
        .order("desc")
        .first(),
      facts: SOCIAL_SOURCES,
      topic: slotTopic(run.date, run.slot),
      brief: editorialBrief(
        run.date,
        run.slot,
        slotTopic(run.date, run.slot),
        run.mode === "publish" && (await agentSettings(ctx))?.postsPerDay === 1
          ? 1
          : 2,
      ),
      recentDesigns: [
        ...posts.map((p) => p.content?.graphic.design),
        ...peerDrafts.map((d) => d?.content.graphic.design),
      ].filter(Boolean),
      recentIdeas: history.published,
      plannedIdeas: history.planned,
      evidenceCatalog: creativeEvidenceCatalog,
      creativeBrief:
        run.editorialVersion === CREATIVE_VERSION
          ? { ...creativeBrief(run.date, run.slot), ...run.creativeBrief }
          : null,
      recentHooks: [
        ...posts
          .filter((p) => p._id !== run.assignmentId)
          .flatMap((p) =>
            p.content ? [p.content.hook, p.content.graphic.headline] : [],
          ),
        ...peerDrafts.flatMap((d) =>
          d ? [d.content.hook, d.content.graphic.headline] : [],
        ),
      ],
      feedback: await feedbackForRun(ctx, run),
      research: await ctx.db
        .query("socialAgentResearch")
        .withIndex("by_date", (q) => q.eq("date", run.date))
        .collect(),
      insights: await ctx.db.query("socialAgentInsights").order("desc").take(4),
    };
  },
});
export const plan = internalMutation({
  args: {
    claim: workerClaim,
    runId: v.id("socialAgentRuns"),
    expectedVersion: v.number(),
    plan: v.any(),
  },
  handler: async (ctx, a) => {
    await requireRunClaim(await currentRun(ctx, a.runId), a.claim);
    const run = await activeRun(ctx, a.runId);
    if (
      run.editorialVersion !== CREATIVE_VERSION ||
      run.version !== a.expectedVersion ||
      run.version >= AGENT_LIMITS.maxDrafts
    )
      throw new Error("Plan version conflict or closed run.");
    const history = await creativeHistory(ctx, run);
    const research = await ctx.db
      .query("socialAgentResearch")
      .withIndex("by_date", (q) => q.eq("date", run.date))
      .collect();
    const plan = validateCreativePlan(
      a.plan,
      [...history.published, ...history.planned],
      research.filter((r) => r.kind === "page").map((r) => r.data.url),
      run.creativeBrief?.stage === "onboarding",
    );
    const brief = {
      ...creativeBrief(run.date, run.slot),
      ...run.creativeBrief,
    };
    if (plan.candidates[plan.selected].stage !== brief.stage)
      throw new Error("Selected audience stage must match the assignment.");
    const key = `${run.date}:plan:${run._id}:${run.version + 1}`;
    const old = await ctx.db
      .query("socialAgentResearch")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (old) await ctx.db.patch(old._id, { data: plan });
    else
      await ctx.db.insert("socialAgentResearch", {
        date: run.date,
        key,
        kind: "plan",
        data: plan,
        createdAt: Date.now(),
      });
    return plan;
  },
});
export const reserve = internalMutation({
  args: {
    claim: workerClaim,
    runId: v.id("socialAgentRuns"),
    key: v.string(),
    category: v.union(
      v.literal("model"),
      v.literal("search"),
      v.literal("fetch"),
    ),
    model: v.optional(v.string()),
    role: v.optional(v.union(v.literal("writer"), v.literal("reviewer"), v.literal("research"))),
  },
  handler: async (ctx, args) => {
    await requireRunClaim(await currentRun(ctx, args.runId), args.claim);
    const stored = await currentRun(ctx, args.runId);
    const settings = await agentSettings(ctx);
    if (settings?.experimentEndsAt && Date.now() >= settings.experimentEndsAt)
      throw new Error("The two-week experiment has ended.");
    const finalization =
      args.category === "model" &&
      ["ready", "accepted"].includes(stored.status) &&
      stored.sourceVersion === socialSourceVersion();
    const run = finalization ? stored : await activeRun(ctx, args.runId);
    const key = `${args.runId}:${args.category}:${args.key.slice(0, 200)}`;
    const existing = await ctx.db
      .query("socialAgentUsage")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    // A transport attempt must never reuse a spent authorization after a crash.
    if (existing) throw new Error("Usage reservation already consumed.");
    const month = new Date().toISOString().slice(0, 7);
    const category = args.category;
    const rows = await ctx.db
      .query("socialAgentUsage")
      .withIndex("by_month", (q) =>
        q.eq("month", month).eq("category", category),
      )
      .collect();
    const subscription = run.executionMode === LOCAL_EXECUTION;
    if (subscription && category === "model" && args.model !== SUBSCRIPTION_MODEL)
      throw new Error("Unapproved subscription model.");
    const amount = subscription ? 0 :
      category === "model"
        ? socialModelPolicy(args.model).reserveUsd
        : category === "search"
          ? AGENT_LIMITS.searchCallUsd
          : 0;
    const cap =
      category === "model"
        ? settings?.experimentStartedAt
          ? 23
          : AGENT_LIMITS.modelMonthlyUsd
        : AGENT_LIMITS.searchMonthlyUsd;
    if (!subscription && settings?.experimentStartedAt) {
      const usage = await ctx.db.query("socialAgentUsage").collect();
      const total = usage
        .filter((r) => r.createdAt >= settings.experimentStartedAt!)
        .reduce((sum, r) => sum + (r.actualUsd ?? r.reservedUsd), 0);
      if (
        total + amount >
        Math.min(settings.experimentBudgetUsd ?? 0, EXPERIMENT_BUDGET_USD)
      )
        throw new Error("Two-week experiment budget exhausted.");
    }
    if (
      !subscription && rows.reduce((sum, r) => sum + (r.actualUsd ?? r.reservedUsd), 0) +
        amount >
      cap
    )
      throw new Error("Monthly budget exhausted.");
    const runUsage = await ctx.db
      .query("socialAgentUsage")
      .withIndex("by_run", (q) => q.eq("runId", args.runId))
      .collect();
    if (subscription && category === "model") {
      const models = runUsage.filter(r => r.category === "model");
      if (models.some(r => r.actualUsd === undefined)) throw new Error("Previous model usage is unsettled; inspect the interrupted run.");
      const input = models.reduce((n, r) => n + (r.inputTokens ?? 0), 0);
      const output = models.reduce((n, r) => n + (r.outputTokens ?? 0), 0);
      if (input >= 400000 || output >= 20000)
        throw new Error("Subscription session token allowance reached.");
    }
    if (finalization && runUsage.filter((r) => r.finalization).length >= 3)
      throw new Error("Final response limit reached.");
    if (
      category === "model" &&
      runUsage.filter((r) => r.category === "model").length >=
        AGENT_LIMITS.maxModelCalls
    )
      throw new Error("Run model-call limit reached.");
    if (category !== "model") {
      const today = Date.now() - 86400000;
      const daily = await ctx.db.query("socialAgentUsage").collect();
      if (
        daily.filter((r) => r.category === category && r.createdAt >= today)
          .length >= (category === "search" ? 3 : 5)
      )
        throw new Error("Daily research limit reached.");
    }
    const notBefore =
      category === "model"
        ? Math.max(
            Date.now(),
            ...rows.map((r) => (r.notBefore ?? r.createdAt) + 20000),
          )
        : Date.now();
    const id = await ctx.db.insert("socialAgentUsage", {
      key,
      runId: args.runId,
      category,
      month,
      reservedUsd: amount,
      ...(subscription ? { billing: "chatgpt-subscription" as const, model: args.model, role: args.role } : {}),
      finalization,
      notBefore,
      createdAt: Date.now(),
    });
    await ctx.db.patch(run._id, {
      status: finalization ? run.status : "running",
      updatedAt: Date.now(),
    });
    return { id, reservedUsd: amount, notBefore };
  },
});
export const settle = internalMutation({
  args: { id: v.id("socialAgentUsage"), actualUsd: v.number(), claim: workerClaim,
    inputTokens: v.optional(v.number()), outputTokens: v.optional(v.number()) },
  handler: async (ctx, { id, actualUsd, claim, inputTokens, outputTokens }) => {
    const row = await ctx.db.get(id);
    if (!row) throw new Error("Usage not found.");
    await requireRunClaim(await currentRun(ctx, row.runId), claim);
    if (row.actualUsd !== undefined) return;
    if (!Number.isFinite(actualUsd) || actualUsd < 0 || actualUsd > row.reservedUsd ||
      [inputTokens, outputTokens].some(n => n !== undefined && (!Number.isSafeInteger(n) || n < 0)))
      throw new Error("Invalid usage.");
    await ctx.db.patch(id, { actualUsd, inputTokens, outputTokens });
  },
});
export const saveDraft = internalMutation({
  args: {
    claim: workerClaim,
    runId: v.id("socialAgentRuns"),
    expectedVersion: v.number(),
    content: socialContent,
    imageId: v.id("_storage"),
    imageHash: v.string(),
  },
  handler: async (ctx, args) => {
    await requireRunClaim(await currentRun(ctx, args.runId), args.claim);
    const run = await activeRun(ctx, args.runId);
    const content = validateAgentDraft(
      run.editorialVersion === CREATIVE_VERSION
        ? { ...args.content, topic: slotTopic(run.date, run.slot) }
        : args.content,
    );
    const prior = await ctx.db
      .query("socialAgentDrafts")
      .withIndex("by_run", (q) =>
        q.eq("runId", run._id).eq("version", args.expectedVersion + 1),
      )
      .unique();
    if (
      prior &&
      prior.imageHash === args.imageHash &&
      JSON.stringify(contentSchema.parse(prior.content)) ===
        JSON.stringify(content)
    )
      return prior;
    if (
      run.version !== args.expectedVersion ||
      run.version >= AGENT_LIMITS.maxDrafts
    )
      throw new Error("Draft version conflict or revision limit.");
    if (run.version > 0) {
      const current = await ctx.db
        .query("socialAgentDrafts")
        .withIndex("by_run", (q) =>
          q.eq("runId", run._id).eq("version", run.version),
        )
        .unique();
      if (!current?.review)
        throw new Error(
          "Review the current saved draft before writing another version.",
        );
      if (current.review.approved && !run.requestId.startsWith("revise-"))
        throw new Error(
          "An approved draft needs an explicit operator revision request.",
        );
    }
    if (run.editorialVersion === CREATIVE_VERSION) {
      const saved = await ctx.db
        .query("socialAgentResearch")
        .withIndex("by_key", (q) =>
          q.eq("key", `${run.date}:plan:${run._id}:${run.version + 1}`),
        )
        .unique();
      if (!saved)
        throw new Error(
          "Save three candidate ideas and the selected plan before drafting.",
        );
      validateCreativeDraft(content, saved.data);
    }
    if (
      (await agentSettings(ctx))?.experimentStartedAt &&
      (!content.graphic.design || !content.action)
    )
      throw new Error(
        "Experiment drafts require an editorial design and audience action.",
      );
    if (content.topic !== slotTopic(run.date, run.slot))
      throw new Error("Draft must follow assigned topic.");
    const id = await ctx.db.insert("socialAgentDrafts", {
      runId: run._id,
      version: run.version + 1,
      content,
      imageId: args.imageId,
      imageHash: args.imageHash,
      createdAt: Date.now(),
    });
    await ctx.db.patch(run._id, {
      version: run.version + 1,
      status: "running",
      updatedAt: Date.now(),
    });
    return await ctx.db.get(id);
  },
});
export const inspected = internalMutation({
  args: {
    claim: workerClaim,
    runId: v.id("socialAgentRuns"),
    version: v.number(),
    sessionId: v.string(),
  },
  handler: async (ctx, a) => {
    await requireRunClaim(await currentRun(ctx, a.runId), a.claim);
    const run = await activeRun(ctx, a.runId);
    if (run.version !== a.version) throw new Error("Stale preview.");
    const draft = await ctx.db
      .query("socialAgentDrafts")
      .withIndex("by_run", (q) =>
        q.eq("runId", a.runId).eq("version", a.version),
      )
      .unique();
    if (!draft) throw new Error("Missing draft.");
    await ctx.db.patch(draft._id, { inspectedBy: a.sessionId });
  },
});
export const review = internalMutation({
  args: {
    claim: workerClaim,
    runId: v.id("socialAgentRuns"),
    version: v.number(),
    approved: v.boolean(),
    reason: v.string(),
    sessionId: v.string(),
    scores: v.optional(socialQualityScores),
    checks: v.optional(v.any()),
  },
  handler: async (ctx, a) => {
    await requireRunClaim(await currentRun(ctx, a.runId), a.claim);
    const run = await currentRun(ctx, a.runId);
    assertRevisionReviewTarget(run.requestId, a.version);
    const draft = await ctx.db
      .query("socialAgentDrafts")
      .withIndex("by_run", (q) =>
        q.eq("runId", a.runId).eq("version", a.version),
      )
      .unique();
    if (draft?.review && run.version === a.version) return draft.review;
    await activeRun(ctx, a.runId);
    if (
      !draft ||
      run.version !== a.version ||
      draft.inspectedBy !== a.sessionId ||
      a.sessionId === run.eveRunId
    )
      throw new Error("Independent current-preview review required.");
    if (!a.reason.trim() || a.reason.length > 1500)
      throw new Error("Review reason required.");
    if (
      a.scores &&
      Object.values(a.scores).some(
        (score) => !Number.isInteger(score) || score < 1 || score > 5,
      )
    )
      throw new Error("Invalid quality scores.");
    if (
      a.approved &&
      draft.content.graphic.design &&
      (!a.scores || Object.values(a.scores).some((score) => score < 4))
    )
      throw new Error(
        "Editorial approval requires all five quality scores of at least four.",
      );
    const validated = validateAgentDraft(draft.content);
    if (run.editorialVersion === CREATIVE_VERSION) {
      const checks = reviewChecksSchema.parse(a.checks);
      if (a.approved && Object.values(checks).some((c) => !c.pass))
        throw new Error(
          "Every editorial criterion must pass; scores cannot override a failure.",
        );
      if (!validated.editorial) throw new Error("Missing editorial plan.");
      validateCreativeDraft(validated, validated.editorial);
    }
    const posts = await ctx.db
      .query("socialPosts")
      .withIndex("by_due", (q) =>
        q.gte("dueAt", dueAtForSlot(run.date, run.slot) - 30 * 86400000),
      )
      .collect();
    const peers = await ctx.db
      .query("socialAgentRuns")
      .withIndex("by_created", (q) =>
        q.gte("createdAt", Date.now() - 30 * 86400000),
      )
      .collect();
    const hooks = posts
      .filter((p) => p._id !== run.assignmentId)
      .flatMap((p) =>
        p.content ? [p.content.hook, p.content.graphic.headline] : [],
      );
    for (const peer of peers.filter(
      (p) => p._id !== run._id && p.mode === run.mode && p.status === "ready",
    )) {
      const d = await ctx.db
        .query("socialAgentDrafts")
        .withIndex("by_run", (q) =>
          q.eq("runId", peer._id).eq("version", peer.version),
        )
        .unique();
      if (d) hooks.push(d.content.hook, d.content.graphic.headline);
    }
    if (a.approved) validateContent(draft.content, hooks);
    const review = {
      approved: a.approved,
      reason: a.reason,
      sessionId: a.sessionId,
      ...(a.scores ? { scores: a.scores } : {}),
      ...(a.checks ? { checks: reviewChecksSchema.parse(a.checks) } : {}),
    };
    await ctx.db.patch(draft._id, { review });
    await ctx.db.patch(run._id, {
      status: a.approved
        ? "ready"
        : run.version >= AGENT_LIMITS.maxDrafts
          ? "failed"
          : "rejected",
      error: a.approved ? undefined : a.reason.slice(0, 500),
      updatedAt: Date.now(),
    });
    return review;
  },
});
export const research = internalMutation({
  args: {
    claim: workerClaim,
    runId: v.id("socialAgentRuns"),
    key: v.string(),
    kind: v.string(),
    data: v.any(),
  },
  handler: async (ctx, a) => {
    await requireRunClaim(await currentRun(ctx, a.runId), a.claim);
    const run = await activeRun(ctx, a.runId);
    if (
      !["search", "page", "brief"].includes(a.kind) ||
      JSON.stringify(a.data).length > 20000
    )
      throw new Error("Invalid research.");
    if (a.kind === "page") evidenceSchema.parse(a.data);
    if (a.kind === "brief") {
      if (
        typeof a.data.angle !== "string" ||
        a.data.angle.length > 1200 ||
        !Array.isArray(a.data.urls) ||
        a.data.urls.length > 5
      )
        throw new Error("Invalid brief.");
      const pages = await ctx.db
        .query("socialAgentResearch")
        .withIndex("by_date", (q) => q.eq("date", run.date))
        .collect();
      if (
        a.data.urls.some(
          (url: string) =>
            !pages.some((p) => p.kind === "page" && p.data.url === url),
        )
      )
        throw new Error("Brief must reference retained evidence.");
    }
    const key = `${run.date}:${a.kind === "brief" ? "daily-brief" : a.key}`;
    const existing = await ctx.db
      .query("socialAgentResearch")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (existing) return existing;
    const id = await ctx.db.insert("socialAgentResearch", {
      date: run.date,
      key,
      kind: a.kind,
      data: a.data,
      createdAt: Date.now(),
    });
    return ctx.db.get(id);
  },
});
export const event = internalMutation({
  args: {
    claim: workerClaim,
    runId: v.id("socialAgentRuns"),
    key: v.string(),
    kind: v.string(),
    summary: v.string(),
  },
  handler: async (ctx, a) => {
    await requireRunClaim(await currentRun(ctx, a.runId), a.claim);
    await currentRun(ctx, a.runId);
    const key = `${a.runId}:${a.key.slice(0, 200)}`;
    if (
      await ctx.db
        .query("socialAgentEvents")
        .withIndex("by_key", (q) => q.eq("key", key))
        .unique()
    )
      return;
    await ctx.db.insert("socialAgentEvents", {
      runId: a.runId,
      kind: a.kind,
      key,
      summary: a.summary.slice(0, 2000),
      createdAt: Date.now(),
    });
  },
});
export const dispatch = internalMutation({
  args: {
    claim: workerClaim,
    runId: v.id("socialAgentRuns"),
    eveRunId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    const run = await currentRun(ctx, a.runId);
    if (a.eveRunId || a.claim) await requireRunClaim(run, a.claim);
    if (a.eveRunId) {
      if (
        ["cancelled", "failed"].includes(run.status) ||
        (run.status === "accepted" && run.eveRunId !== a.eveRunId)
      )
        throw new Error("Run is closed.");
      if (run.eveRunId && run.eveRunId !== a.eveRunId)
        throw new Error("Run already bound.");
      await ctx.db.patch(run._id, {
        eveRunId: a.eveRunId,
        updatedAt: Date.now(),
      });
      return true;
    }
    if (a.error) {
      if (!["ready", "cancelled", "accepted"].includes(run.status))
        await ctx.db.patch(run._id, {
          status: "failed",
          error: run.error ?? a.error.slice(0, 500),
          updatedAt: Date.now(),
        });
      return false;
    }
    if (run.executionMode === LOCAL_EXECUTION || (await agentSettings(ctx))?.executionMode === LOCAL_EXECUTION) return false;
    if (
      run.eveRunId ||
      run.dispatchUntil ||
      !["pending", "running", "rejected"].includes(run.status)
    )
      return false;
    await activeRun(ctx, run._id);
    // Serialize generation, including bulk preview trials, so the shared model
    // allowance is not consumed by a burst of concurrent sessions. Publishing
    // leases are independent and remain released throughout this queue.
    const others = await ctx.db.query("socialAgentRuns").collect();
    if (
      others.some(
        (other) =>
          other._id !== run._id &&
          other.dispatchUntil &&
          ["running", "rejected"].includes(other.status) &&
          other.updatedAt > Date.now() - 20 * 60000,
      )
    )
      return "queued";
    await ctx.db.patch(run._id, {
      dispatchUntil: Date.now() + 3600000,
      status: "running",
      updatedAt: Date.now(),
    });
    return true;
  },
});
export const createRun = internalMutation({
  args: {
    requestId: v.string(),
    date: v.string(),
    slot: v.union(v.literal("morning"), v.literal("afternoon")),
    assignmentId: v.optional(v.id("socialPosts")),
    trial: v.optional(v.boolean()),
  },
  handler: async (ctx, a) => {
    dueAtForSlot(a.date, a.slot);
    const old = await ctx.db
      .query("socialAgentRuns")
      .withIndex("by_request", (q) => q.eq("requestId", a.requestId))
      .unique();
    if (old) return old._id;
    if (a.assignmentId) {
      const existing = await ctx.db
        .query("socialAgentRuns")
        .withIndex("by_assignment", (q) => q.eq("assignmentId", a.assignmentId))
        .unique();
      if (existing) return existing._id;
      const job = await ctx.db.get(a.assignmentId);
      if (
        !job ||
        job.engine !== "eve" ||
        job.date !== a.date ||
        job.slot !== a.slot ||
        job.content ||
        job.cancelRequested
      )
        throw new Error("Invalid assignment.");
    }
    const id = await ctx.db.insert("socialAgentRuns", {
      ...a,
      executionMode: (await agentSettings(ctx))?.executionMode ?? "hosted",
      editorialVersion: CREATIVE_VERSION,
      trial: a.trial ?? false,
      mode: a.assignmentId ? "publish" : "preview",
      sourceVersion: socialSourceVersion(),
      status: "pending",
      version: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return id;
  },
});
export const snapshot = internalQuery({
  args: {},
  handler: async (ctx) => {
    const runs = await ctx.db
      .query("socialAgentRuns")
      .withIndex("by_created")
      .order("desc")
      .take(80);
    const settings = await agentSettings(ctx);
    return {
      settings,
      workers: await ctx.db.query("socialAgentWorkers").collect(),
      preferences: await ctx.db
        .query("socialAgentPreferences")
        .withIndex("by_version")
        .order("desc")
        .take(10),
      runs: runs.map(r => ({ ...r, claimHash: undefined })),
      drafts: (
        await Promise.all(
          runs.map((r) =>
            ctx.db
              .query("socialAgentDrafts")
              .withIndex("by_run", (q) => q.eq("runId", r._id))
              .collect(),
          ),
        )
      ).flat(),
      posts: await ctx.db
        .query("socialPosts")
        .withIndex("by_due")
        .order("desc")
        .take(60),
      feedback: await ctx.db
        .query("socialAgentFeedback")
        .withIndex("by_created")
        .order("desc")
        .take(30),
      usage: settings?.experimentStartedAt
        ? (await ctx.db.query("socialAgentUsage").collect()).filter(
            (u) => u.createdAt >= settings.experimentStartedAt!,
          )
        : await ctx.db
            .query("socialAgentUsage")
            .withIndex("by_month", (q) =>
              q.eq("month", new Date().toISOString().slice(0, 7)),
            )
            .collect(),
      metrics: await ctx.db.query("socialAgentMetrics").order("desc").take(120),
      insights: await ctx.db.query("socialAgentInsights").order("desc").take(4),
      events: (
        await Promise.all(
          runs.slice(0, 20).map((r) =>
            ctx.db
              .query("socialAgentEvents")
              .withIndex("by_run", (q) => q.eq("runId", r._id))
              .collect(),
          ),
        )
      ).flat(),
      research: await ctx.db
        .query("socialAgentResearch")
        .order("desc")
        .take(50),
    };
  },
});
export const control = internalMutation({
  args: { op: v.string(), input: v.any(), operator: v.string() },
  handler: async (ctx, { op, input, operator }) => {
    if (
      !(process.env.SOCIAL_OPERATOR_CLERK_IDS || "")
        .split(",")
        .map((x) => x.trim())
        .includes(operator)
    )
      throw new Error("Forbidden.");
    if (op === "prepare-experiment") {
      const settings = await agentSettings(ctx);
      if (settings?.experimentStartedAt) return settings;
      if (settings?.mode === "automatic")
        throw new Error("Pause before preparing a new experiment.");
      const value = {
        key: "social",
        mode: "preview",
        trialAccepted: false,
        experimentStartedAt: Date.now(),
        experimentBudgetUsd: EXPERIMENT_BUDGET_USD,
        postsPerDay: 1,
        updatedAt: Date.now(),
      };
      if (settings) {
        await ctx.db.patch(settings._id, value);
        return ctx.db.get(settings._id);
      }
      return ctx.db.get(await ctx.db.insert("socialAgentSettings", value));
    }
    if (op === "scope-feedback") {
      const id = ctx.db.normalizeId("socialAgentFeedback", input.id);
      const runId = ctx.db.normalizeId("socialAgentRuns", input.runId);
      if (!id || !runId || !(await ctx.db.get(id)))
        throw new Error("Feedback and assignment required.");
      await currentRun(ctx, runId);
      await ctx.db.patch(id, { runId });
      return id;
    }
    if (op === "feedback") {
      if (
        typeof input.text !== "string" ||
        !input.text.trim() ||
        input.text.length > 2000
      )
        throw new Error("Feedback must be 1–2000 characters.");
      const runId = input.runId
        ? ctx.db.normalizeId("socialAgentRuns", input.runId)
        : null;
      if (input.runId && !runId)
        throw new Error("Invalid feedback assignment.");
      if (runId) await currentRun(ctx, runId);
      return ctx.db.insert("socialAgentFeedback", {
        ...(runId ? { runId } : {}),
        text: input.text,
        operator,
        createdAt: Date.now(),
      });
    }
    if (op === "publish" || op === "publish-fallback") {
      // Explicit operator publication of one reviewed preview does not enable
      // recurring generation or accept the separate fourteen-pair trial.
      const id = ctx.db.normalizeId("socialAgentRuns", input.id);
      if (!id) throw new Error("Invalid run.");
      const run = await currentRun(ctx, id);
      const fallback = op === "publish-fallback";
      if (fallback && run.editorialVersion === CREATIVE_VERSION)
        throw new Error(
          "Editorial failures cannot publish library substitutes.",
        );
      if (
        run.assignmentId &&
        (fallback ? run.status === "failed" : run.status === "accepted")
      )
        return run.assignmentId;
      const dueAt = input.dueAt;
      if (
        !SOCIAL_CONFIG.enabled ||
        socialConfigurationErrors().length ||
        run.mode !== "preview" ||
        run.status !== (fallback ? "failed" : "ready") ||
        !run.eveRunId ||
        run.assignmentId ||
        run.sourceVersion !== socialSourceVersion() ||
        typeof dueAt !== "number" ||
        !Number.isFinite(dueAt) ||
        dueAt <= Date.now() + 900000 ||
        dueAt > Date.now() + 86400000 ||
        phoenixDate(dueAt) !== run.date
      )
        throw new Error(
          "A current approved preview (or failed run for library fallback) and a future publishing time are required.",
        );
      const draft = await ctx.db
        .query("socialAgentDrafts")
        .withIndex("by_run", (q) =>
          q.eq("runId", id).eq("version", run.version),
        )
        .unique();
      if (
        !fallback &&
        (!draft?.review?.approved ||
          draft.inspectedBy !== draft.review.sessionId ||
          draft.review.sessionId === run.eveRunId ||
          !(await ctx.db.system.get(draft.imageId)))
      )
        throw new Error(
          "Independent review of the current saved image is required.",
        );
      const sameDay = await ctx.db
        .query("socialPosts")
        .withIndex("by_date", (q) => q.eq("date", run.date))
        .collect();
      if (sameDay.some((p) => (p.slot ?? "morning") === run.slot))
        throw new Error("This publishing slot is already reserved.");
      const recent = await ctx.db
        .query("socialPosts")
        .withIndex("by_due", (q) => q.gte("dueAt", dueAt - 30 * 86400000))
        .collect();
      const previous = recent.flatMap((p) =>
        p.content ? [p.content.hook, p.content.graphic.headline] : [],
      );
      // Fallback never reuses rejected agent content or its approval/image.
      // The selector enforces the reviewed source version and 30-day exclusion.
      const content = fallback
        ? selectSlotLibraryContent(run.date, run.slot, previous)
        : validateAgentDraft(draft!.content, previous);
      const now = Date.now();
      const assignmentId = await ctx.db.insert("socialPosts", {
        date: run.date,
        slot: run.slot,
        engine: "eve",
        dueAt,
        sourceVersion: run.sourceVersion,
        configRevision: socialConfigRevision(),
        organizationId: SOCIAL_CONFIG.organizationId,
        facebookChannelId: SOCIAL_CONFIG.facebookChannelId,
        instagramChannelId: SOCIAL_CONFIG.instagramChannelId,
        content,
        ...(!fallback ? { imageId: draft!.imageId } : {}),
        generationAttempts: 0,
        facebook: { status: "pending", attempts: 0 },
        instagram: { status: "pending", attempts: 0 },
        open: true,
        cancelRequested: false,
        nextCheckAt: now,
        leaseUntil: 0,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.patch(id, {
        assignmentId,
        mode: "publish",
        status: fallback ? "failed" : "accepted",
        updatedAt: now,
      });
      await ctx.db.insert("socialAgentEvents", {
        runId: id,
        key: `operator-publication:${id}`,
        kind: fallback ? "publication.fallback" : "publication.requested",
        summary: fallback
          ? "Operator requested an eligible approved-library fallback after generation failed. The rejected draft remains unpublished."
          : "Operator requested publication of the independently approved preview through the existing publisher.",
        createdAt: now,
      });
      await ctx.scheduler.runAfter(0, internal.socialActions.process, {
        id: assignmentId,
      });
      return assignmentId;
    }
    if (op === "cancel") {
      const id = ctx.db.normalizeId("socialPosts", input.id);
      if (!id) throw new Error("Invalid post.");
      const post = await ctx.db.get(id);
      if (!post) throw new Error("Post missing.");
      await ctx.db.patch(id, {
        cancelRequested: true,
        open: true,
        nextCheckAt: Date.now(),
      });
      await ctx.scheduler.runAfter(0, internal.socialActions.process, { id });
      return true;
    }
    if (op === "preview") {
      if (!(await agentSettings(ctx)))
        await ctx.db.insert("socialAgentSettings", {
          key: "social",
          mode: "preview",
          trialAccepted: false,
          updatedAt: Date.now(),
        });
      const date = String(input.date);
      const slot = slotSchema.parse(input.slot);
      dueAtForSlot(date, slot);
      const requestId = String(input.requestId);
      if (!/^[a-zA-Z0-9-]{8,100}$/.test(requestId))
        throw new Error("Invalid request ID.");
      const existing = await ctx.db
        .query("socialAgentRuns")
        .withIndex("by_request", (q) => q.eq("requestId", requestId))
        .unique();
      if (existing) return existing._id;
      const id = await ctx.db.insert("socialAgentRuns", {
        executionMode: input.executionMode === LOCAL_EXECUTION ? LOCAL_EXECUTION : (await agentSettings(ctx))?.executionMode ?? "hosted",
        requestId,
        editorialVersion: CREATIVE_VERSION,
        ...(input.creativeBrief
          ? { creativeBrief: validatePreviewBrief(input.creativeBrief) }
          : {}),
        date,
        slot,
        mode: "preview",
        sourceVersion: socialSourceVersion(),
        status: "pending",
        version: 0,
        trial: input.trial === true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.scheduler.runAfter(0, internal.socialAgentActions.start, {
        runId: id,
      });
      return id;
    }
    if (op === "revise" || op === "edit") {
      const id = ctx.db.normalizeId("socialAgentRuns", input.id);
      if (!id) throw new Error("Invalid run.");
      const run = await currentRun(ctx, id);
      if (
        run.version >= 3 ||
        !["ready", "failed", "rejected", "accepted"].includes(run.status)
      )
        throw new Error(
          "Only settled drafts below the revision limit may be revised.",
        );
      const job = run.assignmentId ? await ctx.db.get(run.assignmentId) : null;
      if (
        run.mode === "publish" &&
        (!job ||
          !job.open ||
          job.cancelRequested ||
          job.leaseUntil > Date.now() ||
          job.dueAt <= Date.now() + 900000 ||
          [job.facebook, job.instagram].some(
            (d) => d.attempts > 0 || d.id || d.status !== "pending",
          ))
      )
        throw new Error(
          "The publishing worker has started; use cancellation for queued posts.",
        );
      if (op === "edit" && run.version !== input.expectedVersion)
        throw new Error("Draft changed while editing.");
      const edited =
        op === "edit" ? validateAgentDraft(input.content) : undefined;
      const imageId =
        op === "edit" && typeof input.imageId === "string"
          ? (input.imageId as Id<"_storage">)
          : null;
      if (imageId && !(await ctx.db.system.get(imageId)))
        throw new Error("Image missing.");
      if (
        edited &&
        (edited.topic !== slotTopic(run.date, run.slot) ||
          !imageId ||
          typeof input.imageHash !== "string")
      )
        throw new Error("Invalid edited preview.");
      // A new identity fences off callbacks and reservations from the previous session.
      const nextId = await ctx.db.insert("socialAgentRuns", {
        executionMode: input.executionMode === LOCAL_EXECUTION ? LOCAL_EXECUTION : (await agentSettings(ctx))?.executionMode ?? "hosted",
        requestId: `${op}-${run._id}-${run.version}`,
        ...(run.editorialVersion
          ? { editorialVersion: run.editorialVersion }
          : {}),
        ...(run.creativeBrief ? { creativeBrief: run.creativeBrief } : {}),
        date: run.date,
        slot: run.slot,
        mode: run.mode,
        assignmentId: run.assignmentId,
        sourceVersion: socialSourceVersion(),
        status: "pending",
        version: run.version,
        trial: run.trial,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const drafts = await ctx.db
        .query("socialAgentDrafts")
        .withIndex("by_run", (q) => q.eq("runId", id))
        .collect();
      for (const { _id, _creationTime, ...draft } of drafts) {
        void _id;
        void _creationTime;
        await ctx.db.insert("socialAgentDrafts", { ...draft, runId: nextId });
      }
      if (edited && run.editorialVersion === CREATIVE_VERSION) {
        if (!edited.editorial)
          throw new Error("Edited drafts need an editorial plan.");
        const history = await creativeHistory(ctx, run);
        const pages = await ctx.db
          .query("socialAgentResearch")
          .withIndex("by_date", (q) => q.eq("date", run.date))
          .collect();
        validateCreativePlan(
          edited.editorial,
          [...history.published, ...history.planned],
          pages.filter((p) => p.kind === "page").map((p) => p.data.url),
          run.creativeBrief?.stage === "onboarding",
        );
        validateCreativeDraft(edited, edited.editorial);
      }
      if (edited && imageId) {
        await ctx.db.insert("socialAgentDrafts", {
          runId: nextId,
          version: run.version + 1,
          content: edited,
          imageId,
          imageHash: input.imageHash,
          createdAt: Date.now(),
        });
        await ctx.db.patch(nextId, { version: run.version + 1 });
      }
      if (job)
        await ctx.db.patch(job._id, {
          content: undefined,
          imageId: undefined,
          leaseToken: undefined,
          nextCheckAt: Date.now(),
          error: "Operator revision awaiting review.",
          updatedAt: Date.now(),
        });
      await ctx.db.patch(id, {
        status: "cancelled",
        assignmentId: undefined,
        previousAssignmentId: run.assignmentId,
        updatedAt: Date.now(),
      });
      await ctx.scheduler.runAfter(0, internal.socialAgentActions.start, {
        runId: nextId,
      });
      return nextId;
    }
    if (!["preview", "automatic", "paused"].includes(op))
      throw new Error("Unknown control.");
    const settings = await agentSettings(ctx);
    if (
      op === "automatic" &&
      settings?.experimentEndsAt &&
      Date.now() >= settings.experimentEndsAt
    )
      throw new Error(
        "The two-week experiment has ended. Review its results before a new run.",
      );
    let cutoverAt = settings?.cutoverAt;
    if (op === "automatic" && !settings?.trialAccepted) {
      const runs = await ctx.db.query("socialAgentRuns").collect();
      const ready = runs.filter(
        (r) =>
          r.trial &&
          r.editorialVersion === CREATIVE_VERSION &&
          r.mode === "preview" &&
          r.status === "ready" &&
          r.sourceVersion === socialSourceVersion(),
      );
      const pairedDays = [...new Set(ready.map((r) => r.date))].filter((date) =>
        ["morning", "afternoon"].every((slot) =>
          ready.some((r) => r.date === date && r.slot === slot),
        ),
      );
      if (pairedDays.length < 7 || input.acceptTrial !== true)
        throw new Error(
          "Accept fourteen successful trial pairs over seven dates first.",
        );
      if (settings?.experimentStartedAt) {
        for (const date of pairedDays.slice(0, 7)) {
          for (const slot of ["morning", "afternoon"]) {
            const run = ready.find((r) => r.date === date && r.slot === slot)!;
            const draft = await ctx.db
              .query("socialAgentDrafts")
              .withIndex("by_run", (q) =>
                q.eq("runId", run._id).eq("version", run.version),
              )
              .unique();
            if (!draft?.content.graphic.design || !draft.review?.approved)
              throw new Error(
                "The experiment requires reviewed previews with the new editorial designs.",
              );
          }
        }
      }
      const latest = await ctx.db
        .query("socialPosts")
        .withIndex("by_due")
        .order("desc")
        .first();
      cutoverAt = Math.max(
        Date.now() + 86400000,
        (latest?.dueAt ?? 0) + 86400000,
      );
      cutoverAt = dueAtForSlot(phoenixDate(cutoverAt), "morning");
    }
    const value = {
      key: "social",
      mode: op,
      cutoverAt,
      ...(settings?.experimentStartedAt && op === "automatic"
        ? {
            experimentEndsAt:
              settings.experimentEndsAt ??
              cutoverAt! + EXPERIMENT_DAYS * 86400000,
          }
        : {}),
      trialAccepted: settings?.trialAccepted || op === "automatic",
      updatedAt: Date.now(),
    };
    if (settings) await ctx.db.patch(settings._id, value);
    else await ctx.db.insert("socialAgentSettings", value);
    return value;
  },
});

export const saveMetrics = internalMutation({
  args: {
    postId: v.id("socialPosts"),
    platform: v.string(),
    metrics: v.any(),
    metricsUpdatedAt: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    if (
      !["facebook", "instagram"].includes(a.platform) ||
      JSON.stringify(a.metrics).length > 20000
    )
      throw new Error("Invalid metrics.");
    const old = await ctx.db
      .query("socialAgentMetrics")
      .withIndex("by_post", (q) =>
        q.eq("postId", a.postId).eq("platform", a.platform),
      )
      .unique();
    const value = { ...a, fetchedAt: Date.now() };
    if (old) await ctx.db.patch(old._id, value);
    else await ctx.db.insert("socialAgentMetrics", value);
  },
});
export const summarize = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now(),
      week = String(Math.floor(now / (7 * 86400000)));
    const metrics = await ctx.db.query("socialAgentMetrics").collect();
    const recent = metrics.filter((m) => m.fetchedAt > now - 7 * 86400000);
    const observations: string[] = [];
    for (const platform of ["facebook", "instagram"]) {
      const rows = recent.filter(
        (r) => r.platform === platform && Array.isArray(r.metrics),
      );
      const values = rows.flatMap((r) =>
        r.metrics
          .filter(
            (m: any) =>
              /impression|reach/i.test(m.type) && typeof m.value === "number",
          )
          .map((m: any) => ({ type: m.type, value: m.value })),
      );
      const types = [...new Set(values.map((v) => v.type))];
      for (const type of types) {
        const items = values.filter((v) => v.type === type);
        observations.push(
          `${platform} ${type}: ${items.length} observations, total ${items.reduce((n, v) => n + v.value, 0)}.`,
        );
      }
    }
    const text =
      recent.length < 14
        ? `Only ${recent.length} platform observations are available. Keep topic variety; this is insufficient evidence of a performance trend.`
        : `Weekly observations, not causal results: ${observations.join(" ")} Preserve topic variety and test one angle at a time. Missing metrics are not zero.`;
    const old = await ctx.db
      .query("socialAgentInsights")
      .withIndex("by_week", (q) => q.eq("week", week))
      .unique();
    const value = { week, text, sampleSize: recent.length, createdAt: now };
    if (old) await ctx.db.patch(old._id, value);
    else await ctx.db.insert("socialAgentInsights", value);
  },
});

export const generationState = internalQuery({
  args: { assignmentId: v.id("socialPosts") },
  handler: async (ctx, { assignmentId }) => ({
    settings: await agentSettings(ctx),
    run: await ctx.db
      .query("socialAgentRuns")
      .withIndex("by_assignment", (q) => q.eq("assignmentId", assignmentId))
      .unique(),
  }),
});

export const acceptDraft = internalMutation({
  args: {
    assignmentId: v.id("socialPosts"),
    token: v.string(),
    runId: v.id("socialAgentRuns"),
  },
  handler: async (ctx, a) => {
    const job = await ctx.db.get(a.assignmentId),
      run = await currentRun(ctx, a.runId);
    if (
      !job ||
      job.leaseToken !== a.token ||
      job.leaseUntil <= Date.now() ||
      job.cancelRequested ||
      !job.open ||
      job.content ||
      job.dueAt <= Date.now() + 900000
    )
      throw new Error("Assignment is not writable.");
    if (
      (await agentSettings(ctx))?.mode !== "automatic" ||
      run.assignmentId !== job._id ||
      run.mode !== "publish" ||
      run.status !== "ready" ||
      run.sourceVersion !== socialSourceVersion() ||
      job.sourceVersion !== run.sourceVersion ||
      job.date !== run.date ||
      job.slot !== run.slot
    )
      throw new Error("Stale or unapproved result.");
    const draft = await ctx.db
      .query("socialAgentDrafts")
      .withIndex("by_run", (q) =>
        q.eq("runId", run._id).eq("version", run.version),
      )
      .unique();
    if (
      !draft?.review?.approved ||
      draft.inspectedBy !== draft.review.sessionId ||
      draft.review.sessionId === run.eveRunId
    )
      throw new Error("Independent preview review required.");
    const peers = await ctx.db
      .query("socialPosts")
      .withIndex("by_due", (q) => q.gte("dueAt", job.dueAt - 30 * 86400000))
      .collect();
    validateAgentDraft(
      draft.content,
      peers
        .filter((p) => p._id !== job._id && p.content)
        .flatMap((p) => [p.content!.hook, p.content!.graphic.headline]),
    );
    await ctx.db.patch(job._id, {
      content: draft.content,
      imageId: draft.imageId,
      error: "",
      updatedAt: Date.now(),
    });
    await ctx.db.patch(run._id, { status: "accepted", updatedAt: Date.now() });
  },
});

export const preferences = internalMutation({
  args: {
    claim: workerClaim,
    runId: v.id("socialAgentRuns"),
    expectedVersion: v.number(),
    tone: v.string(),
    preferredTopics: v.array(v.string()),
  },
  handler: async (ctx, a) => {
    await requireRunClaim(await currentRun(ctx, a.runId), a.claim);
    await activeRun(ctx, a.runId);
    if (
      !a.tone.trim() ||
      a.tone.length > 500 ||
      a.preferredTopics.length > 5 ||
      a.preferredTopics.some(
        (t) => !(SOCIAL_TOPICS as readonly string[]).includes(t),
      )
    )
      throw new Error("Only bounded tone and topic preferences may change.");
    const feedback = await ctx.db
      .query("socialAgentFeedback")
      .withIndex("by_created")
      .order("desc")
      .first();
    const insight = await ctx.db
      .query("socialAgentInsights")
      .order("desc")
      .first();
    if (!feedback && (!insight || insight.sampleSize < 14))
      throw new Error("Feedback or sufficient observations required.");
    const evidenceKey = `${feedback?._id ?? "none"}:${insight && insight.sampleSize >= 14 ? insight._id : "none"}`;
    const old = await ctx.db
      .query("socialAgentPreferences")
      .withIndex("by_evidence", (q) => q.eq("evidenceKey", evidenceKey))
      .unique();
    if (old) return old;
    const latest = await ctx.db
      .query("socialAgentPreferences")
      .withIndex("by_version")
      .order("desc")
      .first();
    if ((latest?.version ?? 0) !== a.expectedVersion)
      throw new Error("Preferences changed concurrently.");
    const id = await ctx.db.insert("socialAgentPreferences", {
      runId: a.runId,
      tone: a.tone,
      preferredTopics: a.preferredTopics,
      version: a.expectedVersion + 1,
      evidenceKey,
      createdAt: Date.now(),
    });
    return ctx.db.get(id);
  },
});
