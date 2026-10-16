import test from "node:test";
import assert from "node:assert/strict";
import { buildTestSmsMessage } from "./test-sms.ts";
import {
  HELP_RESPONSE,
  OPT_IN_CONFIRMATION,
  OPT_OUT_CONFIRMATION,
  getSmsKeywordResponsesForNumber,
  isHelpMessage,
  isOptInMessage,
  isOptOutMessage,
} from "./telnyx.ts";
import { ROOFREPLY_DEMO_10DLC } from "./ten-dlc-demo-campaign.ts";

test("buildTestSmsMessage includes setup context and opt-out language", () => {
  const message = buildTestSmsMessage("+16025550147");

  assert.match(message, /RoofReply test message/);
  assert.match(message, /\+16025550147/);
  assert.match(message, /Reply STOP to opt out\./);
});

test("SMS keyword helpers detect opt-out, opt-in, and help requests", () => {
  for (const keyword of ["STOP", "unsubscribe", "Cancel", "end", "QUIT"]) {
    assert.equal(isOptOutMessage(keyword), true);
  }

  for (const keyword of ["START", "unstop", "Subscribe"]) {
    assert.equal(isOptInMessage(keyword), true);
  }

  assert.equal(isHelpMessage("HELP"), true);
  assert.equal(isHelpMessage(" help "), true);
  assert.equal(isHelpMessage("I need help"), false);
});

test("SMS confirmation and help copy include required compliance language", () => {
  assert.match(OPT_OUT_CONFIRMATION, /RoofReply/);
  assert.match(OPT_OUT_CONFIRMATION, /Reply START to resubscribe/);
  assert.match(OPT_IN_CONFIRMATION, /RoofReply/);
  assert.match(OPT_IN_CONFIRMATION, /Message frequency varies/);
  assert.match(OPT_IN_CONFIRMATION, /Message and data rates may apply/);
  assert.match(OPT_IN_CONFIRMATION, /Reply HELP for help/);
  assert.match(OPT_IN_CONFIRMATION, /Reply STOP to opt out/);

  assert.match(HELP_RESPONSE, /RoofReply/);
  assert.match(HELP_RESPONSE, /hello@example\.com/);
  assert.match(HELP_RESPONSE, /Message frequency varies/);
  assert.match(HELP_RESPONSE, /Message and data rates may apply/);
  assert.match(HELP_RESPONSE, /Reply STOP to opt out/);
});

test("demo SMS number uses demo campaign keyword responses", () => {
  const previousDemoNumber = process.env.DEMO_SMS_TELNYX_PHONE_NUMBER;
  process.env.DEMO_SMS_TELNYX_PHONE_NUMBER = "+16025550123";

  try {
    const responses = getSmsKeywordResponsesForNumber("(602) 555-0123");

    assert.equal(responses.optOut, ROOFREPLY_DEMO_10DLC.responses.optOut);
    assert.equal(responses.optIn, ROOFREPLY_DEMO_10DLC.responses.optIn);
    assert.equal(responses.help, ROOFREPLY_DEMO_10DLC.responses.help);
  } finally {
    if (previousDemoNumber === undefined) {
      delete process.env.DEMO_SMS_TELNYX_PHONE_NUMBER;
    } else {
      process.env.DEMO_SMS_TELNYX_PHONE_NUMBER = previousDemoNumber;
    }
  }
});

test("non-demo SMS numbers keep service-message keyword responses", () => {
  const previousDemoNumber = process.env.DEMO_SMS_TELNYX_PHONE_NUMBER;
  process.env.DEMO_SMS_TELNYX_PHONE_NUMBER = "+16025550123";

  try {
    const responses = getSmsKeywordResponsesForNumber("+16025550124");

    assert.equal(responses.optOut, OPT_OUT_CONFIRMATION);
    assert.equal(responses.optIn, OPT_IN_CONFIRMATION);
    assert.equal(responses.help, HELP_RESPONSE);
  } finally {
    if (previousDemoNumber === undefined) {
      delete process.env.DEMO_SMS_TELNYX_PHONE_NUMBER;
    } else {
      process.env.DEMO_SMS_TELNYX_PHONE_NUMBER = previousDemoNumber;
    }
  }
});
