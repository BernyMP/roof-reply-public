import { test } from "node:test";
import assert from "node:assert/strict";
import { collectSubscriptionStream } from "./subscription-stream.ts";

type Stream = Parameters<typeof collectSubscriptionStream>[0];
type Part = Stream["stream"] extends ReadableStream<infer T> ? T : never;
const source = (parts: Part[]): Stream => ({ stream: new ReadableStream({ start(controller) { parts.forEach(part => controller.enqueue(part)); controller.close(); } }) });
const finish: Part = { type: "finish", finishReason: { unified: "stop", raw: "completed" }, usage: { inputTokens: { total: 20, noCache: 20, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 7, text: 3, reasoning: 4 } } };

test("subscription compaction retains text, encrypted reasoning metadata, and reported usage", async () => {
  const result = await collectSubscriptionStream(source([
    { type: "stream-start", warnings: [] },
    { type: "reasoning-start", id: "r" },
    { type: "reasoning-end", id: "r", providerMetadata: { openai: { encryptedContent: "opaque" } } },
    { type: "text-start", id: "t" },
    { type: "text-delta", id: "t", delta: "Saved " },
    { type: "text-delta", id: "t", delta: "draft." },
    { type: "text-end", id: "t" }, finish,
  ]));
  assert.deepEqual(result.content, [
    { type: "reasoning", text: "", providerMetadata: { openai: { encryptedContent: "opaque" } } },
    { type: "text", text: "Saved draft.", providerMetadata: undefined },
  ]);
  assert.equal(result.usage.outputTokens.total, 7);
});

test("interrupted subscription streams cannot appear successful or settle unknown usage", async () => {
  await assert.rejects(collectSubscriptionStream(source([])), /without confirmed usage/);
  await assert.rejects(collectSubscriptionStream(source([{ type: "error", error: new Error("quota exhausted") }])), /quota exhausted/);
});

test("subscription stream collection preserves completed tool calls and sources", async () => {
  const parts: Part[] = [
    { type: "tool-input-start", id: "call", toolName: "search" },
    { type: "tool-input-delta", id: "call", delta: "{}" },
    { type: "tool-call", toolCallId: "call", toolName: "search", input: "{}", providerExecuted: true },
    { type: "source", sourceType: "url", id: "source", url: "https://www.osha.gov/" },
    finish,
  ];
  const result = await collectSubscriptionStream(source(parts));
  assert.deepEqual(result.content, parts.slice(2, 4));
});
