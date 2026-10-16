import test from "node:test";
import assert from "node:assert/strict";
import { campaignQuery, attributedJourneyHref } from "./journey-attribution.ts";
import { safeAnalyticsProperties } from "./analytics-policy.ts";

test("campaign attribution forwards bounded campaign IDs, not contact details or answers", () => {
  assert.equal(campaignQuery("?utm_source=meta&utm_campaign=missed_calls&utm_content=roof-1&email=owner@example.com&missedCalls=20&fbclid=secret"), "utm_source=meta&utm_campaign=missed_calls&utm_content=roof-1");
  assert.equal(campaignQuery("utm_source=owner%40example.com&utm_content=" + "x".repeat(101)), "");
});

test("assessment, offer, and Calendly links keep campaign attribution without changing destination", () => {
  assert.equal(attributedJourneyHref("/calculator", "utm_source=meta"), "/calculator?utm_source=meta");
  assert.equal(attributedJourneyHref("/specials/pilot#offer", "utm_source=meta&email=owner@example.com"), "/specials/pilot?utm_source=meta#offer");
  assert.equal(attributedJourneyHref("https://elsewhere.example/specials/pilot", "utm_source=meta"), "https://elsewhere.example/specials/pilot");
  assert.equal(attributedJourneyHref("https://calendly.com/berny/audit?existing=yes", "utm_source=meta"), "https://calendly.com/berny/audit?existing=yes&utm_source=meta");
  assert.equal(attributedJourneyHref("/pricing", "utm_source=meta"), "/pricing");
  assert.equal(attributedJourneyHref("https://calendly.com.evil.test/", "utm_source=meta"), "https://calendly.com.evil.test/");
});

test("marketing analytics distinguish intent and confirmation views from verified bookings", () => {
  for (const event of ["marketing_audit_clicked", "marketing_booking_confirmation_viewed"]) {
    assert.deepEqual(safeAnalyticsProperties(event, { email: "owner@example.com", invitee_uuid: "untrusted", answers: {}, $geoip_disable: true }), { $geoip_disable: true });
  }
  assert.equal(safeAnalyticsProperties("marketing_booking_completed", {}), null);
});
