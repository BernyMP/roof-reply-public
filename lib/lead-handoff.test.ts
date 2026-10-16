import assert from "node:assert/strict";
import test from "node:test";
import { resolveLeadHandoff } from "./lead-handoff.ts";

test("review first routes qualified leads to contractor review", () => {
  const decision = resolveLeadHandoff({
    mode: "review_first",
    isQualified: true,
    bookingLink: "https://calendly.com/demo",
  });

  assert.equal(decision.shouldSendBookingLink, false);
  assert.equal(decision.shouldNotifyContractor, true);
  assert.equal(decision.status, "needs_contractor_review");
});

test("booking link mode sends link when configured", () => {
  const decision = resolveLeadHandoff({
    mode: "booking_link",
    isQualified: true,
    bookingLink: "https://calendly.com/demo",
  });

  assert.equal(decision.shouldSendBookingLink, true);
  assert.equal(decision.shouldNotifyContractor, false);
  assert.equal(decision.status, "booking_link_sent");
});

test("booking link mode falls back to review when link is missing", () => {
  const decision = resolveLeadHandoff({
    mode: "booking_link",
    isQualified: true,
  });

  assert.equal(decision.shouldSendBookingLink, false);
  assert.equal(decision.shouldNotifyContractor, true);
  assert.equal(decision.status, "needs_contractor_review");
});

test("booking link mode respects configured automatic booking job types", () => {
  const decision = resolveLeadHandoff({
    mode: "booking_link",
    isQualified: true,
    jobType: "Storm damage",
    autoBookingJobTypes: ["leak_repairs"],
    bookingLink: "https://calendly.com/demo",
  });

  assert.equal(decision.shouldSendBookingLink, false);
  assert.equal(decision.shouldNotifyContractor, true);
  assert.equal(decision.status, "needs_contractor_review");
});

test("automatic booking matches insurance job wording without requiring the word job", () => {
  const decision = resolveLeadHandoff({
    mode: "booking_link",
    isQualified: true,
    jobType: "Insurance claim inspection",
    autoBookingJobTypes: ["insurance_jobs"],
    bookingLink: "https://calendly.com/demo",
  });

  assert.equal(decision.shouldSendBookingLink, true);
  assert.equal(decision.shouldNotifyContractor, false);
  assert.equal(decision.status, "booking_link_sent");
});

test("review and booking sends both when link is configured", () => {
  const decision = resolveLeadHandoff({
    mode: "review_and_booking",
    isQualified: true,
    bookingLink: "https://calendly.com/demo",
  });

  assert.equal(decision.shouldSendBookingLink, true);
  assert.equal(decision.shouldNotifyContractor, true);
  assert.equal(decision.status, "booking_link_sent");
});

test("emergency escalation routes high urgency to contractor review", () => {
  const decision = resolveLeadHandoff({
    mode: "emergency_escalation",
    isQualified: true,
    urgency: "high",
    bookingLink: "https://calendly.com/demo",
  });

  assert.equal(decision.shouldSendBookingLink, false);
  assert.equal(decision.shouldNotifyContractor, true);
  assert.equal(decision.status, "needs_contractor_review");
});

test("emergency escalation sends normal qualified jobs to booking", () => {
  const decision = resolveLeadHandoff({
    mode: "emergency_escalation",
    isQualified: true,
    urgency: "medium",
    jobType: "Leak repair",
    autoBookingJobTypes: ["leak_repairs"],
    bookingLink: "https://calendly.com/demo",
  });

  assert.equal(decision.shouldSendBookingLink, true);
  assert.equal(decision.shouldNotifyContractor, false);
  assert.equal(decision.status, "booking_link_sent");
});
