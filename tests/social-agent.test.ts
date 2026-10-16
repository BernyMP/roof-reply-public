import { SOCIAL_CONFIG } from "@roofreply/social-agent/config";
import test, { beforeEach } from "node:test";
beforeEach((t) => {
  Object.assign(SOCIAL_CONFIG, { enabled: true, sampleApproved: true, instagramBioConfirmed: true });
  if ("mock" in t) t.mock.timers.enable({ apis: ["setTimeout"] });
});
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { convexTest } from "convex-test";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";
import { internal } from "../convex/_generated/api";
import { SOCIAL_LIBRARY } from "@roofreply/social-agent/library";
import {
  AGENT_LIMITS,
  slotTopic,
} from "@roofreply/social-agent/agent-contract";
function setup() {
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
  return convexTest(schema, modules);
}
// Existing regression fixtures represent runs created before creative-v2.
async function createLegacyRun(
  t: ReturnType<typeof setup>,
  args: {
    requestId: string;
    date: string;
    slot: "morning" | "afternoon";
    assignmentId?: Id<"socialPosts">;
    trial?: boolean;
  },
) {
  const id = await t.mutation(internal.socialAgent.createRun, args);
  await t.run(async (ctx) => ctx.db.patch(id, { editorialVersion: undefined }));
  return id;
}
test("Eve run requests are idempotent and previews never create publishing assignments", async () => {
  const t = setup();
  const args = {
    requestId: "preview-unique",
    date: "2026-10-01",
    slot: "morning" as const,
  };
  const a = await createLegacyRun(t, args);
  const b = await createLegacyRun(t, args);
  assert.equal(a, b);
  assert.equal(
    (await t.query(internal.socialAgent.snapshot, {})).posts.length,
    0,
  );
});
test("usage reservations cannot be replayed and per-run budget stops further calls", async () => {
  const t = setup();
  const runId = await createLegacyRun(t, {
    requestId: "budget-run",
    date: "2026-10-01",
    slot: "morning",
  });
  await t.mutation(internal.socialAgent.reserve, {
    runId,
    key: "first",
    category: "model",
  });
  await assert.rejects(
    t.mutation(internal.socialAgent.reserve, {
      runId,
      key: "first",
      category: "model",
    }),
  );
  for (let i = 1; i < AGENT_LIMITS.maxModelCalls; i++)
    await t.mutation(internal.socialAgent.reserve, {
      runId,
      key: String(i),
      category: "model",
    });
  await assert.rejects(
    t.mutation(internal.socialAgent.reserve, {
      runId,
      key: "excess",
      category: "model",
    }),
  );
});

test("generation dispatch is serialized and model reservations pace concurrent sessions", async () => {
  const t = setup();
  const runIds = await Promise.all(
    ["morning", "afternoon"].map((slot) =>
      createLegacyRun(t, {
        requestId: `paced-${slot}`,
        date: "2026-10-01",
        slot: slot as "morning" | "afternoon",
      }),
    ),
  );
  assert.equal(
    await t.mutation(internal.socialAgent.dispatch, { runId: runIds[0] }),
    true,
  );
  assert.equal(
    await t.mutation(internal.socialAgent.dispatch, { runId: runIds[1] }),
    "queued",
  );
  const reservations = await Promise.all(
    ["writer", "reviewer"].map((key) =>
      t.mutation(internal.socialAgent.reserve, {
        runId: runIds[0],
        key,
        category: "model",
      }),
    ),
  );
  const times = reservations.map((r) => r.notBefore).sort();
  assert.ok(times[1] - times[0] >= 20000);
  await t.mutation(internal.socialAgent.dispatch, {
    runId: runIds[0],
    error: "Provider allowance exhausted.",
  });
  assert.equal(
    await t.mutation(internal.socialAgent.dispatch, { runId: runIds[1] }),
    true,
  );
});

test("GPT-5.4 reservations enforce the existing monthly ceiling and settle at the new tariff", async () => {
  const t = setup();
  const runId = await createLegacyRun(t, {
    requestId: "editorial-budget",
    date: "2026-10-01",
    slot: "morning",
  });
  const first = await t.mutation(internal.socialAgent.reserve, {
    runId,
    key: "editorial",
    category: "model",
    model: "openai/gpt-5.4",
  });
  assert.equal(first.reservedUsd, 0.45);
  await t.mutation(internal.socialAgent.settle, {
    id: first.id,
    actualUsd: 0.2,
  });
  await assert.rejects(
    t.mutation(internal.socialAgent.reserve, {
      runId,
      key: "unknown",
      category: "model",
      model: "unapproved-model",
    }),
    /Unapproved social model/,
  );
  // Unknown usage retains its reservation. 0.2 + 21 * 0.45 = 9.65.
  for (let i = 0; i < 21; i++) {
    await t.mutation(internal.socialAgent.reserve, {
      runId,
      key: `pending-${i}`,
      category: "model",
      model: "openai/gpt-5.4",
    });
  }
  await assert.rejects(
    t.mutation(internal.socialAgent.reserve, {
      runId,
      key: "over-budget",
      category: "model",
      model: "openai/gpt-5.4",
    }),
    /Monthly budget exhausted/,
  );
});

