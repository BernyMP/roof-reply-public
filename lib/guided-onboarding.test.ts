import test from "node:test";
import assert from "node:assert/strict";
import {
  businessDetails,
  businessFormErrors,
  guidedSetupDefaults,
  validSetupPhone,
} from "./guided-onboarding.ts";
import { customerSetupPresentation } from "./account-presentation.ts";
import {
  ACCOUNT_SMS_CONSENT_TEXT,
  ACCOUNT_SMS_CONSENT_VERSION,
} from "./account-sms-consent.ts";
import { leadNextStep } from "./lead-presentation.ts";

const form = {
  legalBusinessName: " Summit Roofing ",
  businessPhone: "(602) 555-0100",
  website: "",
  areas: "Phoenix, 85251, Phoenix",
};
const consent = {
  bookingDeliveryPhone: "+16025550100",
  accountSmsConsentGranted: true,
  accountSmsConsentPhone: "+16025550100",
  accountSmsConsentText: ACCOUNT_SMS_CONSENT_TEXT,
  accountSmsConsentVersion: ACCOUNT_SMS_CONSENT_VERSION,
};

test("guided setup validates essential details and normalizes phones and coverage", () => {
  assert.deepEqual(businessFormErrors(form), {});
  assert.deepEqual(businessDetails(form), {
    legalBusinessName: "Summit Roofing",
    businessPhone: "+16025550100",
    website: "",
    serviceAreas: [
      { type: "city", value: "Phoenix" },
      { type: "zip", value: "85251" },
    ],
  });
  assert.equal(
    Object.keys(
      businessFormErrors({
        legalBusinessName: "",
        businessPhone: "12",
        website: "not a url",
        areas: ", ,",
      }),
    ).length,
    4,
  );
  assert.equal(validSetupPhone("555"), false);
  assert.ok(
    businessFormErrors({ ...form, website: "javascript:alert(1)" }).website,
  );
});
test("resuming an older setup preserves radius coverage, preferences, and existing comma-containing areas", () => {
  const areas = [
    { type: "radius" as const, value: "20 miles from Phoenix, AZ" },
  ];
  assert.deepEqual(
    businessDetails({ ...form, areas: areas[0].value }, areas).serviceAreas,
    areas,
  );
  assert.deepEqual(
    guidedSetupDefaults({
      aiTone: "bilingual",
      leadHandoffMode: "review_and_booking",
    }),
    {},
  );
  assert.deepEqual(guidedSetupDefaults({}), {
    aiTone: "friendly",
    leadHandoffMode: "review_first",
  });
  assert.deepEqual(guidedSetupDefaults({ aiTone: "professional" }), {
    leadHandoffMode: "review_first",
  });
});
test("customer setup asks only for customer action and never claims unverified live status", () => {
  assert.equal(
    customerSetupPresentation({}).actionHref,
    "/dashboard/config#handoff",
  );
  const pending = customerSetupPresentation({
    ...consent,
    activationMode: "paused",
  });
  assert.equal(pending.needsConsent, false);
  assert.equal(pending.label, "Setup in progress");
  assert.equal(pending.configurationReady, false);
  assert.equal(pending.live, false);
  assert.equal(
    customerSetupPresentation({ ...consent, activationMode: "live" }).live,
    false,
  );
  assert.equal(
    customerSetupPresentation({ ...consent, accountSmsConsentVersion: "old" })
      .needsConsent,
    true,
  );
  const ready = {
    ...consent,
    provisioningStatus: "ready",
    telnyxPhoneNumber: "+16025550123",
    messagingProfileId: "profile",
    voiceApplicationId: "voice",
    campaignId: "customer-campaign",
    campaignStatus: "approved",
    verificationStatus: "approved",
    providerEvidence: "verified",
    forwardingEvidence: "verified",
    rehearsalEvidence: "verified",
    keywordHandling: "telnyx" as const,
  };
  assert.equal(
    customerSetupPresentation({ ...ready, activationMode: "live" }).live,
    true,
  );
  assert.equal(
    customerSetupPresentation({ ...ready, activationMode: "paused" }).live,
    false,
  );
  assert.equal(
    customerSetupPresentation({ ...ready, activationMode: "rehearsal" }).label,
    "Test mode",
  );
});
test("lead guidance prioritizes urgency without inventing appointments or follow-up for closed inquiries", () => {
  assert.match(
    leadNextStep({ status: "needs_contractor_review", urgency: "high" }).title,
    /urgent/,
  );
  assert.match(
    leadNextStep({ status: "booking_link_sent" }).detail,
    /not a confirmed inspection/,
  );
  assert.equal(
    leadNextStep({ status: "not_qualified", urgency: "high" }).title,
    "No follow-up needed",
  );
  assert.equal(
    leadNextStep({ status: "appointment_booked" }).title,
    "Prepare for the inspection",
  );
});
