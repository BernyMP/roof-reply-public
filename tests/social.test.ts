import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { convexTest } from "convex-test";
import { v } from "convex/values";
import schema from "../convex/schema";
import { internal } from "../convex/_generated/api";
import { internalAction } from "../convex/_generated/server";
import { SOCIAL_CONFIG, socialConfigRevision } from "@roofreply/social-agent/config";
import {
  SAMPLE_CONTENT,
  socialSourceVersion,
  captionFor,
  phoenixDate,
  dueAtForDate,
} from "@roofreply/social-agent/content";
import type { Doc } from "../convex/_generated/dataModel";

const originalConfig = { ...SOCIAL_CONFIG };
const originalFetch = globalThis.fetch;
const originalEnv = {
  buffer: process.env.BUFFER_API_KEY,
  openai: process.env.OPENAI_API_KEY,
  renderer: process.env.ROOFREPLY_SERVICE_SECRET,
};
beforeEach(() => {
  Object.assign(SOCIAL_CONFIG, {
    enabled: true,
    contentMode: "openai",
    sampleApproved: true,
    instagramBioConfirmed: true,
    organizationId: "a".repeat(24),
    facebookChannelId: "b".repeat(24),
    instagramChannelId: "c".repeat(24),
  });
  process.env.BUFFER_API_KEY = "fake-buffer-key";
  process.env.OPENAI_API_KEY = "fake-openai-key";
  process.env.ROOFREPLY_SERVICE_SECRET = "fake-renderer-key";
});
afterEach(() => {
  Object.assign(SOCIAL_CONFIG, originalConfig);
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries({
    BUFFER_API_KEY: originalEnv.buffer,
    OPENAI_API_KEY: originalEnv.openai,
    ROOFREPLY_SERVICE_SECRET: originalEnv.renderer,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function setup(realWorker = true) {
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
  if (!realWorker)
    modules["../convex/socialActions.ts"] = async () => ({
      process: internalAction({
        args: { id: v.id("socialPosts") },
        handler: async () => {},
      }),
    });
  return convexTest(schema, modules);
}
const png = new Uint8Array(24);
png.set([137, 80, 78, 71, 13, 10, 26, 10]);
new DataView(png.buffer).setUint32(16, 1080);
new DataView(png.buffer).setUint32(20, 1350);
async function seed(
  t: ReturnType<typeof setup>,
  patch: Partial<Doc<"socialPosts">> = {},
) {
  return t.run(async (ctx) => {
    const date = phoenixDate(Date.now() + 86400000);
    const imageId = await ctx.storage.store(
      new Blob([png], { type: "image/png" }),
    );
    return ctx.db.insert("socialPosts", {
      date,
      dueAt: dueAtForDate(date),
      sourceVersion: socialSourceVersion(),
      configRevision: socialConfigRevision(),
      organizationId: SOCIAL_CONFIG.organizationId,
      facebookChannelId: SOCIAL_CONFIG.facebookChannelId,
      instagramChannelId: SOCIAL_CONFIG.instagramChannelId,
      content: SAMPLE_CONTENT,
      imageId,
      generationAttempts: 0,
      facebook: { status: "pending", attempts: 0 },
      instagram: { status: "pending", attempts: 0 },
      open: true,
      cancelRequested: false,
      nextCheckAt: 0,
      leaseUntil: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...patch,
    });
  });
}
function providers(
  options: {
    rejectInstagram?: boolean;
    timeoutInstagram?: boolean;
    loseReceipt?: boolean;
    cancelFails?: boolean;
    rendererFails?: boolean;
    assetFails?: boolean;
    invalidAi?: boolean;
    facebookReadFails?: boolean;
  } = {},
) {
  const posts = new Map<string, any>();
  const creates: any[] = [],
    deletes: string[] = [];
  let aiCalls = 0;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("api.openai.com")) {
      aiCalls++;
      return Response.json({
        choices: [{ finish_reason: "length", message: { content: "{}" } }],
      });
    }
    if (String(url).includes("/api/internal/social-image"))
      return options.rendererFails
        ? new Response("down", { status: 503 })
        : new Response(png, { headers: { "Content-Type": "image/png" } });
    if (!String(url).includes("api.buffer.com"))
      return options.assetFails
        ? new Response("missing", { status: 404 })
        : new Response(png);
    const { query, variables } = JSON.parse(String(init?.body));
    const input = variables.input;
    if (query.includes("query Channels"))
      return Response.json({
        data: {
          channels: [
            {
              id: SOCIAL_CONFIG.facebookChannelId,
              name: "RoofReply",
              service: "facebook",
              type: "page",
              organizationId: SOCIAL_CONFIG.organizationId,
              isDisconnected: false,
              isLocked: false,
              isQueuePaused: false,
            },
            {
              id: SOCIAL_CONFIG.instagramChannelId,
              name: "roofreply",
              service: "instagram",
              type: "business",
              organizationId: SOCIAL_CONFIG.organizationId,
              isDisconnected: false,
              isLocked: false,
              isQueuePaused: false,
              metadata: { defaultToReminders: false },
            },
          ],
        },
      });
    if (query.includes("mutation Schedule")) {
      creates.push(input);
      if (
        input.channelId === SOCIAL_CONFIG.instagramChannelId &&
        options.rejectInstagram
      )
        return new Response("expired", { status: 401 });
      if (
        input.channelId === SOCIAL_CONFIG.instagramChannelId &&
        options.timeoutInstagram &&
        !options.loseReceipt
      )
        throw new Error("timeout");
      const post = {
        id: `post-${creates.length}`,
        text: input.text,
        channelId: input.channelId,
        dueAt: input.dueAt,
        status: "scheduled",
      };
      posts.set(post.id, post);
      if (
        input.channelId === SOCIAL_CONFIG.instagramChannelId &&
        options.loseReceipt
      )
        throw new Error("receipt lost after acceptance");
      return Response.json({
        data: { createPost: { __typename: "PostActionSuccess", post } },
      });
    }
    if (query.includes("query Find"))
      return Response.json({
        data: {
          posts: {
            edges: [...posts.values()].map((node) => ({ node })),
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      });
    if (query.includes("query Post")) {
      if (
        options.facebookReadFails &&
        posts.get(input.id)?.channelId === SOCIAL_CONFIG.facebookChannelId
      )
        return new Response("down", { status: 503 });
      if (!posts.has(input.id))
        return Response.json({ errors: [{ message: "not found" }] });
      return Response.json({ data: { post: posts.get(input.id) } });
    }
    if (query.includes("mutation Cancel")) {
      deletes.push(input.id);
      if (options.cancelFails) throw new Error("timeout");
      posts.delete(input.id);
      return Response.json({
        data: { deletePost: { __typename: "DeletePostSuccess", id: input.id } },
      });
    }
    throw new Error("Unexpected provider call");
  };
  return { creates, deletes, posts, aiCalls: () => aiCalls };
}

test("disabled fill is inert and overlapping fills reserve each date only once", async (testContext) => {
  // Convex-test retains timers even for cancelled jobs. Keep real zero-delay
  // transaction timers, but do not let future cancelled jobs hold Node open.
  const realTimeout = globalThis.setTimeout;
  testContext.mock.method(globalThis, "setTimeout", ((
    ...args: Parameters<typeof setTimeout>
  ) => {
    const timer = realTimeout(...args);
    if (Number(args[1]) > 1000) timer.unref();
    return timer;
  }) as typeof setTimeout);
  const t = setup(false);
  SOCIAL_CONFIG.enabled = false;
  await t.mutation(internal.social.fill, {});
  assert.equal((await t.query(internal.social.status, {})).posts.length, 0);
  SOCIAL_CONFIG.enabled = true;
  await Promise.all([
    t.mutation(internal.social.fill, {}),
    t.mutation(internal.social.fill, {}),
  ]);
  assert.equal((await t.query(internal.social.status, {})).posts.length, 3);
  await t.run(async (ctx) => {
    for (const scheduled of await ctx.db.system
      .query("_scheduled_functions")
      .collect())
      await ctx.scheduler.cancel(scheduled._id);
  });
  await t.finishInProgressScheduledFunctions();
});
test("fenced lease prevents concurrent workers and stale writes", async () => {
  const t = setup(),
    id = await seed(t);
  const claims = await Promise.all([
    t.mutation(internal.social.claim, { id, token: "one" }),
    t.mutation(internal.social.claim, { id, token: "two" }),
  ]);
  assert.equal(claims.filter(Boolean).length, 1);
  await assert.rejects(
    () =>
      t.mutation(internal.social.patch, {
        id,
        token: "stale",
        patch: { open: false },
      }),
    /lease/,
  );
});
test("schedules exactly two matching timestamps, saves receipts and never duplicates on restart", async () => {
  const t = setup(),
    id = await seed(t),
    provider = providers();
  await t.action(internal.socialActions.process, { id });
  assert.equal(provider.creates.length, 2);
  assert.equal(provider.creates[0].dueAt, provider.creates[1].dueAt);
  let job = (await t.query(internal.social.get, { id }))!;
  assert.equal(job.facebook.status, "scheduled");
  assert.ok(job.instagram.id);
  await t.action(internal.socialActions.process, { id });
  assert.equal(provider.creates.length, 2);
  for (const post of provider.posts.values()) {
    post.status = "sent";
    post.externalLink = "https://example.test/live";
  }
  await t.action(internal.socialActions.process, { id });
  job = (await t.query(internal.social.get, { id }))!;
  assert.equal(job.open, false);
  assert.equal(job.instagram.externalLink, "https://example.test/live");
});
test("lost receipt is recovered by lookup without recreating accepted post", async () => {
  const t = setup(),
    id = await seed(t),
    provider = providers({ loseReceipt: true });
  await t.action(internal.socialActions.process, { id });
  assert.equal(
    (await t.query(internal.social.get, { id }))!.instagram.status,
    "unknown",
  );
  await t.action(internal.socialActions.process, { id });
  assert.equal(provider.creates.length, 2);
  assert.equal(
    (await t.query(internal.social.get, { id }))!.instagram.status,
    "scheduled",
  );
});
test("an uncertain submission with no matching receipt is never recreated", async () => {
  const t = setup(),
    id = await seed(t),
    provider = providers({ timeoutInstagram: true });
  await t.action(internal.socialActions.process, { id });
  await t.action(internal.socialActions.process, { id });
  assert.equal(provider.creates.length, 2);
  assert.equal(
    (await t.query(internal.social.get, { id }))!.instagram.status,
    "unknown",
  );
});
test("confirmed failures retry only the missing side and stop after three attempts", async () => {
  const t = setup(),
    id = await seed(t),
    provider = providers({ rejectInstagram: true });
  for (let i = 0; i < 5; i++)
    await t.action(internal.socialActions.process, { id });
  assert.equal(
    provider.creates.filter(
      (p) => p.channelId === SOCIAL_CONFIG.facebookChannelId,
    ).length,
    1,
  );
  assert.equal(
    provider.creates.filter(
      (p) => p.channelId === SOCIAL_CONFIG.instagramChannelId,
    ).length,
    3,
  );
});
test("incomplete pair cancels successful counterpart at cutoff", async () => {
  const t = setup(),
    id = await seed(t),
    provider = providers({ rejectInstagram: true });
  await t.action(internal.socialActions.process, { id });
  await t.run((ctx) => ctx.db.patch(id, { dueAt: Date.now() + 899000 }));
  await t.action(internal.socialActions.process, { id });
  const job = (await t.query(internal.social.get, { id }))!;
  assert.equal(provider.deletes.length, 1);
  assert.equal(job.facebook.status, "cancelled");
  assert.equal(job.open, false);
});
test("pause cancels queued posts and never generates or republishes", async () => {
  const t = setup(),
    id = await seed(t),
    provider = providers();
  await t.action(internal.socialActions.process, { id });
  SOCIAL_CONFIG.enabled = false;
  await t.action(internal.socialActions.process, { id });
  assert.equal(provider.deletes.length, 2);
  assert.equal(provider.creates.length, 2);
  assert.equal((await t.query(internal.social.get, { id }))!.open, false);
});
test("partial publication preserves the sent post and cancels the remaining queue", async () => {
  const t = setup(),
    id = await seed(t),
    provider = providers();
  await t.action(internal.socialActions.process, { id });
  provider.posts.get("post-1").status = "sent";
  SOCIAL_CONFIG.enabled = false;
  await t.action(internal.socialActions.process, { id });
  assert.deepEqual(provider.deletes, ["post-2"]);
  assert.equal(
    (await t.query(internal.social.get, { id }))!.facebook.status,
    "sent",
  );
});
test("cancellation failure remains visible and keeps reconciliation open", async () => {
  const t = setup(),
    id = await seed(t),
    provider = providers({ cancelFails: true });
  await t.action(internal.socialActions.process, { id });
  SOCIAL_CONFIG.enabled = false;
  await t.action(internal.socialActions.process, { id });
  const job = (await t.query(internal.social.get, { id }))!;
  assert.ok(job.open);
  assert.match(job.facebook.error!, /Cancellation unconfirmed/);
  assert.equal(provider.creates.length, 2);
});
test("unavailable stored image prevents both submissions", async () => {
  const t = setup(),
    id = await seed(t),
    provider = providers({ assetFails: true });
  await t.action(internal.socialActions.process, { id });
  assert.equal(provider.creates.length, 0);
  assert.ok((await t.query(internal.social.get, { id }))!.error);
});
test("unavailable renderer does not publish or replace existing content", async () => {
  const t = setup(),
    id = await seed(t, { imageId: undefined }),
    provider = providers({ rendererFails: true });
  await t.action(internal.socialActions.process, { id });
  assert.equal(provider.creates.length, 0);
  assert.deepEqual(
    (await t.query(internal.social.get, { id }))!.content,
    SAMPLE_CONTENT,
  );
});
test("invalid model output stops after two attempts and holds the day", async () => {
  const t = setup(),
    id = await seed(t, { content: undefined, imageId: undefined }),
    provider = providers({ invalidAi: true });
  await t.action(internal.socialActions.process, { id });
  const job = (await t.query(internal.social.get, { id }))!;
  assert.equal(provider.aiCalls(), 2);
  assert.equal(job.generationAttempts, 2);
  assert.equal(job.open, false);
  assert.equal(provider.creates.length, 0);
});
test("source change cancels old queued content", async () => {
  const t = setup(),
    id = await seed(t),
    provider = providers();
  await t.action(internal.socialActions.process, { id });
  await t.run((ctx) => ctx.db.patch(id, { sourceVersion: "old" }));
  await t.action(internal.socialActions.process, { id });
  assert.equal(provider.deletes.length, 2);
  assert.equal(provider.creates.length, 2);
});
test("no public social functions are exported; image route rejects unauthenticated calls", async () => {
  const functions = await import("../convex/social");
  for (const fn of Object.values(functions)) assert.equal(fn.isInternal, true);
  const { POST } = await import("../app/api/internal/social-image/route");
  const response = await POST(
    new Request("https://example.test/api/internal/social-image", {
      method: "POST",
      body: "{}",
    }),
  );
  assert.equal(response.status, 401);
});
test("reconciliation never matches a different caption", async () => {
  const t = setup(),
    id = await seed(t),
    provider = providers({ timeoutInstagram: true });
  await t.action(internal.socialActions.process, { id });
  const job = (await t.query(internal.social.get, { id }))!;
  provider.posts.set("unrelated", {
    id: "unrelated",
    text: captionFor(SAMPLE_CONTENT, "instagram", job.date) + " other",
    channelId: job.instagramChannelId,
    dueAt: new Date(job.dueAt).toISOString(),
    status: "scheduled",
  });
  await t.action(internal.socialActions.process, { id });
  assert.equal(
    (await t.query(internal.social.get, { id }))!.instagram.id,
    undefined,
  );
});

test("one failed lookup does not prevent cancelling the other platform during pause", async () => {
  const t = setup(),
    id = await seed(t),
    options = { facebookReadFails: false },
    provider = providers(options);
  await t.action(internal.socialActions.process, { id });
  SOCIAL_CONFIG.enabled = false;
  options.facebookReadFails = true;
  await t.action(internal.socialActions.process, { id });
  assert.deepEqual(provider.deletes, ["post-2"]);
  const job = (await t.query(internal.social.get, { id }))!;
  assert.ok(job.open);
  assert.match(job.facebook.error!, /Cancellation unconfirmed/);
});

test("a paused deployment rejects a submission even if an older worker holds the lease", async () => {
  const t = setup(),
    id = await seed(t);
  await t.mutation(internal.social.claim, { id, token: "worker" });
  SOCIAL_CONFIG.enabled = false;
  assert.equal(
    await t.mutation(internal.social.beginSubmission, {
      id,
      token: "worker",
      platform: "facebook",
    }),
    false,
  );
});

test("free library schedules a complete pair without OpenAI credentials or calls", async () => {
  SOCIAL_CONFIG.contentMode = "library";
  delete process.env.OPENAI_API_KEY;
  const t = setup(),
    id = await seed(t, { content: undefined, imageId: undefined });
  const provider = providers();
  await t.action(internal.socialActions.process, { id });
  const job = (await t.query(internal.social.get, { id }))!;
  assert.equal(provider.aiCalls(), 0);
  assert.equal(provider.creates.length, 2);
  assert.equal(job.facebook.status, "scheduled");
  assert.equal(job.instagram.status, "scheduled");
  assert.equal(
    (await t.action(internal.socialActions.preflight, {})).ready,
    true,
  );
});

test("creative-v2 failure skips its slot without invoking library fallback or publishing", async () => {
  const t=setup(), provider=providers();
  const id=await seed(t,{engine:"eve",slot:"morning",content:undefined,imageId:undefined});
  await t.run(async ctx=>{
    await ctx.db.insert("socialAgentSettings",{key:"social",mode:"automatic",trialAccepted:true,updatedAt:Date.now()});
    const job=await ctx.db.get(id);
    await ctx.db.insert("socialAgentRuns",{requestId:"failed-creative",assignmentId:id,date:job!.date,slot:"morning",mode:"publish",sourceVersion:socialSourceVersion(),editorialVersion:"creative-v2",status:"failed",version:3,trial:false,error:"Payoff repeats an earlier post.",createdAt:Date.now(),updatedAt:Date.now()});
  });
  await t.action(internal.socialActions.process,{id});
  const job=(await t.query(internal.social.get,{id}))!;
  assert.equal(job.open,false);assert.equal(job.content,undefined);
  assert.match(job.error!,/Slot skipped: editorial/);
  assert.equal(provider.creates.length,0);assert.equal(provider.aiCalls(),0);
});

test("the online publisher expires local assignments at cutoff while the Mac is offline", async () => {
  const t = setup(), provider = providers();
  const id = await seed(t, { engine: "eve", slot: "morning", content: undefined, imageId: undefined, dueAt: Date.now() + 899000 });
  const runId = await t.run(async ctx => {
    await ctx.db.insert("socialAgentSettings", { key: "social", mode: "automatic", executionMode: "local-chatgpt", trialAccepted: true, updatedAt: Date.now() });
    const post = await ctx.db.get(id);
    return ctx.db.insert("socialAgentRuns", { requestId: "offline-cutoff", assignmentId: id, date: post!.date, slot: "morning", mode: "publish", sourceVersion: socialSourceVersion(), executionMode: "local-chatgpt", editorialVersion: "creative-v2", status: "pending", version: 0, trial: false, createdAt: Date.now(), updatedAt: Date.now() });
  });
  await t.action(internal.socialActions.process, { id });
  const run = (await t.query(internal.socialAgent.context, { runId })).run;
  assert.equal(run.status, "failed");
  assert.match(run.error!, /publication cutoff/);
  assert.equal((await t.query(internal.social.get, { id }))!.open, false);
  assert.equal(provider.creates.length, 0);
  assert.equal(provider.aiCalls(), 0);
});