test("approved runs allow only bounded closing responses without changing approval", async () => {
  const t = setup();
  const runId = await createLegacyRun(t, {
    requestId: "closing-run",
    date: "2026-10-01",
    slot: "morning",
  });
  await t.run((ctx) => ctx.db.patch(runId, { status: "ready" }));
  for (let i = 0; i < 3; i++)
    await t.mutation(internal.socialAgent.reserve, {
      runId,
      key: `closing-${i}`,
      category: "model",
    });
  await assert.rejects(
    t.mutation(internal.socialAgent.reserve, {
      runId,
      key: "excess",
      category: "model",
    }),
  );
  await t.mutation(internal.socialAgent.dispatch, {
    runId,
    error: "Closing response failed.",
  });
  assert.equal(
    (await t.query(internal.socialAgent.context, { runId })).run.status,
    "ready",
  );
});
test("draft approval requires independent inspection of the exact current version", async () => {
  const t = setup(),
    date = "2026-10-01",
    slot = "morning" as const;
  const runId = await createLegacyRun(t, {
    requestId: "review-run",
    date,
    slot,
  });
  await t.mutation(internal.socialAgent.dispatch, {
    runId,
    eveRunId: "writer",
  });
  const imageId = await t.run((ctx) =>
    ctx.storage.store(new Blob(["test image"])),
  );
  const content = SOCIAL_LIBRARY.find(
    (c) => c.topic === slotTopic(date, slot),
  )!;
  await t.mutation(internal.socialAgent.saveDraft, {
    runId,
    expectedVersion: 0,
    content,
    imageId,
    imageHash: "hash",
  });
  const review = {
    runId,
    version: 1,
    approved: true,
    reason: "Source-backed, readable, original.",
    sessionId: "reviewer",
  };
  await assert.rejects(t.mutation(internal.socialAgent.review, review));
  await t.mutation(internal.socialAgent.inspected, {
    runId,
    version: 1,
    sessionId: "writer",
  });
  await assert.rejects(
    t.mutation(internal.socialAgent.review, { ...review, sessionId: "writer" }),
  );
  await t.mutation(internal.socialAgent.inspected, {
    runId,
    version: 1,
    sessionId: "reviewer",
  });
  await t.mutation(internal.socialAgent.review, review);
  assert.equal(
    (await t.query(internal.socialAgent.context, { runId })).run.status,
    "ready",
  );
});
test("operator controls and bridge reject unauthorized callers", async () => {
  const t = setup();
  await assert.rejects(
    t.mutation(internal.socialAgent.control, {
      op: "automatic",
      input: { acceptTrial: true },
      operator: "not-an-operator",
    }),
  );
  const result = await t.fetch("/social-agent/bridge", {
    method: "POST",
    body: JSON.stringify({ op: "snapshot" }),
  });
  assert.equal(result.status, 401);
});

test("two-slot reservations are idempotent and preserve legacy queue records", async () => {
  const t = setup();
  await t.mutation(internal.social.fill, {});
  const before = (await t.query(internal.socialAgent.snapshot, {})).posts;
  assert.equal(before.length, 3);
  await t.run((ctx) =>
    ctx.db.insert("socialAgentSettings", {
      key: "social",
      mode: "automatic",
      cutoverAt: 0,
      trialAccepted: true,
      updatedAt: Date.now(),
    }),
  );
  await t.mutation(internal.social.fill, {});
  await t.mutation(internal.social.fill, {});
  const after = (await t.query(internal.socialAgent.snapshot, {})).posts;
  for (const post of before)
    assert.deepEqual(
      after.find((p) => p._id === post._id),
      post,
    );
  assert.equal(
    new Set(after.map((p) => `${p.date}:${p.slot ?? "morning"}`)).size,
    after.length,
  );
  assert.ok(after.some((p) => p.slot === "afternoon" && p.engine === "eve"));
});

test("paused generation reserves no new slots and does not cancel the existing queue", async () => {
  const t = setup();
  await t.mutation(internal.social.fill, {});
  const before = (await t.query(internal.socialAgent.snapshot, {})).posts;
  await t.run((ctx) =>
    ctx.db.insert("socialAgentSettings", {
      key: "social",
      mode: "paused",
      cutoverAt: 0,
      trialAccepted: true,
      updatedAt: Date.now(),
    }),
  );
  await t.mutation(internal.social.fill, {});
  assert.deepEqual(
    (await t.query(internal.socialAgent.snapshot, {})).posts,
    before,
  );
});

test("Eve waiting releases the publishing lease without provider calls", async () => {
  const t = setup();
  await t.run((ctx) =>
    ctx.db.insert("socialAgentSettings", {
      key: "social",
      mode: "automatic",
      cutoverAt: 0,
      trialAccepted: true,
      updatedAt: Date.now(),
    }),
  );
  await t.mutation(internal.social.fill, {});
  const job = (await t.query(internal.socialAgent.snapshot, {})).posts[0];
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("Unexpected network request");
  };
  try {
    await t.action(internal.socialActions.process, { id: job._id });
  } finally {
    globalThis.fetch = original;
  }
  const result = await t.query(internal.social.get, { id: job._id });
  assert.equal(result?.leaseUntil, 0);
  assert.equal(result?.facebook.status, "pending");
  assert.equal(
    (
      await t.query(internal.socialAgent.generationState, {
        assignmentId: job._id,
      })
    ).run?.status,
    "pending",
  );
});

