"use node";
import { BufferClient } from "@roofreply/social-agent/buffer";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

export const start = internalAction({
  args: { runId: v.id("socialAgentRuns") },
  handler: async (ctx, { runId }): Promise<void> => {
    const initial = await ctx.runQuery(internal.socialAgent.context, { runId });
    if (initial.run.executionMode === "local-chatgpt") return;
    const granted = await ctx.runMutation(internal.socialAgent.dispatch, {
      runId,
    });
    if (!granted) return;
    if (granted === "queued") {
      await ctx.scheduler.runAfter(60000, internal.socialAgentActions.start, {
        runId,
      });
      return;
    }
    try {
      const state = await ctx.runQuery(internal.socialAgent.context, { runId });
      const currentDraft = state.drafts.find(
        (d) => d.version === state.run.version,
      );
      const message =
        currentDraft && !currentDraft.review
          ? `Review the current saved operator draft, version ${currentDraft.version}. Read get_context, load the shared editorial-guidelines skill, and call review_draft for this exact version. Wait for the persisted decision. Do not research, rewrite, or save another draft before the reviewer decides. Never publish directly.`
          : "Process your authenticated RoofReply assignment. Read get_context, research within its limits, load the shared editorial-guidelines skill, call plan_content for three different candidate rewards and a selected plan when creative-v2, then save a draft, and call review_draft to obtain an independent persisted reviewer decision. Revise after rejection within the version limit. Never publish directly.";
      const origin = process.env.SOCIAL_AGENT_ORIGIN;
      const secret = process.env.SOCIAL_AGENT_SERVICE_SECRET;
      if (!origin || !secret) throw new Error("Service unavailable.");
      const url = new URL("/eve/v1/session", origin);
      if (url.protocol !== "https:" && url.hostname !== "localhost")
        throw new Error("Invalid service origin.");
      const response = await fetch(url, {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(25000),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secret}`,
          "x-roofreply-run": runId,
          ...(process.env.SOCIAL_VERCEL_BYPASS_SECRET
            ? {
                "x-vercel-protection-bypass":
                  process.env.SOCIAL_VERCEL_BYPASS_SECRET,
              }
            : {}),
        },
        body: JSON.stringify({ message }),
      });
      if (!response.ok) throw new Error("Service rejected dispatch.");
      const data = await response.json();
      if (typeof data.sessionId !== "string")
        throw new Error("Missing durable receipt.");
      await ctx.runMutation(internal.socialAgent.dispatch, {
        runId,
        eveRunId: data.sessionId,
      });
      await ctx.scheduler.runAfter(
        20 * 60000,
        internal.socialAgentActions.expire,
        { runId },
      );
    } catch {
      // An uncertain session create is never retried: its first tool/model also binds its receipt.
      await ctx.runMutation(internal.socialAgent.event, {
        runId,
        key: "dispatch-uncertain",
        kind: "attention",
        summary:
          "Eve dispatch could not be confirmed. No automatic duplicate start; waiting for the session to bind itself.",
      });
      await ctx.scheduler.runAfter(
        20 * 60000,
        internal.socialAgentActions.expire,
        { runId },
      );
    }
  },
});
export const expire = internalAction({
  args: { runId: v.id("socialAgentRuns") },
  handler: async (ctx, { runId }) => {
    const state = await ctx.runQuery(internal.socialAgent.context, { runId });
    if (
      !["ready", "failed", "cancelled", "accepted"].includes(state.run.status)
    )
      await ctx.runMutation(internal.socialAgent.dispatch, {
        runId,
        error:
          state.run.editorialVersion === "creative-v2"
            ? "Editorial generation exceeded its time window. Skip the slot; no library substitution."
            : "Generation exceeded its time window. Eligible library fallback may be used.",
      });
  },
});

export const collectMetrics = internalAction({
  args: {},
  handler: async (ctx) => {
    const snapshot = await ctx.runQuery(internal.socialAgent.snapshot, {});
    if (!snapshot.settings) return; // No new provider calls until the agent has been set up.
    const client = new BufferClient();
    for (const post of snapshot.posts.filter(
      (p) => p.dueAt > Date.now() - 30 * 86400000,
    ))
      for (const platform of ["facebook", "instagram"] as const) {
        if (post[platform].status !== "sent" || !post[platform].id) continue;
        try {
          const data = await client.metrics(post[platform].id!);
          await ctx.runMutation(internal.socialAgent.saveMetrics, {
            postId: post._id,
            platform,
            metrics: data.metrics ?? [],
            ...(data.metricsUpdatedAt
              ? { metricsUpdatedAt: data.metricsUpdatedAt }
              : {}),
          });
        } catch {
          /* Missing metrics remain missing; publishing never depends on analytics. */
        }
      }
    await ctx.runMutation(internal.socialAgent.summarize, {});
  },
});

export const metricsReadiness = internalAction({
  args: {},
  handler: async (ctx) => {
    const snapshot = await ctx.runQuery(internal.socialAgent.snapshot, {});
    const client = new BufferClient();
    const results = [];
    for (const platform of ["facebook", "instagram"] as const) {
      const post = snapshot.posts.find(
        (p) => p[platform].status === "sent" && p[platform].id,
      );
      if (!post) {
        results.push({
          platform,
          status: "No published sample is available yet.",
        });
        continue;
      }
      try {
        const result = await client.metrics(post[platform].id!);
        results.push({
          platform,
          status: "Metrics query authorized.",
          fields: result.metrics?.length ?? 0,
          freshAt: result.metricsUpdatedAt ?? null,
        });
      } catch {
        results.push({
          platform,
          status:
            "Metrics access unavailable; check the Buffer account permissions.",
        });
      }
    }
    return results;
  },
});
