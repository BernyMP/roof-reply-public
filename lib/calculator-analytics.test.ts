import test from "node:test";
import assert from "node:assert/strict";
import {
  safeAnalyticsProperties,
  calculatorEvents,
} from "./analytics-policy.ts";
test("calculator analytics allow only funnel metadata, never identities or finances", () => {
  for (const event of calculatorEvents)
    assert.deepEqual(
      safeAnalyticsProperties(event, {
        flow_version: "assessment_v2",
        existing_follow_up_known: false,
        name: "Owner",
        email: "owner@example.com",
        company: "Roofing",
        monthlyRevenue: 5460,
        missedCallsPerWeek: 6,
        $geoip_disable: true,
      }),
      {
        flow_version: "assessment_v2",
        existing_follow_up_known: false,
        $geoip_disable: true,
      },
    );
  assert.deepEqual(
    safeAnalyticsProperties("calculator_completed", {
      flow_version: "wrong",
      existing_follow_up_known: "yes",
    }),
    {},
  );
});

test("three-step events allow only bounded progression metadata", () => {
  assert.deepEqual(
    safeAnalyticsProperties("calculator_step_completed", {
      flow_version: "assessment_v3",
      step: 2,
      email: "x@example.test",
      process: "callback",
      answers: {},
      monthlyRevenue: 5000,
    }),
    { flow_version: "assessment_v3", step: 2 },
  );
  assert.deepEqual(
    safeAnalyticsProperties("calculator_step_viewed", {
      step: 4,
      flow_version: "future",
    }),
    {},
  );
});