test("monthly budget and daily research caps serialize concurrent requests", async () => {
  const t = setup();
  const runId = await createLegacyRun(t, {
    requestId: "cap-run",
    date: "2026-10-01",
    slot: "morning",
  });
  await t.run((ctx) =>
    ctx.db.insert("socialAgentUsage", {
      key: "prior-spend",
      runId,
      category: "model",
      month: new Date().toISOString().slice(0, 7),
      reservedUsd: 9.95,
      createdAt: Date.now(),
    }),
  );
  const model = await Promise.allSettled(
    ["a", "b", "c"].map((key) =>
      t.mutation(internal.socialAgent.reserve, {
        runId,
        key,
        category: "model",
      }),
    ),
  );
  assert.equal(model.filter((r) => r.status === "fulfilled").length, 1);
  const search = await Promise.allSettled(
    ["a", "b", "c", "d"].map((key) =>
      t.mutation(internal.socialAgent.reserve, {
        runId,
        key,
        category: "search",
      }),
    ),
  );
  assert.equal(search.filter((r) => r.status === "fulfilled").length, 3);
});

test("three rejected versions end generation and prevent further drafts", async () => {
  const t = setup(),
    date = "2026-10-01",
    slot = "morning" as const;
  const runId = await createLegacyRun(t, {
    requestId: "reject-run",
    date,
    slot,
  });
  const imageId = await t.run((ctx) => ctx.storage.store(new Blob(["image"])));
  const content = SOCIAL_LIBRARY.find(
    (c) => c.topic === slotTopic(date, slot),
  )!;
  for (let version = 1; version <= 3; version++) {
    await t.mutation(internal.socialAgent.saveDraft, {
      runId,
      expectedVersion: version - 1,
      content,
      imageId,
      imageHash: String(version),
    });
    await t.mutation(internal.socialAgent.inspected, {
      runId,
      version,
      sessionId: "reviewer",
    });
    await t.mutation(internal.socialAgent.review, {
      runId,
      version,
      sessionId: "reviewer",
      approved: false,
      reason: "The evidence does not support the angle.",
    });
  }
  assert.equal(
    (await t.query(internal.socialAgent.context, { runId })).run.status,
    "failed",
  );
  await assert.rejects(
    t.mutation(internal.socialAgent.saveDraft, {
      runId,
      expectedVersion: 3,
      content,
      imageId,
      imageHash: "fourth",
    }),
  );
});

test("operator revision fences old sessions and carries feedback into later runs", async () => {
  const t = setup(),
    date = "2026-10-01",
    slot = "morning" as const;
  const oldAllowlist = process.env.SOCIAL_OPERATOR_CLERK_IDS;
  process.env.SOCIAL_OPERATOR_CLERK_IDS = "operator";
  try {
    const runId = await createLegacyRun(t, {
      requestId: "feedback-run",
      date,
      slot,
    });
    const imageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["image"])),
    );
    await t.mutation(internal.socialAgent.saveDraft, {
      runId,
      expectedVersion: 0,
      content: SOCIAL_LIBRARY.find((c) => c.topic === slotTopic(date, slot))!,
      imageId,
      imageHash: "first",
    });
    await t.mutation(internal.socialAgent.inspected, {
      runId,
      version: 1,
      sessionId: "reviewer",
    });
    await t.mutation(internal.socialAgent.review, {
      runId,
      version: 1,
      approved: false,
      sessionId: "reviewer",
      reason: "Use a more direct opening.",
    });
    await t.mutation(internal.socialAgent.control, {
      op: "feedback",
      input: { text: "Prefer direct openings." },
      operator: "operator",
    });
    const nextId = await t.mutation(internal.socialAgent.control, {
      op: "revise",
      input: { id: runId },
      operator: "operator",
    });
    assert.notEqual(nextId, runId);
    await assert.rejects(
      t.mutation(internal.socialAgent.reserve, {
        runId,
        key: "late",
        category: "model",
      }),
    );
    await assert.rejects(
      t.mutation(internal.socialAgent.dispatch, {
        runId,
        eveRunId: "late-session",
      }),
    );
    const next = await t.query(internal.socialAgent.context, {
      runId: nextId as typeof runId,
    });
    assert.equal(next.feedback[0].text, "Prefer direct openings.");
    await t.mutation(internal.socialAgent.preferences, {
      runId: next.run._id,
      expectedVersion: 0,
      tone: "Direct openings.",
      preferredTopics: [slotTopic(date, slot)],
    });
    assert.equal(
      (await t.query(internal.socialAgent.context, { runId: next.run._id }))
        .preferences?.version,
      1,
    );
  } finally {
    if (oldAllowlist === undefined)
      delete process.env.SOCIAL_OPERATOR_CLERK_IDS;
    else process.env.SOCIAL_OPERATOR_CLERK_IDS = oldAllowlist;
  }
});

test("an uncertain dispatch is not repeated and expiration closes late results", async () => {
  const t = setup();
  const runId = await createLegacyRun(t, {
    requestId: "interrupt-run",
    date: "2026-10-01",
    slot: "morning",
  });
  assert.equal(
    await t.mutation(internal.socialAgent.dispatch, { runId }),
    true,
  );
  assert.equal(
    await t.mutation(internal.socialAgent.dispatch, { runId }),
    false,
  );
  await t.action(internal.socialAgentActions.expire, { runId });
  await assert.rejects(
    t.mutation(internal.socialAgent.reserve, {
      runId,
      key: "late",
      category: "model",
    }),
  );
});

