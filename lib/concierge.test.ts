import test from "node:test";
import assert from "node:assert/strict";
import {
  addServiceAreas,
  businessDetails,
  businessFormErrors,
} from "./guided-onboarding.ts";
import {
  conciergeBlockers,
  conciergeContactCopy,
  conciergeDrafts,
  CONCIERGE_CHECKLIST,
  pendingContactChannels,
  sameDayDeadline,
  type CustomerConcierge,
} from "./concierge.ts";
import { safeAnalyticsProperties } from "./analytics-policy.ts";

test("same-day deadline follows Phoenix across UTC boundaries, weekends and DST", () => {
  for (const [input, expected] of [
    ["2026-09-20T06:59:00Z", "2026-09-20T06:59:59.999Z"],
    ["2026-09-20T07:00:00Z", "2026-09-21T06:59:59.999Z"],
    ["2026-03-08T08:00:00Z", "2026-03-09T06:59:59.999Z"],
    ["2026-12-31T23:00:00Z", "2027-01-01T06:59:59.999Z"],
  ])
    assert.equal(
      new Date(sameDayDeadline(Date.parse(input))).toISOString(),
      expected,
    );
});
test("setup contact copy tracks both channels and never repeats a past-day promise", () => {
  const record: CustomerConcierge = {
    contactPreference: "both",
    enrolledAt: 100,
    followUpDueAt: 1000,
    nextAction: "Arrange kickoff",
    nextActionOwner: "berny",
    setupComplete: false,
    testComplete: false,
  };
  assert.deepEqual(pendingContactChannels(record), ["email", "sms"]);
  assert.match(
    conciergeContactCopy(record, 500, true),
    /email and text you today/,
  );
  const emailed = { ...record, emailContactedAt: 200 };
  assert.deepEqual(pendingContactChannels(emailed), ["sms"]);
  assert.match(conciergeContactCopy(emailed, 500, true), /text you today/);
  assert.doesNotMatch(conciergeContactCopy(emailed, 1001, true), /today/);
  assert.match(conciergeContactCopy(emailed, 1001, true), /still pending/);
  assert.match(
    conciergeContactCopy({ ...emailed, smsContactedAt: 300 }, 500),
    /has contacted/,
  );
});
test("normalization accepts bare websites and preserves existing radius chips", () => {
  const form = {
    legalBusinessName: "Roofer",
    businessPhone: "6025550100",
    areas: "Mesa",
    website: "example.com/roofing",
  };
  assert.deepEqual(businessFormErrors(form), {});
  assert.equal(businessDetails(form).website, "https://example.com/roofing");
  for (const website of [
    "javascript:alert(1)",
    "ftp://example.com",
    "https://user:pass@example.com",
    "bad website.com",
  ])
    assert.ok(businessFormErrors({ ...form, website }).website);
  const original = [
    { type: "radius" as const, value: "20 miles from Phoenix, AZ" },
  ];
  assert.deepEqual(addServiceAreas(original, "Mesa, 85251, mesa\n85251"), [
    ...original,
    { type: "city", value: "Mesa" },
    { type: "zip", value: "85251" },
  ]);
});
test("checklist completeness requires every item and a confirmation", () => {
  const complete = CONCIERGE_CHECKLIST.map(({ key }) => ({
    key,
    status: "complete" as const,
    reference: "Reviewed with owner",
    updatedAt: 1,
    updatedBy: "operator",
  }));
  assert.equal(conciergeBlockers([]).length, CONCIERGE_CHECKLIST.length);
  assert.deepEqual(conciergeBlockers(complete), []);
  assert.equal(
    conciergeBlockers(
      complete.map((item) =>
        item.key === "launch" ? { ...item, reference: " " } : item,
      ),
    ).length,
    1,
  );
});
test("welcome drafts separate a fuller email from a short personal text", () => {
  const drafts = conciergeDrafts("Sam", "Summit Roofing");
  assert.match(drafts.email, /test the complete experience/);
  assert.match(drafts.sms, /Summit Roofing/);
  assert.ok(drafts.sms.length < drafts.email.length / 2);
});
test("analytics accepts only named onboarding measurements and strips private data", () => {
  assert.equal(safeAnalyticsProperties("unknown", {}), null);
  assert.deepEqual(
    safeAnalyticsProperties("onboarding_validation_failed", {
      step: 2,
      elapsed_ms: 100,
      flow_version: "concierge_v1",
      field: "alertPhone",
      email: "private@example.test",
      phone: "6025550100",
      $current_url: "https://example.com/private",
      message: "Private content",
      areas: ["Mesa"],
    }),
    {
      step: 2,
      elapsed_ms: 100,
      flow_version: "concierge_v1",
      field: "alertPhone",
    },
  );
  assert.deepEqual(
    safeAnalyticsProperties("onboarding_completed", {
      field: "private value",
      elapsed_ms: NaN,
      step: 99,
    }),
    {},
  );
  assert.deepEqual(
    safeAnalyticsProperties("roofreply_app_loaded", {
      surface: "onboarding",
      step: 1,
    }),
    { surface: "onboarding" },
  );
});
