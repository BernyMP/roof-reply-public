import test from "node:test";
import assert from "node:assert/strict";
import {
  parseLeadView,
  leadViewUrl,
  needsAction,
  matchesLeadFilter,
  isRealLead,
  maskedLeadPhone,
} from "./lead-presentation.ts";
import { accountPresentation } from "./account-presentation.ts";

test("inbox links round-trip filter, page, and selection without accepting malformed pages", () => {
  const url = leadViewUrl({
    filter: "needs_action",
    page: 3,
    lead: "lead-one",
  });
  assert.deepEqual(
    parseLeadView(new URL(url, "https://example.test").searchParams),
    { filter: "needs_action", page: 3, lead: "lead-one" },
  );
  for (const page of ["-4", "Infinity", "2.5", "no", "9007199254740992", "0"]) {
    assert.equal(parseLeadView(new URLSearchParams({ page })).page, 1);
  }
  assert.deepEqual(parseLeadView(new URLSearchParams("filter=unknown")), {
    filter: "all",
    page: 1,
    lead: null,
  });
  assert.equal(
    leadViewUrl({ filter: "needs_action", page: 3 }),
    "/dashboard/leads?filter=needs_action&page=3",
  );
});
test("follow-up counts use the same statuses as the inbox and exclude simulated records", () => {
  for (const status of [
    "new",
    "qualifying",
    "needs_followup",
    "needs_contractor_review",
  ]) {
    assert.ok(needsAction(status));
    assert.ok(matchesLeadFilter(status, "needs_action"));
  }
  for (const status of [
    "qualified",
    "not_qualified",
    "booking_link_sent",
    "appointment_booked",
  ])
    assert.equal(needsAction(status), false);
  assert.equal(isRealLead({ sampleKey: "sample" }), false);
  assert.equal(isRealLead({ demoSessionId: "session" }), false);
  assert.equal(isRealLead({}), true);
  assert.equal(maskedLeadPhone("+12025550199"), "••• ••• 0199");
});
test("a live flag without verification evidence never presents verified live readiness", () => {
  assert.equal(
    accountPresentation({ activationMode: "live" }).label,
    "Review needed",
  );
  assert.equal(
    accountPresentation({ activationMode: "rehearsal" }).attention,
    true,
  );
  assert.equal(
    accountPresentation({ activationMode: "paused" }).label,
    "Paused",
  );
});