test("trial acceptance requires both slots on seven dates and keeps queued posts unchanged", async () => {
  const t = setup(),
    oldAllowlist = process.env.SOCIAL_OPERATOR_CLERK_IDS;
  process.env.SOCIAL_OPERATOR_CLERK_IDS = "operator";
  try {
    await t.mutation(internal.social.fill, {});
    const before = (await t.query(internal.socialAgent.snapshot, {})).posts;
    const runIds: Id<"socialAgentRuns">[] = [];
    for (let day = 1; day <= 14; day++) {
      const runId = await t.mutation(internal.socialAgent.createRun, {
        requestId: `trial-${day}`,
        date: `2026-10-${String(day).padStart(2, "0")}`,
        slot: "morning",
        trial: true,
      });
      runIds.push(runId);
      await t.run((ctx) => ctx.db.patch(runId, { status: "ready" }));
    }
    await assert.rejects(
      t.mutation(internal.socialAgent.control, {
        op: "automatic",
        input: { acceptTrial: true },
        operator: "operator",
      }),
    );
    for (let day = 0; day < 7; day++)
      await t.run((ctx) =>
        ctx.db.patch(runIds[day + 7], {
          date: `2026-10-${String(day + 1).padStart(2, "0")}`,
          slot: "afternoon",
        }),
      );
    await t.mutation(internal.socialAgent.control, {
      op: "automatic",
      input: { acceptTrial: true },
      operator: "operator",
    });
    const after = await t.query(internal.socialAgent.snapshot, {});
    assert.deepEqual(after.posts, before);
    assert.ok(
      after.settings!.cutoverAt! > Math.max(...before.map((p) => p.dueAt)),
    );
  } finally {
    if (oldAllowlist === undefined)
      delete process.env.SOCIAL_OPERATOR_CLERK_IDS;
    else process.env.SOCIAL_OPERATOR_CLERK_IDS = oldAllowlist;
  }
});

test("only a current approved result can transfer once into its live assignment", async () => {
  const t = setup();
  await t.run((ctx) =>
    ctx.db.insert("socialAgentSettings", {
      key: "social",
      mode: "automatic",
      cutoverAt: 0,
      trialAccepted: true,
      updatedAt: Date.now(),
    }),
  );
  await t.mutation(internal.social.fill, {});
  const job = (await t.query(internal.socialAgent.snapshot, {})).posts[0];
  const runId = await createLegacyRun(t, {
    requestId: "acceptance-test",
    date: job.date,
    slot: job.slot!,
    assignmentId: job._id,
  });
  await t.mutation(internal.socialAgent.dispatch, {
    runId,
    eveRunId: "writer",
  });
  const imageId = await t.run((ctx) => ctx.storage.store(new Blob(["image"])));
  const content = SOCIAL_LIBRARY.find(
    (c) => c.topic === slotTopic(job.date, job.slot!),
  )!;
  await t.mutation(internal.socialAgent.saveDraft, {
    runId,
    expectedVersion: 0,
    content,
    imageId,
    imageHash: "hash",
  });
  await t.mutation(internal.socialAgent.inspected, {
    runId,
    version: 1,
    sessionId: "reviewer",
  });
  await t.mutation(internal.socialAgent.review, {
    runId,
    version: 1,
    approved: true,
    reason: "Verified against approved facts and rendered image.",
    sessionId: "reviewer",
  });
  await t.mutation(internal.social.claim, { id: job._id, token: "worker" });
  const args = { runId, assignmentId: job._id, token: "worker" };
  await t.run((ctx) => ctx.db.patch(job._id, { cancelRequested: true }));
  await assert.rejects(t.mutation(internal.socialAgent.acceptDraft, args));
  await t.run((ctx) =>
    ctx.db.patch(job._id, {
      cancelRequested: false,
      sourceVersion: "old-source",
    }),
  );
  await assert.rejects(t.mutation(internal.socialAgent.acceptDraft, args));
  await t.run((ctx) =>
    ctx.db.patch(job._id, { sourceVersion: job.sourceVersion }),
  );
  await t.mutation(internal.socialAgent.acceptDraft, args);
  await assert.rejects(t.mutation(internal.socialAgent.acceptDraft, args));
  await t.action(internal.socialAgentActions.expire, { runId });
  assert.equal(
    (await t.query(internal.socialAgent.context, { runId })).run.status,
    "accepted",
  );
  assert.deepEqual(
    (await t.query(internal.social.get, { id: job._id }))?.content,
    content,
  );
});

test("operator edits a live draft only before lease or provider submission and fences old results", async () => {
  const t = setup();
  const allowlist = process.env.SOCIAL_OPERATOR_CLERK_IDS;
  process.env.SOCIAL_OPERATOR_CLERK_IDS = "operator";
  try {
    await t.run((ctx) =>
      ctx.db.insert("socialAgentSettings", {
        key: "social",
        mode: "automatic",
        cutoverAt: 0,
        trialAccepted: true,
        updatedAt: Date.now(),
      }),
    );
    await t.mutation(internal.social.fill, {});
    const job = (await t.query(internal.socialAgent.snapshot, {})).posts[0];
    const runId = await createLegacyRun(t, {
      requestId: "live-edit",
      date: job.date,
      slot: job.slot!,
      assignmentId: job._id,
    });
    const imageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["image"])),
    );
    const content = SOCIAL_LIBRARY.find(
      (c) => c.topic === slotTopic(job.date, job.slot!),
    )!;
    await t.run(async (ctx) => {
      await ctx.db.patch(runId, { status: "accepted", version: 1 });
      await ctx.db.patch(job._id, {
        content,
        imageId,
        leaseUntil: Date.now() + 60000,
      });
    });
    const args = {
      op: "edit",
      operator: "operator",
      input: {
        id: runId,
        expectedVersion: 1,
        content,
        imageId,
        imageHash: "edited",
      },
    };
    await assert.rejects(t.mutation(internal.socialAgent.control, args));
    await t.run((ctx) =>
      ctx.db.patch(job._id, {
        leaseUntil: 0,
        facebook: { ...job.facebook, attempts: 1 },
      }),
    );
    await assert.rejects(t.mutation(internal.socialAgent.control, args));
    await t.run((ctx) => ctx.db.patch(job._id, { facebook: job.facebook }));
    const nextId = (await t.mutation(
      internal.socialAgent.control,
      args,
    )) as Id<"socialAgentRuns">;
    const next = await t.query(internal.socialAgent.context, { runId: nextId });
    assert.equal(next.run.assignmentId, job._id);
    assert.equal(next.run.version, 2);
    assert.equal(next.drafts[0].review, undefined);
    const previous = (await t.query(internal.socialAgent.context, { runId }))
      .run;
    assert.equal(previous.assignmentId, undefined);
    assert.equal(previous.previousAssignmentId, job._id);
    assert.equal(previous.status, "cancelled");
    const after = await t.query(internal.social.get, { id: job._id });
    assert.equal(after!.content, undefined);
    assert.equal(after!.dueAt, job.dueAt);
    assert.deepEqual(after!.facebook, job.facebook);
    await assert.rejects(
      t.mutation(internal.socialAgent.dispatch, { runId, eveRunId: "late" }),
    );
  } finally {
    if (allowlist === undefined) delete process.env.SOCIAL_OPERATOR_CLERK_IDS;
    else process.env.SOCIAL_OPERATOR_CLERK_IDS = allowlist;
  }
});

