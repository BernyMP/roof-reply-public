"use node";
import { randomUUID } from "node:crypto";
import { v } from "convex/values";
import { internalAction, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  SOCIAL_CONFIG,
  socialConfigurationErrors,
  socialConfigRevision,
} from "@roofreply/social-agent/config";
import {
  captionFor,
  topicForDate,
  socialSourceVersion,
  type SocialPlatform,
} from "@roofreply/social-agent/content";
import {
  slotTracking,
  selectSlotLibraryContent,
} from "@roofreply/social-agent/agent-contract";
import { selectLibraryContent } from "@roofreply/social-agent/library";
import { generateSocialContent } from "@roofreply/social-agent/ai";
import {
  BufferClient,
  BufferRequestError,
  verifyChannels,
  type BufferPost,
} from "@roofreply/social-agent/buffer";
import { validateSocialPng } from "@roofreply/social-agent/image";

const PLATFORMS = ["facebook", "instagram"] as const;
type Job = Doc<"socialPosts">;
type Patch = Partial<
  Pick<
    Job,
    | "content"
    | "imageId"
    | "generationAttempts"
    | "facebook"
    | "instagram"
    | "error"
    | "open"
    | "cancelRequested"
    | "nextCheckAt"
  >
>;

function deliveryFrom(post: BufferPost, attempts: number): Job["facebook"] {
  const status =
    post.status === "sent"
      ? "sent"
      : ["scheduled", "sending"].includes(post.status)
        ? "scheduled"
        : "error";
  return {
    id: post.id,
    attempts,
    status,
    ...(post.externalLink ? { externalLink: post.externalLink } : {}),
    ...(status === "error"
      ? {
          error: `Buffer post status: ${post.status}. Inspect this post in Buffer.`,
        }
      : {}),
  };
}
function safeError(error: unknown) {
  if (error instanceof BufferRequestError) return error.message;
  // Never store or print arbitrary provider response bodies or request credentials.
  return "Social worker could not complete this step. Check credentials, content validation, and renderer availability.";
}

