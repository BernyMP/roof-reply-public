import test from "node:test";
import assert from "node:assert/strict";
import {
  DEMO_SMS_CONSENT_TEXT,
  ROOFREPLY_DEMO_10DLC,
} from "./ten-dlc-demo-campaign.ts";
import { ACCOUNT_SMS_CONSENT_TEXT } from "./account-sms-consent.ts";

test("10DLC demo campaign uses the live demo opt-in consent text", () => {
  assert.match(ROOFREPLY_DEMO_10DLC.messageFlow, /mobile phone field is optional/);
  assert.match(ROOFREPLY_DEMO_10DLC.messageFlow, /select the SMS consent checkbox/);
  assert.match(ROOFREPLY_DEMO_10DLC.messageFlow, /Start Demo SMS/);
  assert.match(ROOFREPLY_DEMO_10DLC.messageFlow, /configured lead-alert phone/);
  assert.match(ROOFREPLY_DEMO_10DLC.messageFlow, new RegExp(escapeRegExp(DEMO_SMS_CONSENT_TEXT)));
  assert.match(ROOFREPLY_DEMO_10DLC.messageFlow, new RegExp(escapeRegExp(ACCOUNT_SMS_CONSENT_TEXT)));
  assert.equal(ROOFREPLY_DEMO_10DLC.urls.optIn, "https://www.roofreply.com/demo-sms");
  assert.equal(ROOFREPLY_DEMO_10DLC.urls.privacy, "https://www.roofreply.com/privacy");
  assert.equal(ROOFREPLY_DEMO_10DLC.urls.terms, "https://www.roofreply.com/terms");
});

test("10DLC demo campaign samples match embedded-link campaign attributes", () => {
  assert.equal(ROOFREPLY_DEMO_10DLC.attributes.embeddedLinks, true);
  assert.equal(ROOFREPLY_DEMO_10DLC.attributes.embeddedPhoneNumbers, false);
  assert.equal(
    ROOFREPLY_DEMO_10DLC.urls.calendlyBookingProof,
    "https://calendly.com/example/roofing-demo",
  );
  assert.ok(
    ROOFREPLY_DEMO_10DLC.sampleMessages.some((message) =>
      message.includes(ROOFREPLY_DEMO_10DLC.urls.calendlyBookingProof),
    ),
  );

  for (const message of ROOFREPLY_DEMO_10DLC.sampleMessages) {
    assert.match(message, /^RoofReply/);
    assert.match(message, /Reply STOP to opt out\./);
    assert.doesNotMatch(message, /\b\d{10}\b/);
  }
});

test("10DLC demo campaign remains non-marketing customer care", () => {
  assert.equal(ROOFREPLY_DEMO_10DLC.campaign.useCase, "Low Volume Mixed");
  assert.equal(ROOFREPLY_DEMO_10DLC.campaign.subUseCase, "Customer Care");
  assert.equal(ROOFREPLY_DEMO_10DLC.attributes.affiliateMarketing, false);
  assert.equal(ROOFREPLY_DEMO_10DLC.attributes.ageGatedContent, false);
  assert.equal(ROOFREPLY_DEMO_10DLC.attributes.directLending, false);
  assert.match(ROOFREPLY_DEMO_10DLC.description, /do not include marketing or promotional content/);
  assert.match(ROOFREPLY_DEMO_10DLC.messageFlow, /After opt-in/);
});

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