test("operator publishes one independently reviewed preview without enabling automation or duplicating a slot", async () => {
  const t = setup(),
    previous = process.env.SOCIAL_OPERATOR_CLERK_IDS;
  process.env.SOCIAL_OPERATOR_CLERK_IDS = "operator";
  try {
    const dueAt = Date.now() + 3600000;
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Phoenix",
    }).format(dueAt);
    const slot = "afternoon" as const;
    const runId = await createLegacyRun(t, {
      requestId: "publish-one",
      date,
      slot,
    });
    const publish = {
      op: "publish",
      input: { id: runId, dueAt },
      operator: "operator",
    };
    await assert.rejects(t.mutation(internal.socialAgent.control, publish));
    await t.mutation(internal.socialAgent.dispatch, {
      runId,
      eveRunId: "writer",
    });
    const imageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["image"])),
    );
    await t.mutation(internal.socialAgent.saveDraft, {
      runId,
      expectedVersion: 0,
      content: SOCIAL_LIBRARY.find((c) => c.topic === slotTopic(date, slot))!,
      imageId,
      imageHash: "reviewed",
    });
    await t.mutation(internal.socialAgent.inspected, {
      runId,
      version: 1,
      sessionId: "reviewer",
    });
    await t.mutation(internal.socialAgent.review, {
      runId,
      version: 1,
      sessionId: "reviewer",
      approved: true,
      reason: "Grounded and readable.",
    });
    await assert.rejects(
      t.mutation(internal.socialAgent.control, {
        ...publish,
        operator: "outsider",
      }),
    );
    await assert.rejects(
      t.mutation(internal.socialAgent.control, {
        ...publish,
        input: { id: runId, dueAt: Date.now() + 900000 },
      }),
    );
    await assert.rejects(
      t.mutation(internal.socialAgent.control, {
        ...publish,
        input: { id: runId, dueAt: Date.now() + 2 * 86400000 },
      }),
    );
    const stale = (await t.query(internal.socialAgent.context, { runId })).run
      .sourceVersion;
    await t.run((ctx) => ctx.db.patch(runId, { sourceVersion: "stale" }));
    await assert.rejects(t.mutation(internal.socialAgent.control, publish));
    await t.run((ctx) => ctx.db.patch(runId, { sourceVersion: stale }));
    const assignmentId = await t.mutation(
      internal.socialAgent.control,
      publish,
    );
    assert.equal(
      await t.mutation(internal.socialAgent.control, publish),
      assignmentId,
    );
    const snapshot = await t.query(internal.socialAgent.snapshot, {});
    assert.equal(snapshot.posts.length, 1);
    assert.equal(snapshot.posts[0].imageId, imageId);
    assert.equal(snapshot.posts[0].dueAt, dueAt);
    assert.equal(snapshot.settings, null);
    assert.equal(snapshot.runs[0].status, "accepted");
    assert.equal(snapshot.posts[0].facebook.attempts, 0);
    // A different approved run cannot occupy the same day/slot.
    const otherId = await createLegacyRun(t, {
      requestId: "publish-other",
      date,
      slot,
    });
    await t.run(async (ctx) => {
      const draft = (await ctx.db.query("socialAgentDrafts").collect())[0];
      const { _id, _creationTime, ...copy } = draft;
      void _id;
      void _creationTime;
      await ctx.db.insert("socialAgentDrafts", { ...copy, runId: otherId });
      await ctx.db.patch(otherId, {
        status: "ready",
        version: 1,
        eveRunId: "other-writer",
      });
    });
    await assert.rejects(
      t.mutation(internal.socialAgent.control, {
        ...publish,
        input: { id: otherId, dueAt },
      }),
    );
  } finally {
    if (previous === undefined) delete process.env.SOCIAL_OPERATOR_CLERK_IDS;
    else process.env.SOCIAL_OPERATOR_CLERK_IDS = previous;
  }
});

