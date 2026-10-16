import test from "node:test";
import assert from "node:assert/strict";
import {
  nextDeliveryState,
  parseTelnyxEvent,
  canMessage,
  readinessBlockers,
} from "./automation-policy.ts";
import { resolveLeadHandoff } from "./lead-handoff.ts";
import { ROOFREPLY_DEMO_10DLC } from "./ten-dlc-demo-campaign.ts";

test("demo registration cannot activate a pilot business", () => {
  assert.ok(
    readinessBlockers({
      isDemoAccount: false,
      campaignId: ROOFREPLY_DEMO_10DLC.campaign.id,
    }).includes("The RoofReply demo campaign cannot activate a pilot business"),
  );
});

test("approved flags alone never permit messaging", () => {
  assert.equal(
    canMessage(
      { campaignStatus: "approved", verificationStatus: "approved" },
      "+12025550199",
    ),
    false,
  );
});
test("delivery receipts preserve terminal states", () => {
  assert.equal(nextDeliveryState("delivered", "sent"), "delivered");
  assert.equal(nextDeliveryState("failed", "sent"), "failed");
  assert.equal(nextDeliveryState("accepted", "delivery_failed"), "failed");
});
test("malformed Telnyx payloads are rejected", () => {
  assert.throws(() =>
    parseTelnyxEvent({
      data: {
        id: "x",
        event_type: "message.received",
        occurred_at: new Date().toISOString(),
        payload: {},
      },
    }),
  );
});
test("emergency leads override automatic booking", () => {
  const decision = resolveLeadHandoff({
    mode: "booking_link",
    isQualified: true,
    urgency: "high",
    bookingLink: "https://calendly.com/example/roof",
  });
  assert.equal(decision.shouldSendBookingLink, false);
  assert.equal(decision.shouldNotifyContractor, true);
});
