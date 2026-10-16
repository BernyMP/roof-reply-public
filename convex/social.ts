import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  SOCIAL_CONFIG,
  socialConfigurationErrors,
  socialConfigRevision,
} from "@roofreply/social-agent/config";
import {
  dueAtForDate,
  upcomingDates,
  socialSourceVersion,
  validateContent,
} from "@roofreply/social-agent/content";
import { agentSettings } from "./socialAgent";
import { upcomingSlots } from "@roofreply/social-agent/agent-contract";
import { socialPatch } from "./socialValidators";

// All controls are internal functions, invoked through the deployment CLI only.
export const status = internalQuery({
  args: {},
  handler: async (ctx) => ({
    enabled: SOCIAL_CONFIG.enabled,
    contentMode: SOCIAL_CONFIG.contentMode,
    configurationErrors: socialConfigurationErrors(),
    sourceVersion: socialSourceVersion(),
    credentials: {
      buffer: Boolean(process.env.BUFFER_API_KEY),
      openai: Boolean(process.env.OPENAI_API_KEY),
      renderer: Boolean(process.env.ROOFREPLY_SERVICE_SECRET),
    },
    posts: await Promise.all(
      (
        await ctx.db
          .query("socialPosts")
          .withIndex("by_due")
          .order("desc")
          .take(60)
      ).map(async (post) => ({
        ...post,
        imageUrl: post.imageId ? await ctx.storage.getUrl(post.imageId) : null,
      })),
    ),
    attention: await ctx.db
      .query("socialPosts")
      .withIndex("by_work", (q) => q.eq("open", true))
      .take(100),
  }),
});

export const fill = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (!SOCIAL_CONFIG.enabled) return;
    const errors = socialConfigurationErrors();
    if (errors.length) throw new Error(errors.join(" "));
    const now = Date.now();
    const settings = await agentSettings(ctx);
    if (settings?.experimentEndsAt && now >= settings.experimentEndsAt) {
      if (settings.mode === "automatic")
        await ctx.db.patch(settings._id, { mode: "paused", updatedAt: now });
      return;
    }
    const cutoverAt = settings?.cutoverAt ?? Infinity;
    const legacy = upcomingDates(now, SOCIAL_CONFIG.daysAhead)
      .map((date) => ({ date, slot: undefined, dueAt: dueAtForDate(date) }))
      .filter((item) => item.dueAt < cutoverAt);
    const eve =
      settings?.mode === "automatic"
        ? upcomingSlots(now, SOCIAL_CONFIG.daysAhead).filter(
            (item) =>
              item.dueAt >= cutoverAt &&
              item.dueAt < (settings.experimentEndsAt ?? Infinity) &&
              (settings.postsPerDay !== 1 || item.slot === "morning"),
          )
        : [];
    for (const [i, item] of [...legacy, ...eve].entries()) {
      const { date, slot, dueAt } = item;
      const existing = await ctx.db
        .query("socialPosts")
        .withIndex("by_date", (q) => q.eq("date", date))
        .collect();
      // A legacy record is the morning reservation, even when already closed.
      if (
        existing.some(
          (post) => (post.slot ?? "morning") === (slot ?? "morning"),
        )
      )
        continue;
      const id = await ctx.db.insert("socialPosts", {
        date,
        dueAt,
        ...(slot ? { slot, engine: "eve" as const } : {}),
        sourceVersion: socialSourceVersion(),
        configRevision: socialConfigRevision(),
        organizationId: SOCIAL_CONFIG.organizationId,
        facebookChannelId: SOCIAL_CONFIG.facebookChannelId,
        instagramChannelId: SOCIAL_CONFIG.instagramChannelId,
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
      await ctx.scheduler.runAfter(
        i * 180_000,
        internal.socialActions.process,
        { id },
      );
    }
  },
});

export const maintain = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Continue reconciliation/cancellation when disabled. Removing the cron would
    // leave already scheduled Buffer posts live after a code-based pause.
    const settings = await agentSettings(ctx);
    if (
      settings?.experimentEndsAt &&
      Date.now() >= settings.experimentEndsAt &&
      settings.mode === "automatic"
    )
      await ctx.db.patch(settings._id, {
        mode: "paused",
        updatedAt: Date.now(),
      });
    const work = await ctx.db
      .query("socialPosts")
      .withIndex("by_work", (q) => q.eq("open", true))
      .collect();
    for (const job of work) {
      const stale =
        job.configRevision !== socialConfigRevision() ||
        job.sourceVersion !== socialSourceVersion() ||
        job.organizationId !== SOCIAL_CONFIG.organizationId ||
        job.facebookChannelId !== SOCIAL_CONFIG.facebookChannelId ||
        job.instagramChannelId !== SOCIAL_CONFIG.instagramChannelId;
      const newlyCancelled =
        !job.cancelRequested &&
        (!SOCIAL_CONFIG.enabled ||
          (job.engine === "eve" &&
            settings?.experimentEndsAt !== undefined &&
            job.dueAt >= settings.experimentEndsAt) ||
          stale ||
          socialConfigurationErrors().length > 0);
      if (newlyCancelled) {
        await ctx.db.patch(job._id, {
          cancelRequested: true,
          nextCheckAt: Date.now(),
          error:
            "Agent paused or configuration/source changed; cancelling pending posts.",
        });
      }
      if (
        (job.nextCheckAt <= Date.now() || newlyCancelled) &&
        job.leaseUntil <= Date.now()
      )
        await ctx.scheduler.runAfter(0, internal.socialActions.process, {
          id: job._id,
        });
    }
  },
});

