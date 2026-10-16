import test from "node:test";
import assert from "node:assert/strict";
import {
  BufferClient,
  BufferRequestError,
  verifyChannels,
  type BufferChannel,
} from "./buffer.ts";

const config = {
  organizationId: "org",
  facebookChannelId: "fb",
  instagramChannelId: "ig",
};
const channels: BufferChannel[] = [
  {
    id: "fb",
    name: "RoofReply",
    service: "facebook",
    type: "page",
    organizationId: "org",
    isDisconnected: false,
    isLocked: false,
    isQueuePaused: false,
  },
  {
    id: "ig",
    name: "roofreply",
    service: "instagram",
    type: "business",
    organizationId: "org",
    isDisconnected: false,
    isLocked: false,
    isQueuePaused: false,
    metadata: { defaultToReminders: false },
  },
];
test("only the verified Page and automatically publishing professional Instagram are eligible", () => {
  verifyChannels(channels, config);
  for (const patch of [
    { isDisconnected: true },
    { isQueuePaused: true },
    { type: "profile" },
    { metadata: { defaultToReminders: true } },
  ])
    assert.throws(() =>
      verifyChannels([channels[0], { ...channels[1], ...patch }], config),
    );
  assert.throws(() =>
    verifyChannels(channels, { ...config, organizationId: "different" }),
  );
});
test("Buffer receives identical custom schedule and feed metadata for both platforms", async () => {
  const requests: any[] = [];
  const client = new BufferClient("test", async (_url, init) => {
    const request = JSON.parse(String(init?.body));
    requests.push(request.variables.input);
    return Response.json({
      data: {
        createPost: {
          __typename: "PostActionSuccess",
          post: { id: "post", ...request.variables.input, status: "scheduled" },
        },
      },
    });
  });
  for (const p of ["facebook", "instagram"] as const)
    await client.create(
      p,
      p,
      "caption",
      "https://example.test/image.png",
      1800000000000,
    );
  assert.equal(requests[0].dueAt, requests[1].dueAt);
  assert.equal(requests[0].mode, "customScheduled");
  assert.equal(requests[1].schedulingType, "automatic");
  assert.deepEqual(requests[1].metadata, {
    instagram: { type: "post", shouldShareToFeed: true },
  });
});
test("timeouts, malformed receipts and server failures are uncertain; auth failures are definitive", async () => {
  for (const fetcher of [
    async () => {
      throw new Error("timeout");
    },
    async () => Response.json({ data: {} }),
    async () => new Response("error", { status: 500 }),
  ]) {
    const client = new BufferClient("test", fetcher);
    await assert.rejects(
      () =>
        client.create(
          "facebook",
          "fb",
          "x",
          "https://example.test/x",
          1800000000000,
        ),
      (e) => e instanceof BufferRequestError && e.uncertain,
    );
  }
  const expired = new BufferClient(
    "test",
    async () => new Response("private provider response", { status: 401 }),
  );
  await assert.rejects(
    () =>
      expired.create(
        "facebook",
        "fb",
        "x",
        "https://example.test/x",
        1800000000000,
      ),
    (e) =>
      e instanceof BufferRequestError &&
      !e.uncertain &&
      !e.message.includes("private"),
  );
});
test("reconciliation paginates and matches text, channel, and exact timestamp", async () => {
  let calls = 0;
  const dueAt = 1800000000000;
  const matching = {
    id: "found",
    text: "caption",
    channelId: "fb",
    dueAt: new Date(dueAt).toISOString(),
    status: "scheduled",
  };
  const client = new BufferClient("test", async () => {
    calls++;
    return Response.json({
      data: {
        posts: {
          edges: [
            { node: calls === 1 ? { ...matching, text: "other" } : matching },
          ],
          pageInfo: { hasNextPage: calls === 1, endCursor: "cursor" },
        },
      },
    });
  });
  assert.deepEqual(await client.find("org", "fb", "caption", dueAt), [
    matching,
  ]);
  assert.equal(calls, 2);
});
test("cancellation requires an explicit receipt for the requested post", async () => {
  const client = new BufferClient("test", async () =>
    Response.json({
      data: { deletePost: { __typename: "DeletePostSuccess", id: "wrong" } },
    }),
  );
  await assert.rejects(() => client.cancel("expected"), /confirm cancellation/);
});