test("a saved operator draft cannot be overwritten before review and can start a fresh review session", async () => {
  const t = setup(),
    date = "2026-10-01",
    slot = "afternoon" as const;
  const runId = await createLegacyRun(t, {
    requestId: "editorial-review",
    date,
    slot,
  });
  const imageId = await t.run((ctx) => ctx.storage.store(new Blob(["image"])));
  const content = SOCIAL_LIBRARY.find(
    (c) => c.topic === slotTopic(date, slot),
  )!;
  const args = {
    runId,
    expectedVersion: 0,
    content,
    imageId,
    imageHash: "editorial",
  };
  const original = await t.mutation(internal.socialAgent.saveDraft, args);
  assert.equal(
    (await t.mutation(internal.socialAgent.saveDraft, args))!._id,
    original!._id,
  );
  await assert.rejects(
    t.mutation(internal.socialAgent.saveDraft, {
      ...args,
      expectedVersion: 1,
      imageHash: "overwrite",
    }),
    /Review the current saved draft/,
  );
  assert.equal(
    await t.mutation(internal.socialAgent.dispatch, { runId }),
    true,
  );
  assert.equal(
    await t.mutation(internal.socialAgent.dispatch, { runId }),
    false,
  );
  assert.deepEqual(
    (await t.query(internal.socialAgent.context, { runId })).drafts[0].content,
    content,
  );
});

test("explicit failed-run fallback uses only eligible library content and preserves the failed review", async () => {
  const t = setup(),
    previous = process.env.SOCIAL_OPERATOR_CLERK_IDS;
  process.env.SOCIAL_OPERATOR_CLERK_IDS = "operator";
  try {
    const dueAt = Date.now() + 3600000;
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Phoenix",
    }).format(dueAt);
    const runId = await createLegacyRun(t, {
      requestId: "fallback-one",
      date,
      slot: "afternoon",
    });
    const request = {
      op: "publish-fallback",
      input: { id: runId, dueAt },
      operator: "operator",
    };
    await assert.rejects(t.mutation(internal.socialAgent.control, request));
    await t.mutation(internal.socialAgent.dispatch, {
      runId,
      eveRunId: "writer",
    });
    await t.mutation(internal.socialAgent.dispatch, {
      runId,
      error: "Reviewer rejected the generated draft.",
    });
    await assert.rejects(
      t.mutation(internal.socialAgent.control, {
        ...request,
        operator: "outsider",
      }),
    );
    await assert.rejects(
      t.mutation(internal.socialAgent.control, { ...request, op: "publish" }),
    );
    await assert.rejects(
      t.mutation(internal.socialAgent.control, {
        ...request,
        input: { id: runId, dueAt: Date.now() + 900000 },
      }),
    );
    const id = await t.mutation(internal.socialAgent.control, request);
    assert.equal(await t.mutation(internal.socialAgent.control, request), id);
    const snapshot = await t.query(internal.socialAgent.snapshot, {});
    assert.equal(snapshot.posts.length, 1);
    assert.ok(
      SOCIAL_LIBRARY.some((c) => c.hook === snapshot.posts[0].content?.hook),
    );
    assert.equal(snapshot.posts[0].imageId, undefined);
    assert.equal(snapshot.runs[0].status, "failed");
    assert.equal(snapshot.runs[0].assignmentId, id);
    assert.equal(snapshot.settings, null);
    assert.ok(snapshot.events.some((e) => e.kind === "publication.fallback"));
    // Occupying the date/slot prevents a second fallback run from duplicating it.
    const other = await createLegacyRun(t, {
      requestId: "fallback-two",
      date,
      slot: "afternoon",
    });
    await t.mutation(internal.socialAgent.dispatch, {
      runId: other,
      eveRunId: "other-writer",
    });
    await t.mutation(internal.socialAgent.dispatch, {
      runId: other,
      error: "Unavailable",
    });
    await assert.rejects(
      t.mutation(internal.socialAgent.control, {
        ...request,
        input: { id: other, dueAt },
      }),
    );
  } finally {
    if (previous === undefined) delete process.env.SOCIAL_OPERATOR_CLERK_IDS;
    else process.env.SOCIAL_OPERATOR_CLERK_IDS = previous;
  }
});

test("experiment shares a hard $25 cap across months and categories", async () => {
  const t = setup();
  const runId = await createLegacyRun(t, {
    requestId: "experiment-cap",
    date: "2026-10-01",
    slot: "morning",
  });
  const startedAt = Date.now() - 40 * 86400000;
  await t.run(async (ctx) => {
    await ctx.db.insert("socialAgentSettings", {
      key: "social",
      mode: "preview",
      trialAccepted: false,
      experimentStartedAt: startedAt,
      experimentBudgetUsd: 25,
      postsPerDay: 1,
      updatedAt: Date.now(),
    });
    await ctx.db.insert("socialAgentUsage", {
      runId,
      key: "old-month",
      category: "model",
      month: "2026-08",
      reservedUsd: 24.8,
      actualUsd: 24.8,
      createdAt: startedAt + 1,
    });
  });
  await assert.rejects(
    t.mutation(internal.socialAgent.reserve, {
      runId,
      key: "too-much",
      category: "model",
      model: "openai/gpt-5.4",
    }),
    /experiment budget exhausted/,
  );
  const search = await t.mutation(internal.socialAgent.reserve, {
    runId,
    key: "search",
    category: "search",
  });
  assert.equal(search.reservedUsd, 0.02);
  const snapshot = await t.query(internal.socialAgent.snapshot, {});
  assert.equal(snapshot.usage.length, 2);
});