async function runJob(ctx: ActionCtx, id: Id<"socialPosts">): Promise<void> {
  const token = randomUUID();
  const claimed: Job | null = await ctx.runMutation(internal.social.claim, {
    id,
    token,
  });
  if (!claimed) return;
  const client = new BufferClient();
  const read = async (): Promise<Job> => {
    const job = await ctx.runQuery(internal.social.get, { id });
    if (!job) throw new Error("Social assignment missing.");
    return job;
  };
  const save = (patch: Patch, release = false) =>
    ctx.runMutation(internal.social.patch, { id, token, patch, release });

  // Recover an interrupted create by exact persisted text/channel/timestamp. An
  // empty lookup is not proof a timed-out write never reached Buffer.
  async function refresh(platform: SocialPlatform): Promise<void> {
    const job = await read(),
      delivery = job[platform];
    if (["sent", "cancelled"].includes(delivery.status)) return;
    if (delivery.id) {
      const post = await client.get(delivery.id);
      await save({ [platform]: deliveryFrom(post, delivery.attempts) });
    } else if (
      ["submitting", "unknown"].includes(delivery.status) &&
      job.content
    ) {
      const matches = await client.find(
        job.organizationId,
        job[`${platform}ChannelId`],
        captionFor(job.content, platform, slotTracking(job.date, job.slot)),
        job.dueAt,
      );
      if (matches.length === 1)
        await save({ [platform]: deliveryFrom(matches[0], delivery.attempts) });
      else
        await save({
          [platform]: {
            ...delivery,
            status: "unknown",
            error: matches.length
              ? "Multiple matching posts found. Inspect Buffer; no automatic retry."
              : "Submission uncertain. No automatic retry; continuing reconciliation.",
          },
        });
    }
  }

  async function cancelPending(): Promise<void> {
    await save({ cancelRequested: true });
    for (const platform of PLATFORMS) {
      try {
        await refresh(platform);
        const job = await read(),
          delivery = job[platform];
        if (["sent", "cancelled"].includes(delivery.status)) continue;
        if (delivery.id) {
          // Read immediately before deletion; published posts are never deleted.
          const remote = await client.get(delivery.id);
          if (remote.status === "sent") {
            await save({ [platform]: deliveryFrom(remote, delivery.attempts) });
            continue;
          }
          if (remote.status === "sending")
            throw new Error("Post is already sending.");
          await client.cancel(delivery.id);
          await save({
            [platform]: { ...delivery, status: "cancelled", error: undefined },
          });
        } else if (!["unknown", "submitting"].includes(delivery.status)) {
          await save({ [platform]: { ...delivery, status: "cancelled" } });
        }
      } catch (error) {
        const job = await read();
        await save({
          [platform]: {
            ...job[platform],
            error: `Cancellation unconfirmed. ${safeError(error)}`,
          },
        });
      }
    }
    const job = await read();
    const unsettled = PLATFORMS.some(
      (p) => !["sent", "cancelled"].includes(job[p].status),
    );
    await save(
      {
        open: unsettled,
        nextCheckAt: Date.now() + 3_600_000,
        error: unsettled
          ? "Cancellation or uncertain submission needs attention. Inspect Buffer before changing this record."
          : "Pair stopped. Published posts, if any, were preserved.",
      },
      true,
    );
  }

  try {
    let job = await read();
    const configChanged =
      job.configRevision !== socialConfigRevision() ||
      job.sourceVersion !== socialSourceVersion() ||
      job.organizationId !== SOCIAL_CONFIG.organizationId ||
      job.facebookChannelId !== SOCIAL_CONFIG.facebookChannelId ||
      job.instagramChannelId !== SOCIAL_CONFIG.instagramChannelId;
    if (
      !SOCIAL_CONFIG.enabled ||
      socialConfigurationErrors().length ||
      configChanged ||
      job.cancelRequested
    ) {
      await cancelPending();
      return;
    }

    for (const platform of PLATFORMS) await refresh(platform);
    job = await read();
    const paired = PLATFORMS.every((p) =>
      ["scheduled", "sent"].includes(job[p].status),
    );
    if (!paired && Date.now() >= job.dueAt - 900_000) {
      if (job.engine === "eve" && !job.content) {
        const state = await ctx.runQuery(internal.socialAgent.generationState, { assignmentId: id });
        if (state.run && ["pending", "running", "rejected"].includes(state.run.status) &&
            (state.run.executionMode === "local-chatgpt" || state.settings?.executionMode === "local-chatgpt"))
          await ctx.runMutation(internal.socialAgent.dispatch, { runId: state.run._id, error: "Local generation missed the publication cutoff." });
      }
      await cancelPending();
      return;
    }
    if (PLATFORMS.every((p) => job[p].status === "sent")) {
      await save({ open: false, error: "" }, true);
      return;
    }
    if (PLATFORMS.some((p) => job[p].status === "sent") && !paired) {
      await cancelPending();
      return;
    }
    if (paired) {
      await save(
        {
          nextCheckAt:
            Date.now() < job.dueAt - 900000
              ? job.dueAt - 900000
              : Date.now() < job.dueAt
                ? job.dueAt + 300000
                : Date.now() +
                  (Date.now() > job.dueAt + 86400000 ? 86400000 : 900000),
          error:
            Date.now() > job.dueAt + 3_600_000
              ? "Publication delayed. Inspect the queued posts in Buffer."
              : "",
        },
        true,
      );
      return;
    }

    if (job.engine === "eve" && !job.content) {
      const state = await ctx.runQuery(internal.socialAgent.generationState, {
        assignmentId: id,
      });
      if (state.settings?.mode !== "automatic") {
        await save(
          {
            nextCheckAt: Date.now() + 900000,
            error: "Eve generation is paused.",
          },
          true,
        );
        return;
      }
      if (!state.run) {
        const runId = await ctx.runMutation(internal.socialAgent.createRun, {
          assignmentId: id,
          requestId: `assignment-${id}`,
          date: job.date,
          slot: job.slot!,
        });
        await ctx.scheduler.runAfter(0, internal.socialAgentActions.start, {
          runId,
        });
        await save(
          {
            nextCheckAt: Date.now() + 60000,
            error: "Eve is preparing and reviewing this slot.",
          },
          true,
        );
        return;
      }
      if (["pending", "running", "rejected"].includes(state.run.status)) {
        // Eve sessions are durable and must never hold the publishing lease.
        await save({ nextCheckAt: Date.now() + 60000 }, true);
        return;
      }
      if (state.run.status === "ready") {
        try {
          await ctx.runMutation(internal.socialAgent.acceptDraft, {
            assignmentId: id,
            token,
            runId: state.run._id,
          });
        } catch {
          await ctx.runMutation(internal.socialAgent.dispatch, {
            runId: state.run._id,
            error:
              "Draft could not be accepted; source, originality, or assignment changed.",
          });
        }
        job = await read();
      }
      if (!job.content) {
        if (state.run.editorialVersion === "creative-v2") {
          await save({ open: false, error: `Slot skipped: editorial generation did not produce an acceptable post. ${state.run.error ?? "See its independent review."}` }, true);
          return;
        }
        try {
          const previous = await ctx.runQuery(internal.social.recentHooks, {
            id,
            dueAt: job.dueAt,
          });
          await save({
            content: selectSlotLibraryContent(job.date, job.slot!, previous),
            error: "Approved library fallback selected.",
          });
          job = await read();
        } catch {
          await save(
            {
              open: false,
              error:
                "Slot skipped: generation unavailable and approved library exhausted under the 30-day repeat restriction.",
            },
            true,
          );
          return;
        }
      }
    }

    verifyChannels(await client.channels(job.organizationId), job);
    while (
      !job.content &&
      job.generationAttempts < SOCIAL_CONFIG.maxGenerationAttempts
    ) {
      await save({ generationAttempts: job.generationAttempts + 1 });
      try {
        const previous: string[] = await ctx.runQuery(
          internal.social.recentHooks,
          { id, dueAt: job.dueAt },
        );
        const content =
          SOCIAL_CONFIG.contentMode === "library"
            ? selectLibraryContent(job.date, previous)
            : await generateSocialContent(
                topicForDate(job.date),
                previous,
                job.error,
              );
        await save({ content, error: "" });
      } catch {
        await save({
          error:
            "Draft rejected or generation unavailable. Revise for source accuracy, text limits, and originality.",
        });
      }
      job = await read();
    }
    if (!job.content) {
      await save(
        {
          open: false,
          error:
            "Content failed after two attempts. This date will not publish; inspect the assignment.",
        },
        true,
      );
      return;
    }
    if (!job.imageId) {
      const secret = globalThis.process.env.ROOFREPLY_SERVICE_SECRET;
      if (!secret) throw new Error("Renderer credential missing.");
      const response = await fetch(
        new URL("/api/internal/social-image", SOCIAL_CONFIG.renderOrigin),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${secret}`,
          },
          body: JSON.stringify(job.content.graphic),
          signal: AbortSignal.timeout(30_000),
          redirect: "error",
        },
      );
      if (
        !response.ok ||
        !response.headers.get("content-type")?.startsWith("image/png")
      )
        throw new Error("Image renderer unavailable.");
      const bytes = new Uint8Array(await response.arrayBuffer());
      validateSocialPng(bytes);
      const imageId = await ctx.storage.store(
        new Blob([bytes], { type: "image/png" }),
      );
      await save({ imageId });
      job = await read();
    }
    const imageUrl = await ctx.storage.getUrl(job.imageId!);
    if (!imageUrl) throw new Error("Image unavailable.");
    // Confirm the exact stored asset is fetchable before either platform is queued.
    const imageResponse = await fetch(imageUrl, {
      signal: AbortSignal.timeout(20_000),
    });
    if (!imageResponse.ok) throw new Error("Image unavailable.");
    validateSocialPng(new Uint8Array(await imageResponse.arrayBuffer()));

    for (const platform of PLATFORMS) {
      const allowed: boolean = await ctx.runMutation(
        internal.social.beginSubmission,
        { id, token, platform },
      );
      if (!allowed) continue;
      job = await read();
      try {
        const post = await client.create(
          platform,
          job[`${platform}ChannelId`],
          captionFor(job.content!, platform, slotTracking(job.date, job.slot)),
          imageUrl,
          job.dueAt,
        );
        // Persist provider receipt before any other provider call.
        await save({ [platform]: deliveryFrom(post, job[platform].attempts) });
      } catch (error) {
        await save({
          [platform]: {
            ...job[platform],
            status:
              error instanceof BufferRequestError && !error.uncertain
                ? "error"
                : "unknown",
            error: safeError(error),
          },
        });
      }
    }
    job = await read();
    const scheduled = PLATFORMS.every((p) =>
      ["scheduled", "sent"].includes(job[p].status),
    );
    if (
      job.cancelRequested ||
      (!scheduled && Date.now() >= job.dueAt - 900000)
    ) {
      await cancelPending();
      return;
    }
    await save(
      {
        nextCheckAt: scheduled
          ? job.dueAt - 900000
          : Math.min(Date.now() + 900000, job.dueAt - 900000),
        error: scheduled
          ? ""
          : "Pair incomplete. Retrying confirmed failures; reconciling uncertain submissions.",
      },
      true,
    );
  } catch (error) {
    // Preserve any provider receipts. Next run reconciles before doing anything.
    const job = await read();
    if (
      job.cancelRequested ||
      (Date.now() >= job.dueAt - 900000 &&
        !PLATFORMS.every((p) => ["scheduled", "sent"].includes(job[p].status)))
    ) {
      await cancelPending();
      return;
    }
    await save(
      { error: safeError(error), nextCheckAt: Date.now() + 900000 },
      true,
    );
  }
}

export const process = internalAction({
  args: { id: v.id("socialPosts") },
  handler: async (ctx, { id }): Promise<void> => runJob(ctx, id),
});

export const inspectAccounts = internalAction({
  args: { organizationId: v.string() },
  handler: async (_ctx, { organizationId }) =>
    new BufferClient().channels(organizationId),
});
export const preflight = internalAction({
  args: {},
  handler: async () => {
    const errors = socialConfigurationErrors();
    if (errors.length) return { ready: false, errors };
    try {
      verifyChannels(
        await new BufferClient().channels(SOCIAL_CONFIG.organizationId),
        SOCIAL_CONFIG,
      );
      if (
        (SOCIAL_CONFIG.contentMode === "openai" &&
          !globalThis.process.env.OPENAI_API_KEY) ||
        !globalThis.process.env.ROOFREPLY_SERVICE_SECRET
      )
        throw new Error("Missing generation or renderer credential.");
      return { ready: true, errors: [] };
    } catch (error) {
      return { ready: false, errors: [safeError(error)] };
    }
  },
});