export const claim = internalMutation({
  args: { id: v.id("socialPosts"), token: v.string() },
  handler: async (ctx, { id, token }) => {
    const job = await ctx.db.get(id);
    if (!job || !job.open || job.leaseUntil > Date.now()) return null;
    await ctx.db.patch(id, {
      leaseToken: token,
      leaseUntil: Date.now() + 300_000,
      updatedAt: Date.now(),
    });
    return { ...job, leaseToken: token };
  },
});
export const get = internalQuery({
  args: { id: v.id("socialPosts") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});
export const recentHooks = internalQuery({
  args: { id: v.id("socialPosts"), dueAt: v.number() },
  handler: async (ctx, { id, dueAt }) => {
    const jobs = await ctx.db
      .query("socialPosts")
      .withIndex("by_due", (q) => q.gte("dueAt", dueAt - 30 * 86400000))
      .collect();
    return jobs
      .filter((j) => j._id !== id && j.content)
      .flatMap((j) => [j.content!.hook, j.content!.graphic.headline]);
  },
});
export const patch = internalMutation({
  args: {
    id: v.id("socialPosts"),
    token: v.string(),
    patch: v.object(socialPatch),
    release: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, token, patch, release }) => {
    const job = await ctx.db.get(id);
    if (!job || job.leaseToken !== token || job.leaseUntil <= Date.now())
      throw new Error("Social worker lease expired.");
    if (patch.content) {
      const recent = await ctx.db
        .query("socialPosts")
        .withIndex("by_due", (q) => q.gte("dueAt", job.dueAt - 30 * 86400000))
        .collect();
      validateContent(
        patch.content,
        recent
          .filter((j) => j._id !== id && j.content)
          .flatMap((j) => [j.content!.hook, j.content!.graphic.headline]),
      );
    }
    for (const platform of ["facebook", "instagram"] as const) {
      if (
        job[platform].status === "sent" &&
        patch[platform] &&
        patch[platform]!.status !== "sent"
      )
        throw new Error("A published post cannot return to the queue.");
    }
    if (job.cancelRequested) patch.cancelRequested = true;
    await ctx.db.patch(id, {
      ...patch,
      updatedAt: Date.now(),
      ...(release ? { leaseUntil: 0, leaseToken: undefined } : {}),
    });
  },
});

export const beginSubmission = internalMutation({
  args: {
    id: v.id("socialPosts"),
    token: v.string(),
    platform: v.union(v.literal("facebook"), v.literal("instagram")),
  },
  handler: async (ctx, { id, token, platform }) => {
    const job = await ctx.db.get(id);
    if (!job || job.leaseToken !== token || job.leaseUntil <= Date.now())
      return false;
    const settings = await agentSettings(ctx);
    if (
      job.engine === "eve" &&
      settings?.experimentEndsAt &&
      job.dueAt >= settings.experimentEndsAt
    )
      return false;
    if (
      !SOCIAL_CONFIG.enabled ||
      socialConfigurationErrors().length ||
      job.cancelRequested ||
      job.dueAt - 900000 <= Date.now() ||
      !job.content ||
      !job.imageId ||
      job.sourceVersion !== socialSourceVersion() ||
      job.configRevision !== socialConfigRevision() ||
      job.organizationId !== SOCIAL_CONFIG.organizationId ||
      job.facebookChannelId !== SOCIAL_CONFIG.facebookChannelId ||
      job.instagramChannelId !== SOCIAL_CONFIG.instagramChannelId
    )
      return false;
    const delivery = job[platform];
    if (
      delivery.id ||
      !["pending", "error"].includes(delivery.status) ||
      delivery.attempts >= SOCIAL_CONFIG.maxSubmissionAttempts
    )
      return false;
    await ctx.db.patch(id, {
      [platform]: { status: "submitting", attempts: delivery.attempts + 1 },
      updatedAt: Date.now(),
    });
    return true;
  },
});