test("experiment schedules mornings only and never restarts the legacy publisher after expiry", async () => {
  const t = setup();
  const now = Date.now();
  const settingsId = await t.run((ctx) =>
    ctx.db.insert("socialAgentSettings", {
      key: "social",
      mode: "automatic",
      trialAccepted: true,
      cutoverAt: now,
      experimentStartedAt: now,
      experimentEndsAt: now + 14 * 86400000,
      experimentBudgetUsd: 25,
      postsPerDay: 1,
      updatedAt: now,
    }),
  );
  await t.mutation(internal.social.fill, {});
  const before = await t.query(internal.socialAgent.snapshot, {});
  assert.ok(before.posts.length > 0);
  assert.ok(
    before.posts.every(
      (post) => post.engine === "eve" && post.slot === "morning",
    ),
  );
  await t.run((ctx) => ctx.db.patch(settingsId, { experimentEndsAt: now - 1 }));
  await t.mutation(internal.social.fill, {});
  await t.mutation(internal.social.fill, {});
  const after = await t.query(internal.socialAgent.snapshot, {});
  assert.equal(after.settings?.mode, "paused");
  assert.equal(after.posts.length, before.posts.length);
  const runId = await createLegacyRun(t, {
    requestId: "expired-run",
    date: "2026-10-01",
    slot: "morning",
  });
  await assert.rejects(
    t.mutation(internal.socialAgent.reserve, {
      runId,
      key: "expired",
      category: "model",
    }),
    /experiment has ended/,
  );
});

test("editorial approval requires inspected current art and all five quality thresholds", async () => {
  const t = setup();
  const date = "2026-10-01",
    slot = "morning" as const;
  const runId = await createLegacyRun(t, {
    requestId: "editorial-scores",
    date,
    slot,
  });
  await t.mutation(internal.socialAgent.dispatch, {
    runId,
    eveRunId: "writer",
  });
  const imageId = await t.run((ctx) =>
    ctx.storage.store(new Blob(["test image"])),
  );
  const original = SOCIAL_LIBRARY.find(
    (c) => c.topic === slotTopic(date, slot),
  )!;
  const content = {
    ...original,
    action: "save" as const,
    graphic: {
      ...original.graphic,
      design: "statement" as const,
      template: "headline" as const,
      headline: "Who owns the next step?",
      body: "Make the handoff clear.",
      items: [],
    },
  };
  await t.mutation(internal.socialAgent.saveDraft, {
    runId,
    expectedVersion: 0,
    content,
    imageId,
    imageHash: "editorial",
  });
  await t.mutation(internal.socialAgent.inspected, {
    runId,
    version: 1,
    sessionId: "reviewer",
  });
  const review = {
    runId,
    version: 1,
    approved: true,
    reason: "Specific, useful and readable.",
    sessionId: "reviewer",
  };
  await assert.rejects(
    t.mutation(internal.socialAgent.review, review),
    /five quality scores/,
  );
  const scores = {
    hook: 4,
    usefulness: 4,
    specificity: 4,
    design: 4,
    platformFit: 4,
  };
  await assert.rejects(
    t.mutation(internal.socialAgent.review, {
      ...review,
      scores: { ...scores, design: 3 },
    }),
    /five quality scores/,
  );
  await t.mutation(internal.socialAgent.review, { ...review, scores });
  assert.equal(
    (await t.query(internal.socialAgent.context, { runId })).run.status,
    "ready",
  );
});

test("creative-v2 requires a persisted plan and every review criterion despite high scores", async () => {
  const { sampleCreativeContent } =
    await import("../agents/social/src/fixtures/creative.ts");
  const { creativeBrief, reviewChecksSchema } =
    await import("../agents/social/src/creative-plan.ts");
  const t = setup(),
    date = "2026-10-02",
    slot = "morning" as const;
  const runId = await t.mutation(internal.socialAgent.createRun, {
    requestId: "creative-required-plan",
    date,
    slot,
  });
  const content = sampleCreativeContent();
  content.topic = slotTopic(date, slot);
  content.editorial!.candidates[0].stage = creativeBrief(date, slot).stage;
  const imageId = await t.run((ctx) =>
    ctx.storage.store(new Blob(["test image"])),
  );
  const draft = {
    runId,
    expectedVersion: 0,
    content,
    imageId,
    imageHash: "creative",
  };
  await assert.rejects(
    t.mutation(internal.socialAgent.saveDraft, draft),
    /before drafting/,
  );
  await t.mutation(internal.socialAgent.plan, {
    runId,
    expectedVersion: 0,
    plan: content.editorial,
  });
  await assert.rejects(
    t.mutation(internal.socialAgent.saveDraft, {
      ...draft,
      content: {
        ...content,
        hook: "Another hook that does not match the selected plan",
      },
    }),
    /match/,
  );
  const saved = await t.mutation(internal.socialAgent.saveDraft, {
    ...draft,
    content: {
      ...content,
      topic: content.topic === "product" ? "missed_calls" : "product",
    },
  });
  assert.equal(saved!.content.topic, slotTopic(date, slot));
  await t.mutation(internal.socialAgent.inspected, {
    runId,
    version: 1,
    sessionId: "independent",
  });
  const checks = Object.fromEntries(
    Object.keys(reviewChecksSchema.shape).map((k) => [
      k,
      { pass: true, reason: "Checked against this exact current draft." },
    ]),
  );
  const review = {
    runId,
    version: 1,
    sessionId: "independent",
    approved: true,
    reason: "All current checks pass.",
    scores: {
      hook: 5,
      usefulness: 5,
      specificity: 5,
      design: 5,
      platformFit: 5,
    },
    checks,
  };
  await assert.rejects(
    t.mutation(internal.socialAgent.review, {
      ...review,
      checks: {
        ...checks,
        payoff: {
          pass: false,
          reason: "The sample does not deliver its promised reward.",
        },
      },
    }),
    /cannot override/,
  );
  await t.mutation(internal.socialAgent.review, review);
  assert.equal(
    (await t.query(internal.socialAgent.context, { runId })).run.status,
    "ready",
  );
  await t.run((ctx) =>
    ctx.db.patch(runId, { requestId: `revise-${runId}-1`, status: "running" }),
  );
  await assert.rejects(
    t.mutation(internal.socialAgent.review, review),
    /copied approval is historical/,
  );
});

