import test from "node:test";
import assert from "node:assert/strict";
import { eventDemoDay, isSingleSms, eventDemoSms, EVENT_DEMO_OPENING, EVENT_DEMO_CLOSING } from "./event-demo-policy.ts";

test("daily quotas reset at Pacific midnight including daylight saving changes", () => {
  assert.equal(eventDemoDay(Date.parse("2026-10-16T06:59:59Z")), "2026-10-15");
  assert.equal(eventDemoDay(Date.parse("2026-10-16T07:00:00Z")), "2026-10-16");
  assert.equal(eventDemoDay(Date.parse("2026-12-16T07:59:59Z")), "2026-12-15");
  assert.equal(eventDemoDay(Date.parse("2026-12-16T08:00:00Z")), "2026-12-16");
});
test("SMS limits account for GSM extensions and UTF-16 emoji", () => {
  assert.equal(isSingleSms("a".repeat(160)), true);
  assert.equal(isSingleSms("a".repeat(161)), false);
  assert.equal(isSingleSms("^".repeat(80)), true);
  assert.equal(isSingleSms("^".repeat(81)), false);
  assert.equal(isSingleSms("😀".repeat(35)), true);
  assert.equal(isSingleSms("😀".repeat(36)), false);
  assert.equal(isSingleSms(EVENT_DEMO_OPENING), true);
  assert.equal(isSingleSms(EVENT_DEMO_CLOSING), true);
  assert.equal(isSingleSms(eventDemoSms("a".repeat(500))), true);
});
