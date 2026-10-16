import test from "node:test";
import assert from "node:assert/strict";
import { captureMetadataSchema, followUpReceipt } from "./lead-capture-metadata.ts";
import { emitLeadOnce } from "./conversion-receipt.ts";
import { safeAnalyticsProperties } from "./analytics-policy.ts";

test("capture strips identifying campaign data and rejects unsupported consent", () => {
  const parsed = captureMetadataSchema.parse({
    attribution: { utm_source: "meta", utm_campaign: "az_follow_up_kit", utm_content: "owner@example.test", email: "owner@example.test", fbclid: "secret" },
    followUpRequest: { version: "kit_follow_up_v1", accepted: true, requestedAt: 1, wording: "untrusted" },
  });
  assert.deepEqual(parsed.attribution, { utm_source: "meta", utm_campaign: "az_follow_up_kit" });
  assert.deepEqual(parsed.followUpRequest, { version: "kit_follow_up_v1", accepted: true });
  assert.throws(() => captureMetadataSchema.parse({ followUpRequest: { version: "kit_follow_up_v1", accepted: false } }));
  assert.throws(() => captureMetadataSchema.parse({ followUpRequest: { version: "future", accepted: true } }));
  assert.equal(captureMetadataSchema.parse({}).followUpRequest, undefined);
  const receipt = followUpReceipt("kit_follow_up_v1", 123);
  assert.equal(receipt.requestedAt, 123);
  assert.match(receipt.wording, /three practical follow-up emails/);
});

test("Lead emits once per saved receipt across retries and reloads", () => {
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
  const id = "a-valid-opaque-receipt-123";
  let calls = 0;
  const emit = () => { calls++; return true; };
  const seen = new Set<string>();
  assert.equal(emitLeadOnce(id, () => false, seen, storage), false); // pixel not ready
  assert.equal(emitLeadOnce(id, emit, seen, storage), true);
  assert.equal(emitLeadOnce(id, emit, seen, storage), false);
  assert.equal(emitLeadOnce(id, emit, new Set(), storage), false);
  assert.equal(emitLeadOnce("email@example.test", emit, seen, storage), false);
  assert.equal(calls, 1);
});

test("blocked storage still deduplicates within the page", () => {
  const storage = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
  const seen = new Set<string>();
  assert.equal(emitLeadOnce("opaque-receipt-123456", () => true, seen, storage), true);
  assert.equal(emitLeadOnce("opaque-receipt-123456", () => true, seen, storage), false);
});

test("offer analytics allow campaign IDs but reject answers and identities", () => {
  for (const event of ["marketing_offer_viewed", "calculator_offer_clicked", "kit_offer_clicked"]) {
    assert.deepEqual(safeAnalyticsProperties(event, {
      utm_source: "meta", utm_content: "missed_call", utm_campaign: "owner@example.test",
      email: "owner@example.test", answers: { missedCallsPerWeek: 20 }, monthlyRevenue: 5000,
    }), { utm_source: "meta", utm_content: "missed_call" });
  }
});