test("creative history retains the last thirty published posts even older than thirty days", async () => {
  const { sampleCreativeContent } =
    await import("../agents/social/src/fixtures/creative.ts");
  const t = setup();
  const runId = await t.mutation(internal.socialAgent.createRun, {
    requestId: "history-window",
    date: "2026-10-02",
    slot: "morning",
  });
  const content = sampleCreativeContent();
  await t.run(async (ctx) => {
    for (let i = 0; i < 34; i++)
      await ctx.db.insert("socialPosts", {
        date: `2020-${String(1 + Math.floor(i / 28)).padStart(2, "0")}-${String(1 + (i % 28)).padStart(2, "0")}`,
        dueAt: Date.UTC(2020, 0, 1) + i * 86400000,
        content,
        generationAttempts: 1,
        sourceVersion: "old-source",
        configRevision: "legacy",
        organizationId: "org",
        facebookChannelId: "fb",
        instagramChannelId: "ig",
        facebook: { status: "sent", attempts: 1 },
        instagram: { status: "sent", attempts: 1 },
        open: false,
        cancelRequested: false,
        leaseUntil: 0,
        nextCheckAt: 0,
        createdAt: 1,
        updatedAt: 1,
      });
  });
  const context = await t.query(internal.socialAgent.context, { runId });
  assert.equal(context.recentIdeas.length, 30);
  assert.equal(
    context.recentIdeas.at(-1)!.at,
    Date.UTC(2020, 0, 1) + 4 * 86400000,
  );
  assert.equal(
    context.recentIdeas[0].lesson,
    content.editorial!.candidates[0].lesson,
  );
});

test("creative failures cannot use explicit library publication and old qualification is superseded", async () => {
  const t = setup(),
    previous = process.env.SOCIAL_OPERATOR_CLERK_IDS;
  process.env.SOCIAL_OPERATOR_CLERK_IDS = "operator";
  try {
    const id = await t.mutation(internal.socialAgent.createRun, {
      requestId: "no-filler-v2",
      date: "2026-10-01",
      slot: "morning",
    });
    await assert.rejects(
      t.mutation(internal.socialAgent.control, {
        op: "publish-fallback",
        input: { id, dueAt: Date.now() + 3600000 },
        operator: "operator",
      }),
      /cannot publish library/,
    );
    for (let day = 1; day <= 7; day++)
      for (const slot of ["morning", "afternoon"] as const) {
        const runId = await createLegacyRun(t, {
          requestId: `superseded-${day}-${slot}`,
          date: `2026-10-0${day}`,
          slot,
        });
        await t.run((ctx) =>
          ctx.db.patch(runId, { trial: true, status: "ready" }),
        );
      }
    await assert.rejects(
      t.mutation(internal.socialAgent.control, {
        op: "automatic",
        input: { acceptTrial: true },
        operator: "operator",
      }),
      /Accept fourteen/,
    );
    assert.equal(
      (await t.query(internal.socialAgent.snapshot, {})).posts.length,
      0,
    );
  } finally {
    if (previous === undefined) delete process.env.SOCIAL_OPERATOR_CLERK_IDS;
    else process.env.SOCIAL_OPERATOR_CLERK_IDS = previous;
  }
});

test("post-specific feedback follows revisions and never leaks to another assignment", async () => {
  const t = setup(),
    previous = process.env.SOCIAL_OPERATOR_CLERK_IDS;
  process.env.SOCIAL_OPERATOR_CLERK_IDS = "operator";
  try {
    const one = await t.mutation(internal.socialAgent.createRun, {
      requestId: "feedback-one",
      date: "2026-10-01",
      slot: "morning",
    });
    const two = await t.mutation(internal.socialAgent.createRun, {
      requestId: "feedback-two",
      date: "2026-10-02",
      slot: "morning",
    });
    const revision = await t.mutation(internal.socialAgent.createRun, {
      requestId: `revise-${one}-0`,
      date: "2026-10-01",
      slot: "morning",
    });
    await t.mutation(internal.socialAgent.control, {
      op: "feedback",
      input: {
        runId: one,
        text: "Use a single script for this assigned post.",
      },
      operator: "operator",
    });
    const old = await t.mutation(internal.socialAgent.control, {
      op: "feedback",
      input: { text: "Define the example policy before applying it." },
      operator: "operator",
    });
    await t.mutation(internal.socialAgent.control, {
      op: "scope-feedback",
      input: { id: old, runId: two },
      operator: "operator",
    });
    const a = await t.query(internal.socialAgent.context, { runId: revision });
    const b = await t.query(internal.socialAgent.context, { runId: two });
    assert.deepEqual(
      a.feedback.map((f) => f.text),
      ["Use a single script for this assigned post."],
    );
    assert.deepEqual(
      b.feedback.map((f) => f.text),
      ["Define the example policy before applying it."],
    );
    assert.equal(
      (await t.query(internal.socialAgent.snapshot, {})).feedback.length,
      2,
    );
  } finally {
    if (previous === undefined) delete process.env.SOCIAL_OPERATOR_CLERK_IDS;
    else process.env.SOCIAL_OPERATOR_CLERK_IDS = previous;
  }
});
