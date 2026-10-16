import test from "node:test";
import assert from "node:assert/strict";
import { v } from "convex/values";
import { convexTest } from "convex-test";
import { internalAction } from "../convex/_generated/server";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import {
  ACCOUNT_SMS_CONSENT_TEXT,
  ACCOUNT_SMS_CONSENT_VERSION,
} from "../lib/account-sms-consent";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  DEMO_SMS_CONSENT_TEXT,
  DEMO_SMS_CONSENT_VERSION,
} from "../lib/ten-dlc-demo-campaign";
const modules = Object.fromEntries(
  readdirSync(new URL("../convex/", import.meta.url))
    .filter((f) => f.endsWith(".ts"))
    .map((f) => [
      `../convex/${f}`,
      () => import(fileURLToPath(new URL(`../convex/${f}`, import.meta.url))),
    ]),
);
modules["../convex/_generated/server.ts"] = () =>
  import("../convex/_generated/server");
// Tests drive the queue explicitly so a scheduled worker never calls a provider.
modules["../convex/automationActions.ts"] = async () => ({
  process: internalAction({
    args: { conversationKey: v.string() },
    handler: async () => {},
  }),
});
const sender = "+12025550102",
  recipient = "+12025550199";
function setup() {
  process.env.OPS_ADMIN_CLERK_IDS = "operator";
  return convexTest(schema, modules);
}
async function seed(
  t: ReturnType<typeof setup>,
  clerkId = "owner",
  phone = sender,
) {
  return t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      clerkId,
      email: `${clerkId}@example.test`,
      onboardingCompleted: true,
      onboardingStep: 5,
      createdAt: 1,
      updatedAt: 1,
    });
    return ctx.db.insert("onboarding", {
      userId,
      clerkId,
      telnyxPhoneNumber: phone,
      telnyxPhoneNumberId: "number-id",
      messagingProfileId: "profile-id",
      voiceApplicationId: "voice-id",
      provisioningStatus: "ready",
      campaignId: "campaign-id",
      providerEvidence: "Portal approval verified",
      forwardingEvidence: "Conditional forwarding verified",
      rehearsalEvidence: "Three calls verified",
      verificationStatus: "approved",
      campaignStatus: "approved",
      activationMode: "rehearsal",
      keywordHandling: "telnyx",
      bookingDeliveryPhone: recipient,
      accountSmsConsentGranted: true,
      accountSmsConsentPhone: recipient,
      accountSmsConsentText: ACCOUNT_SMS_CONSENT_TEXT,
      accountSmsConsentVersion: ACCOUNT_SMS_CONSENT_VERSION,
      bookingLink: "https://calendly.com/example/roof",
      isDemoAccount: true,
      createdAt: 1,
      updatedAt: 1,
    });
  });
}
function sms(
  id: string,
  text = "Roof leak",
  from = recipient,
  to = sender,
  type = "message.received",
  status?: string,
) {
  return JSON.stringify({
    data: {
      id,
      event_type: type,
      occurred_at: new Date().toISOString(),
      payload: {
        id: `provider-${id}`,
        direction: type === "message.received" ? "inbound" : "outbound",
        from: { phone_number: from },
        to: [{ phone_number: to, status }],
        text,
        type: "SMS",
      },
    },
  });
}

test("demo callers require recorded consent and it is rechecked before sending", async () => {
  const t = setup();
  const a = await seed(t);
  await t.run((ctx) => ctx.db.patch(a, { activationMode: "live" }));
  const caller = "+12025550188";
  const call = (id: string) =>
    JSON.stringify({
      data: {
        id,
        event_type: "call.initiated",
        occurred_at: new Date().toISOString(),
        payload: {
          call_control_id: id,
          call_session_id: id,
          from: caller,
          to: sender,
          direction: "incoming",
        },
      },
    });
  const prepareCall = async (id: string) => {
    await t.mutation(internal.automation.ingest, { body: call(id) });
    const event = await t.mutation(internal.automation.claim, {
      conversationKey: `${sender}:${caller}`,
    });
    assert.ok(event);
    return t.mutation(internal.automation.prepare, {
      eventId: event._id,
      attempt: event.attempts,
    });
  };
  assert.equal(await prepareCall("no-consent"), null);
  const consent = await t.mutation(internal.demoSmsConsent.capture, {
    record: {
      id: "test-consent",
      type: "roofreply_demo_sms_opt_in",
      phoneNumber: caller,
      rawPhone: caller,
      name: null,
      company: null,
      timestamp: new Date().toISOString(),
      sourceUrl: null,
      ipAddress: null,
      userAgent: null,
      consentText: DEMO_SMS_CONSENT_TEXT,
      consentVersion: DEMO_SMS_CONSENT_VERSION,
    },
  });
  assert.ok(consent.id);
  assert.equal((await prepareCall("with-consent"))?.readyToSend, true);
  const outbound = (
    await t.run((ctx) => ctx.db.query("outboundMessages").collect())
  )[0];
  assert.match(outbound.text, /^RoofReply demo:/);
  assert.equal(outbound.text.includes(sender), false);
  assert.match(outbound.text, /^RoofReply demo:/);
  await t.run((ctx) => ctx.db.delete(consent.id!));
  assert.equal(
    await t.mutation(internal.automation.beginSend, {
      id: outbound._id,
      attempt: 1,
    }),
    null,
  );
  assert.equal(
    (await t.run((ctx) => ctx.db.get(outbound._id)))?.state,
    "suppressed",
  );
});

test("anonymous and cross-account reads and writes are rejected", async () => {
  const t = setup();
  await seed(t);
  await assert.rejects(
    t.query(api.onboarding.getOnboarding, { clerkId: "owner" }),
    /Unauthorized/,
  );
  await assert.rejects(
    t
      .withIdentity({ subject: "other" })
      .query(api.onboarding.getOnboarding, { clerkId: "owner" }),
    /Forbidden/,
  );
  await assert.rejects(
    t
      .withIdentity({ subject: "owner" })
      .mutation(api.pilot.activate, { clerkId: "owner", mode: "live" }),
    /Forbidden/,
  );
  const leadsModule = await import("../convex/leads");
  assert.equal(leadsModule.createLead.isInternal, true);
  assert.equal(leadsModule.getLeadWithMessages.isInternal, true);
  const usage = await import("../convex/usageControl");
  assert.equal(usage.incrementUsage.isInternal, true);
});
test("saving owner consent retains verified approval and permits operator rehearsal", async () => {
  const t = setup();
  const id = await seed(t);
  await t.run((ctx) =>
    ctx.db.patch(id, { accountSmsConsentVersion: "old-disclosure" }),
  );
  const owner = t.withIdentity({ subject: "owner" });
  await owner.mutation(api.onboarding.updateSettings, {
    clerkId: "owner",
    bookingDeliveryPhone: recipient,
    accountSmsConsentGranted: true,
    accountSmsConsentText: ACCOUNT_SMS_CONSENT_TEXT,
    accountSmsConsentVersion: ACCOUNT_SMS_CONSENT_VERSION,
    leadHandoffMode: "review_and_booking",
  });
  const a = await t.run((ctx) => ctx.db.get(id));
  assert.equal(a?.providerEvidence, "Portal approval verified");
  assert.equal(a?.activationMode, "paused");
  assert.equal(a?.forwardingEvidence, undefined);
  assert.equal(a?.rehearsalEvidence, undefined);
  await t.withIdentity({ subject: "operator" }).mutation(api.pilot.activate, {
    clerkId: "owner",
    mode: "rehearsal",
  });
  assert.equal(
    (await t.run((ctx) => ctx.db.get(id)))?.activationMode,
    "rehearsal",
  );
  assert.equal(
    (await t.run((ctx) => ctx.db.query("outboundMessages").collect())).length,
    0,
  );
});

test("business identity changes invalidate approval through either settings entrypoint", async () => {
  for (const onboardingStep of [false, true]) {
    const t = setup();
    const id = await seed(t);
    const owner = t.withIdentity({ subject: "owner" });
    if (onboardingStep) {
      await owner.mutation(api.onboarding.saveOnboardingStep, {
        clerkId: "owner",
        step: 5,
        data: { legalBusinessName: "Different business" },
      });
    } else {
      await owner.mutation(api.onboarding.updateSettings, {
        clerkId: "owner",
        legalBusinessName: "Different business",
      });
    }
    assert.equal(
      (await t.run((ctx) => ctx.db.get(id)))?.providerEvidence,
      undefined,
    );
    await assert.rejects(
      t.withIdentity({ subject: "operator" }).mutation(api.pilot.activate, {
        clerkId: "owner",
        mode: "rehearsal",
      }),
      /Provider approval evidence is missing/,
    );
  }
});

test("customer cannot forge approval or assign a number through onboarding data", async () => {
  const t = setup();
  await seed(t);
  const owner = t.withIdentity({ subject: "owner" });
  await assert.rejects(
    owner.mutation(api.onboarding.saveOnboardingStep, {
      clerkId: "owner",
      step: 3,
      data: {
        campaignStatus: "approved",
        telnyxPhoneNumber: "+12025550188",
      } as never,
    }),
  );
  await assert.rejects(
    owner.mutation(api.onboarding.updateSettings, {
      clerkId: "owner",
      collectPhotosFirst: true,
    } as never),
  );
  await owner.mutation(api.onboarding.updateSettings, {
    clerkId: "owner",
    legalBusinessName: "Updated Roofer",
  });
  assert.equal(
    (await owner.query(api.onboarding.getOnboarding, { clerkId: "owner" }))
      ?.activationMode,
    "paused",
  );
});
test("number reservation rejects duplicates and failed verification never becomes ready", async () => {
  const t = setup();
  await seed(t);
  await seed(t, "second", "+12025550189");
  await assert.rejects(
    t.mutation(internal.pilot.reserveAssignment, {
      clerkId: "second",
      phoneNumber: sender,
      phoneNumberId: "id",
      profileId: "profile",
      voiceId: "voice",
      token: "one",
    }),
    /already assigned/,
  );
  await t.mutation(internal.pilot.reserveAssignment, {
    clerkId: "owner",
    phoneNumber: sender,
    phoneNumberId: "id",
    profileId: "profile",
    voiceId: "voice",
    token: "one",
  });
  await assert.rejects(
    t.mutation(internal.pilot.reserveAssignment, {
      clerkId: "owner",
      phoneNumber: sender,
      phoneNumberId: "id",
      profileId: "profile",
      voiceId: "voice",
      token: "two",
    }),
    /in progress/,
  );
  await t.mutation(internal.pilot.finishAssignment, {
    clerkId: "owner",
    token: "one",
    success: false,
  });
  const a = await t
    .withIdentity({ subject: "owner" })
    .query(api.onboarding.getOnboarding, { clerkId: "owner" });
  assert.equal(a?.provisioningStatus, "failed");
  assert.equal(a?.activationMode, "paused");
});
test("event retries persist once and serialize conversations", async () => {
  const t = setup();
  await seed(t);
  const body = sms("one");
  assert.equal(
    (await t.mutation(internal.automation.ingest, { body })).status,
    "queued",
  );
  assert.equal(
    (await t.mutation(internal.automation.ingest, { body })).status,
    "duplicate",
  );
  await t.mutation(internal.automation.ingest, { body: sms("two") });
  const key = `${sender}:${recipient}`;
  const first = await t.mutation(internal.automation.claim, {
    conversationKey: key,
  });
  assert.equal(first?.eventId, "one");
  assert.equal(
    await t.mutation(internal.automation.claim, { conversationKey: key }),
    null,
  );
  assert.equal(
    (await t.run((ctx) => ctx.db.query("automationEvents").collect())).length,
    2,
  );
});
test("STOP blocks a queued reply before sending and START only restores its sender", async () => {
  const t = setup();
  await seed(t);
  await seed(t, "second", "+12025550189");
  await t.run((ctx) =>
    ctx.db.insert("optOuts", { phoneNumber: recipient, optedOutAt: 1 }),
  );
  await t.mutation(internal.automation.ingest, { body: sms("start", "START") });
  await t
    .withIdentity({ subject: "owner" })
    .mutation(api.automation.requestTest, { kind: "test" });
  await t.mutation(internal.automation.claim, {
    conversationKey: `${sender}:${recipient}`,
  });
  const outbound = (
    await t.run((ctx) => ctx.db.query("outboundMessages").collect())
  )[0];
  assert.ok(outbound);
  await t.mutation(internal.automation.ingest, { body: sms("stop", "STOP") });
  assert.equal(
    await t.mutation(internal.automation.beginSend, {
      id: outbound._id,
      attempt: 1,
    }),
    null,
  );
  assert.equal(
    (await t.run((ctx) => ctx.db.get(outbound._id)))?.state,
    "suppressed",
  );
  await t.mutation(internal.automation.ingest, {
    body: sms("start2", "START"),
  });
  await t
    .withIdentity({ subject: "second" })
    .mutation(api.automation.requestTest, { kind: "test" });
  await t.mutation(internal.automation.claim, {
    conversationKey: `+12025550189:${recipient}`,
  });
  const other = (
    await t.run((ctx) => ctx.db.query("outboundMessages").collect())
  ).find((m) => m.clerkId === "second")!;
  assert.equal(
    await t.mutation(internal.automation.beginSend, {
      id: other._id,
      attempt: 1,
    }),
    null,
  );
  assert.equal(
    (await t.run((ctx) => ctx.db.query("optOuts").collect())).length,
    1,
  );
});
test("outbound reservation counts once and never automatically resends uncertainty", async () => {
  const t = setup();
  await seed(t);
  await t
    .withIdentity({ subject: "owner" })
    .mutation(api.automation.requestTest, { kind: "test" });
  await t.mutation(internal.automation.claim, {
    conversationKey: `${sender}:${recipient}`,
  });
  const outbound = (
    await t.run((ctx) => ctx.db.query("outboundMessages").collect())
  )[0];
  assert.ok(
    await t.mutation(internal.automation.beginSend, {
      id: outbound._id,
      attempt: 1,
    }),
  );
  assert.equal(
    await t.mutation(internal.automation.beginSend, {
      id: outbound._id,
      attempt: 1,
    }),
    null,
  );
  await t.mutation(internal.automation.finishSend, {
    id: outbound._id,
    state: "uncertain",
  });
  assert.equal(
    await t.mutation(internal.automation.beginSend, {
      id: outbound._id,
      attempt: 1,
    }),
    null,
  );
  const usage = await t.run((ctx) => ctx.db.query("usageTracking").collect());
  assert.equal(usage[0].smsOutbound, 1);
});
test("late acceptance cannot overwrite delivered receipt", async () => {
  const t = setup();
  await seed(t);
  await t
    .withIdentity({ subject: "owner" })
    .mutation(api.automation.requestTest, { kind: "test" });
  await t.mutation(internal.automation.claim, {
    conversationKey: `${sender}:${recipient}`,
  });
  const outbound = (
    await t.run((ctx) => ctx.db.query("outboundMessages").collect())
  )[0];
  await t.mutation(internal.automation.beginSend, {
    id: outbound._id,
    attempt: 1,
  });
  await t.mutation(internal.automation.ingest, {
    body: sms(
      "receipt",
      "",
      sender,
      recipient,
      "message.finalized",
      "delivered",
    ),
  });
  await t.mutation(internal.automation.finishSend, {
    id: outbound._id,
    state: "accepted",
    providerId: "provider-receipt",
  });
  assert.equal(
    (await t.run((ctx) => ctx.db.get(outbound._id)))?.state,
    "delivered",
  );
});
test("sample refresh retains real leads and produces no outbound messages or usage", async () => {
  const t = setup();
  await seed(t);
  const real = await t.mutation(internal.leads.createLead, {
    clerkId: "owner",
    phoneNumber: recipient,
    channel: "sms",
    initialMessage: "Real inquiry",
  });
  const operator = t.withIdentity({ subject: "operator" });
  await operator.mutation(api.pilot.seedDemo, { clerkId: "owner" });
  await operator.mutation(api.pilot.seedDemo, { clerkId: "owner" });
  const all = await t.run((ctx) => ctx.db.query("leads").collect());
  assert.equal(all.length, 5);
  assert.ok(all.some((l) => l._id === real));
  assert.equal(all.filter((l) => l.sampleKey).length, 4);
  assert.equal(
    (await t.run((ctx) => ctx.db.query("outboundMessages").collect())).length,
    0,
  );
  assert.equal(
    (await t.run((ctx) => ctx.db.query("usageTracking").collect())).length,
    0,
  );
  assert.equal(
    (
      await t
        .withIdentity({ subject: "owner" })
        .query(api.leads.getLeadStats, { clerkId: "owner" })
    ).totalLeads,
    1,
  );
  await assert.rejects(
    t
      .withIdentity({ subject: "owner" })
      .mutation(api.leads.resetLeadConversationForViewer, {
        clerkId: "owner",
        leadId: real,
      }),
    /Only sample/,
  );
});
test("live activation requires actual delivery evidence even with approved flags", async () => {
  const t = setup();
  await seed(t);
  await assert.rejects(
    t
      .withIdentity({ subject: "operator" })
      .mutation(api.pilot.activate, { clerkId: "owner", mode: "live" }),
    /delivered/,
  );
  const response = await t.fetch("/ingest/telnyx", {
    method: "POST",
    body: sms("forged"),
  });
  assert.equal(response.status, 401);
});

async function worker(t: ReturnType<typeof setup>) {
  const { processConversation } = await import("../convex/automationActions");
  await t.action((ctx) =>
    processConversation(ctx, { conversationKey: `${sender}:${recipient}` }),
  );
}
const qualified = {
  requiresHumanReview: false,
  message: "The team will review your roof inquiry.",
  name: "Taylor",
  jobType: "Roof inspection",
  location: "Phoenix",
  urgency: "low",
  summary: "Inspection requested",
  isQualified: true,
  conversationComplete: true,
  recommendedHandoff: "review_and_booking",
  shouldSendBookingLink: true,
  shouldNotifyContractor: true,
  handoffReason: "Qualified",
};

test("specialist routes callback, existing-job and urgent inquiries to the owner without a booking", async (context) => {
  const oldAi = process.env.OPENAI_API_KEY,
    oldTelnyx = process.env.TELNYX_API_KEY;
  process.env.OPENAI_API_KEY = "test";
  process.env.TELNYX_API_KEY = "test";
  context.after(() => {
    if (oldAi === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = oldAi;
    if (oldTelnyx === undefined) delete process.env.TELNYX_API_KEY;
    else process.env.TELNYX_API_KEY = oldTelnyx;
  });
  for (const scenario of [
    { text: "Please have someone call me.", urgency: null, human: true, summary: "Requests a callback from a person." },
    { text: "Your crew repaired this last month and it leaks again.", urgency: "medium", human: true, summary: "Existing repair concern; asks the team to follow up." },
    { text: "The ceiling is falling and water is pouring in.", urgency: "high", human: false, summary: "Reports ceiling falling and heavy water intrusion." },
  ]) {
    await context.test(scenario.text, async (subtest) => {
      const t = setup();
      const account = await seed(t);
      await t.run((ctx) => ctx.db.patch(account, { leadHandoffMode: "booking_link" }));
      subtest.mock.method(globalThis, "fetch", async (url: string | URL | Request) =>
        String(url).includes("openai.com")
          ? Response.json({ choices: [{ message: { content: JSON.stringify({
              ...qualified,
              name: null,
              location: null,
              urgency: scenario.urgency,
              requiresHumanReview: scenario.human,
              conversationComplete: false,
              summary: scenario.summary,
            }) } }] })
          : Response.json({ data: { id: crypto.randomUUID() } }),
      );
      const body = sms(`specialist-${scenario.urgency}`, scenario.text);
      await t.mutation(internal.automation.ingest, { body });
      await worker(t);
      // Duplicate delivery must not duplicate the human handoff.
      await t.mutation(internal.automation.ingest, { body });
      await worker(t);
      const out = await t.run((ctx) => ctx.db.query("outboundMessages").collect());
      assert.deepEqual(out.map((m) => m.purpose).sort(), ["owner", "reply"]);
      assert.ok(out.every((m) => m.state === "accepted"));
      assert.match(out.find((m) => m.purpose === "reply")!.text, /STOP/);
      assert.doesNotMatch(out.find((m) => m.purpose === "reply")!.text, /\?|scheduling link/);
      assert.ok(out.find((m) => m.purpose === "owner")!.text.includes(scenario.summary));
      const lead = (await t.run((ctx) => ctx.db.query("leads").collect()))[0];
      assert.equal(lead.userNotified, true);
      assert.notEqual(lead.status, "booking_link_sent");
    });
  }
});

test("full worker produces one reply, booking link, and owner alert despite duplicate event", async (context) => {
  const t = setup();
  const a = await seed(t);
  await t.run((ctx) =>
    ctx.db.patch(a, { leadHandoffMode: "review_and_booking" }),
  );
  context.mock.method(
    globalThis,
    "fetch",
    async (url: string | URL | Request) =>
      String(url).includes("openai.com")
        ? Response.json({
            choices: [{ message: { content: JSON.stringify(qualified) } }],
          })
        : Response.json({ data: { id: crypto.randomUUID() } }),
  );
  const oldAi = process.env.OPENAI_API_KEY,
    oldTelnyx = process.env.TELNYX_API_KEY;
  process.env.OPENAI_API_KEY = "test";
  process.env.TELNYX_API_KEY = "test";
  try {
    const body = sms("qualified");
    await t.mutation(internal.automation.ingest, { body });
    await worker(t);
    await t.mutation(internal.automation.ingest, { body });
    await worker(t);
    const all = await t.run((ctx) =>
      ctx.db.query("outboundMessages").collect(),
    );
    assert.deepEqual(all.map((m) => m.purpose).sort(), [
      "booking",
      "owner",
      "reply",
    ]);
    assert.ok(all.every((m) => m.state === "accepted"));
    assert.ok(all.every((m) => !m.text.includes(recipient)));
    const lead = (await t.run((ctx) => ctx.db.query("leads").collect()))[0];
    assert.equal(lead.status, "booking_link_sent");
    assert.equal(lead.userNotified, true);
    const usage = (
      await t.run((ctx) => ctx.db.query("usageTracking").collect())
    )[0];
    assert.equal(usage.smsOutbound, 3);
    assert.equal(usage.smsInbound, 1);
    assert.equal(usage.ownerNotifications, 1);
    assert.equal(usage.missedCallsSms, 0);
    assert.equal(usage.aiCalls, 1);
    assert.equal(usage.leadsCreated, 1);
  } finally {
    if (oldAi === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = oldAi;
    if (oldTelnyx === undefined) delete process.env.TELNYX_API_KEY;
    else process.env.TELNYX_API_KEY = oldTelnyx;
  }
});
test("AI outage preserves inbound inquiry and alerts owner without repeated opening question", async (context) => {
  const t = setup();
  await seed(t);
  context.mock.method(
    globalThis,
    "fetch",
    async (url: string | URL | Request) => {
      if (String(url).includes("openai.com")) throw new Error("timeout");
      return Response.json({ data: { id: "owner-alert" } });
    },
  );
  const oldAi = process.env.OPENAI_API_KEY,
    oldTelnyx = process.env.TELNYX_API_KEY;
  process.env.OPENAI_API_KEY = "test";
  process.env.TELNYX_API_KEY = "test";
  try {
    await t.mutation(internal.automation.ingest, { body: sms("outage") });
    await worker(t);
    const lead = (await t.run((ctx) => ctx.db.query("leads").collect()))[0];
    assert.equal(lead.status, "needs_followup");
    const out = await t.run((ctx) =>
      ctx.db.query("outboundMessages").collect(),
    );
    assert.equal(out.length, 1);
    assert.equal(out[0].purpose, "owner");
    assert.equal(
      (await t.run((ctx) => ctx.db.query("messages").collect()))[0].content,
      "Roof leak",
    );
  } finally {
    if (oldAi === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = oldAi;
    if (oldTelnyx === undefined) delete process.env.TELNYX_API_KEY;
    else process.env.TELNYX_API_KEY = oldTelnyx;
  }
});
test("expired worker cannot reserve a send after another worker has claimed recovery", async () => {
  const t = setup();
  await seed(t);
  await t
    .withIdentity({ subject: "owner" })
    .mutation(api.automation.requestTest, { kind: "test" });
  const key = `${sender}:${recipient}`;
  const first = (await t.mutation(internal.automation.claim, {
    conversationKey: key,
  }))!;
  await t.run((ctx) =>
    ctx.db.patch(first._id, { startedAt: Date.now() - 180000 }),
  );
  await t.mutation(internal.automation.recover, {});
  const second = (await t.mutation(internal.automation.claim, {
    conversationKey: key,
  }))!;
  assert.equal(second.attempts, 2);
  const outbound = (
    await t.run((ctx) => ctx.db.query("outboundMessages").collect())
  )[0];
  assert.equal(
    await t.mutation(internal.automation.beginSend, {
      id: outbound._id,
      attempt: first.attempts,
    }),
    null,
  );
  assert.ok(
    await t.mutation(internal.automation.beginSend, {
      id: outbound._id,
      attempt: second.attempts,
    }),
  );
});
test("failed delivery received before submission result leaves the lead needing follow-up", async () => {
  const t = setup();
  await seed(t);
  const leadId = await t.mutation(internal.leads.createLead, {
    clerkId: "owner",
    phoneNumber: recipient,
    channel: "sms",
    initialMessage: "Real inquiry",
  });
  await t
    .withIdentity({ subject: "owner" })
    .mutation(api.automation.requestTest, { kind: "test" });
  await t.mutation(internal.automation.claim, {
    conversationKey: `${sender}:${recipient}`,
  });
  const out = (
    await t.run((ctx) => ctx.db.query("outboundMessages").collect())
  )[0];
  await t.run((ctx) => ctx.db.patch(out._id, { leadId, purpose: "booking" }));
  await t.mutation(internal.automation.beginSend, { id: out._id, attempt: 1 });
  await t.mutation(internal.automation.ingest, {
    body: sms(
      "failed-receipt",
      "",
      sender,
      recipient,
      "message.finalized",
      "delivery_failed",
    ),
  });
  await t.mutation(internal.automation.finishSend, {
    id: out._id,
    state: "accepted",
    providerId: "provider-failed-receipt",
  });
  assert.equal(
    (await t.run((ctx) => ctx.db.get(leadId)))?.status,
    "needs_followup",
  );
});

test("cross-account conversation access and lead mutation are forbidden", async () => {
  const t = setup();
  await seed(t);
  await seed(t, "second", "+12025550189");
  const leadId = await t.mutation(internal.leads.createLead, {
    clerkId: "owner",
    phoneNumber: recipient,
    channel: "sms",
    initialMessage: "Private inquiry",
  });
  assert.equal(
    await t
      .withIdentity({ subject: "second" })
      .query(api.leads.getLeadWithMessagesForViewer, { leadId }),
    null,
  );
  await assert.rejects(
    t
      .withIdentity({ subject: "second" })
      .mutation(api.leads.updateLeadStatusForViewer, {
        clerkId: "second",
        leadId,
        status: "qualified",
      }),
    /Forbidden/,
  );
  await assert.rejects(
    t
      .withIdentity({ subject: "second" })
      .mutation(api.usageControl.updateQuotas, {
        clerkId: "owner",
        dailySmsLimit: 9999,
      }),
    /Forbidden/,
  );
});
test("provider lookup failure leaves assignment incomplete", async (context) => {
  const t = setup();
  await seed(t);
  const oldKey = process.env.TELNYX_API_KEY,
    oldUrl = process.env.PUBLIC_APP_URL;
  process.env.TELNYX_API_KEY = "test";
  process.env.PUBLIC_APP_URL = "https://example.invalid";
  context.mock.method(
    globalThis,
    "fetch",
    async () => new Response("Unavailable", { status: 503 }),
  );
  try {
    await assert.rejects(
      t
        .withIdentity({ subject: "operator" })
        .action(api.providerActions.verifyAssignment, {
          clerkId: "owner",
          phoneNumber: sender,
          phoneNumberId: "number-id",
          profileId: "profile-id",
          voiceId: "voice-id",
        }),
      /verification failed/,
    );
    const a = await t
      .withIdentity({ subject: "owner" })
      .query(api.onboarding.getOnboarding, { clerkId: "owner" });
    assert.equal(a?.provisioningStatus, "failed");
    assert.equal(a?.activationMode, "paused");
  } finally {
    if (oldKey === undefined) delete process.env.TELNYX_API_KEY;
    else process.env.TELNYX_API_KEY = oldKey;
    if (oldUrl === undefined) delete process.env.PUBLIC_APP_URL;
    else process.env.PUBLIC_APP_URL = oldUrl;
  }
});
test("older delivery receipts cannot overwrite a terminal result", async () => {
  const t = setup();
  await seed(t);
  await t
    .withIdentity({ subject: "owner" })
    .mutation(api.automation.requestTest, { kind: "test" });
  await t.mutation(internal.automation.claim, {
    conversationKey: `${sender}:${recipient}`,
  });
  const out = (
    await t.run((ctx) => ctx.db.query("outboundMessages").collect())
  )[0];
  await t.mutation(internal.automation.beginSend, { id: out._id, attempt: 1 });
  await t.mutation(internal.automation.finishSend, {
    id: out._id,
    state: "accepted",
    providerId: "provider-terminal",
  });
  const newer = JSON.parse(
    sms(
      "new-failure",
      "",
      sender,
      recipient,
      "message.finalized",
      "delivery_failed",
    ),
  );
  newer.data.payload.id = "provider-terminal";
  await t.mutation(internal.automation.ingest, { body: JSON.stringify(newer) });
  const older = JSON.parse(
    sms(
      "old-delivery",
      "",
      sender,
      recipient,
      "message.finalized",
      "delivered",
    ),
  );
  older.data.payload.id = "provider-terminal";
  older.data.occurred_at = new Date(Date.now() - 60000).toISOString();
  await t.mutation(internal.automation.ingest, { body: JSON.stringify(older) });
  assert.equal((await t.run((ctx) => ctx.db.get(out._id)))?.state, "failed");
});

async function startDemo(t: ReturnType<typeof setup>, overrides = {}) {
  return t
    .withIdentity({ subject: "operator" })
    .mutation(api.demoSessions.start, {
      clerkId: "owner",
      businessName: "Acme Roofing",
      recipient,
      ...overrides,
    });
}
async function prepareNext(t: ReturnType<typeof setup>, phone = recipient) {
  const event = await t.mutation(internal.automation.claim, {
    conversationKey: `${sender}:${phone}`,
  });
  assert.ok(event);
  const prepared = await t.mutation(internal.automation.prepare, {
    eventId: event._id,
    attempt: event.attempts,
  });
  return { event, prepared };
}
async function finishOpening(t: ReturnType<typeof setup>) {
  const { event } = await prepareNext(t);
  const out = (
    await t.query(internal.automation.outbox, { eventId: event._id })
  )[0];
  assert.ok(
    await t.mutation(internal.automation.beginSend, {
      id: out._id,
      attempt: event.attempts,
    }),
  );
  await t.mutation(internal.automation.finishSend, {
    id: out._id,
    state: "accepted",
    providerId: `opening-${out._id}`,
  });
  await t.mutation(internal.automation.finish, {
    eventId: event._id,
    attempt: event.attempts,
  });
  const receipt = JSON.parse(
    sms(
      `receipt-${out._id}`,
      "",
      sender,
      recipient,
      "message.finalized",
      "delivered",
    ),
  );
  receipt.data.payload.id = `opening-${out._id}`;
  await t.mutation(internal.automation.ingest, {
    body: JSON.stringify(receipt),
  });
  return out;
}

test("demo start requires operator access, preserves account approval, and has one active test per pair", async () => {
  const t = setup();
  const a = await seed(t);
  const args = { clerkId: "owner", businessName: "Acme Roofing", recipient };
  await assert.rejects(t.mutation(api.demoSessions.start, args));
  await assert.rejects(
    t.withIdentity({ subject: "owner" }).mutation(api.demoSessions.start, args),
  );
  const results = await Promise.allSettled([startDemo(t), startDemo(t)]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const account = await t.run((ctx) => ctx.db.get(a));
  assert.equal(account?.providerEvidence, "Portal approval verified");
  assert.equal(account?.legalBusinessName, undefined);
  const session = (
    await t.run((ctx) => ctx.db.query("demoSessions").collect())
  )[0];
  await assert.rejects(
    t
      .withIdentity({ subject: "intruder" })
      .mutation(api.demoSessions.reset, { sessionId: session._id }),
  );
  await assert.rejects(
    t
      .withIdentity({ subject: "intruder" })
      .query(api.demoSessions.inspect, { clerkId: "owner", recipient }),
  );
  const out = await finishOpening(t);
  assert.equal((out.text.match(/RoofReply/g) || []).length, 1);
  assert.match(out.text, /Acme Roofing/);
  assert.match(out.text, /missed your call/);
});

test("demo reset cancels unsent replies and creates fresh history without touching real leads or consent", async () => {
  const t = setup();
  await seed(t);
  const real = await t.mutation(internal.leads.createLead, {
    clerkId: "owner",
    phoneNumber: recipient,
    channel: "sms",
    initialMessage: "Existing customer inquiry",
  });
  const first = await startDemo(t);
  await finishOpening(t);
  await t.mutation(internal.automation.ingest, {
    body: sms("first-session", "My name is Alex"),
  });
  const { event, prepared } = await prepareNext(t);
  assert.ok(prepared?.lead);
  await t
    .withIdentity({ subject: "operator" })
    .mutation(api.demoSessions.reset, { sessionId: first.sessionId });
  await t.mutation(internal.automation.savePlan, {
    eventId: event._id,
    attempt: event.attempts,
    reply: "Stale reply",
    info: { name: "Alex" },
    complete: false,
    mode: "review_first",
    reason: "",
    failed: false,
  });
  await t.mutation(internal.automation.finish, {
    eventId: event._id,
    attempt: event.attempts,
  });
  assert.equal(
    (await t.query(internal.automation.outbox, { eventId: event._id })).length,
    0,
  );
  const second = await startDemo(t, { businessName: "Another Roofing" });
  await finishOpening(t);
  await t.mutation(internal.automation.ingest, {
    body: sms("second-session", "I need a roof quote"),
  });
  const next = await prepareNext(t);
  assert.equal(next.prepared?.lead?.demoSessionId, second.sessionId);
  assert.ok(
    next.prepared?.history.every(
      (m) =>
        !m.content.includes("Alex") && !m.content.includes("Existing customer"),
    ),
  );
  assert.ok(await t.run((ctx) => ctx.db.get(real)));
  assert.equal(
    (
      await t
        .withIdentity({ subject: "owner" })
        .query(api.leads.getLeadStats, { clerkId: "owner" })
    ).totalLeads,
    1,
  );
});

test("reset waits for accepted and uncertain submissions before allowing a new session", async () => {
  const t = setup();
  await seed(t);
  const first = await startDemo(t);
  const { event } = await prepareNext(t);
  const out = (
    await t.query(internal.automation.outbox, { eventId: event._id })
  )[0];
  await t.mutation(internal.automation.beginSend, { id: out._id, attempt: 1 });
  assert.equal(
    (
      await t
        .withIdentity({ subject: "operator" })
        .mutation(api.demoSessions.reset, { sessionId: first.sessionId })
    ).state,
    "resetting",
  );
  await t.mutation(internal.automation.finishSend, {
    id: out._id,
    state: "uncertain",
    error: "timeout",
  });
  await assert.rejects(startDemo(t), /finishing/);
  await t.mutation(internal.automation.reconcile, {
    id: out._id,
    providerId: "found-message",
    sender,
    recipient,
    status: "sent",
  });
  await assert.rejects(startDemo(t), /finishing/);
  await t.mutation(internal.automation.reconcile, {
    id: out._id,
    providerId: "found-message",
    sender,
    recipient,
    status: "delivered",
  });
  assert.equal(
    (await t.run((ctx) => ctx.db.get(first.sessionId)))?.state,
    "archived",
  );
  await t.mutation(internal.automation.finish, {
    eventId: event._id,
    attempt: 1,
  });
  assert.ok(await startDemo(t));
});

test("late inbound events remain attached to the old demo and STOP survives reset", async () => {
  const t = setup();
  await seed(t);
  const first = await startDemo(t);
  await finishOpening(t);
  const oldTime = (await t.run((ctx) => ctx.db.get(first.sessionId)))!
    .createdAt;
  await t
    .withIdentity({ subject: "operator" })
    .mutation(api.demoSessions.reset, { sessionId: first.sessionId });
  const second = await startDemo(t);
  await finishOpening(t);
  const late = JSON.parse(sms("late-old", "Old property address"));
  late.data.occurred_at = new Date(oldTime).toISOString();
  assert.equal(
    (
      await t.mutation(internal.automation.ingest, {
        body: JSON.stringify(late),
      })
    ).status,
    "ignored",
  );
  await t.mutation(internal.automation.ingest, {
    body: sms("stop-new", "STOP"),
  });
  await t
    .withIdentity({ subject: "operator" })
    .mutation(api.demoSessions.reset, { sessionId: second.sessionId });
  await assert.rejects(startDemo(t), /consent|opted out/);
  assert.equal(
    (await t.run((ctx) => ctx.db.query("smsPreferences").collect()))[0].blocked,
    true,
  );
});

test("demo sessions suppress owner alerts for qualification, emergencies and AI failures", async () => {
  for (const scenario of ["qualified", "urgent", "failure"]) {
    const t = setup();
    await seed(t);
    await startDemo(t);
    await finishOpening(t);
    await t.mutation(internal.automation.ingest, {
      body: sms(`handoff-${scenario}`, "Roofing details"),
    });
    const { event } = await prepareNext(t);
    await t.mutation(internal.automation.savePlan, {
      eventId: event._id,
      attempt: event.attempts,
      reply: scenario === "failure" ? undefined : "The team will follow up.",
      info:
        scenario === "urgent"
          ? { urgency: "high" }
          : {
              name: "Alex",
              location: "Phoenix",
              jobType: "Repair",
              urgency: "low",
            },
      complete: true,
      mode: "review_first",
      reason: scenario,
      failed: scenario === "failure",
      owner: "Contractor review alert",
    });
    const out = await t.query(internal.automation.outbox, {
      eventId: event._id,
    });
    assert.ok(out.every((m) => m.purpose !== "owner"));
    assert.ok(out.every((m) => !m.text.includes("RoofReply")));
    const lead = await t.run((ctx) => ctx.db.get(event.leadId!));
    assert.equal(
      lead?.status,
      scenario === "qualified" ? "needs_contractor_review" : "needs_followup",
    );
    await t.mutation(internal.automation.finish, {
      eventId: event._id,
      attempt: event.attempts,
    });
    await t.mutation(internal.automation.ingest, {
      body: sms(`ack-${scenario}`, "Okay"),
    });
    const ack = await prepareNext(t);
    assert.equal(
      (await t.query(internal.automation.outbox, { eventId: ack.event._id }))
        .length,
      0,
    );
  }
});

test("demo quota and reset limits persist and missing booking links fail before creating a test", async () => {
  const t = setup();
  const a = await seed(t);
  await t.run((ctx) => ctx.db.patch(a, { bookingLink: undefined }));
  await assert.rejects(startDemo(t, { bookingEnabled: true }), /booking link/);
  for (let i = 0; i < 3; i++) {
    const session = await startDemo(t);
    await t
      .withIdentity({ subject: "operator" })
      .mutation(api.demoSessions.reset, { sessionId: session.sessionId });
  }
  await assert.rejects(startDemo(t), /Try again at/);
  assert.equal(
    (await t.run((ctx) => ctx.db.query("demoSessions").collect())).length,
    3,
  );
});

test("another tester requires recorded demo consent and it is rechecked at submission", async () => {
  const t = setup();
  await seed(t);
  const other = "+12025550177";
  await assert.rejects(startDemo(t, { recipient: other }), /consent/);
  const consent = await t.mutation(internal.demoSmsConsent.capture, {
    record: {
      id: "other-consent",
      type: "roofreply_demo_sms_opt_in",
      phoneNumber: other,
      rawPhone: other,
      name: null,
      company: null,
      timestamp: new Date().toISOString(),
      sourceUrl: null,
      ipAddress: null,
      userAgent: null,
      consentText: DEMO_SMS_CONSENT_TEXT,
      consentVersion: DEMO_SMS_CONSENT_VERSION,
    },
  });
  await startDemo(t, { recipient: other });
  const { event } = await prepareNext(t, other);
  const out = (
    await t.query(internal.automation.outbox, { eventId: event._id })
  )[0];
  await t.run((ctx) => ctx.db.delete(consent.id!));
  assert.equal(
    await t.mutation(internal.automation.beginSend, {
      id: out._id,
      attempt: 1,
    }),
    null,
  );
});

test("demo worker keeps replies business-facing and exposes delivery separately from the contractor result", async (context) => {
  const t = setup();
  await seed(t);
  await startDemo(t);
  await finishOpening(t);
  context.mock.method(
    globalThis,
    "fetch",
    async (url: string | URL | Request) =>
      String(url).includes("openai.com")
        ? Response.json({
            choices: [{ message: { content: JSON.stringify(qualified) } }],
          })
        : Response.json({ data: { id: "demo-qualified-reply" } }),
  );
  const oldAi = process.env.OPENAI_API_KEY,
    oldTelnyx = process.env.TELNYX_API_KEY;
  process.env.OPENAI_API_KEY = "test";
  process.env.TELNYX_API_KEY = "test";
  try {
    await t.mutation(internal.automation.ingest, {
      body: sms(
        "demo-worker",
        "I'm Taylor in Phoenix. I need a roof inspection, no rush.",
      ),
    });
    await worker(t);
    const result = await t
      .withIdentity({ subject: "operator" })
      .query(api.demoSessions.inspect, { clerkId: "owner", recipient });
    assert.equal(result?.session?.state, "completed");
    assert.equal(result?.lead?.name, "Taylor");
    assert.equal(result?.messages.at(-1)?.delivery, "accepted");
    assert.equal(
      result?.messages.at(-1)?.content,
      "I'll pass these details to the roofing team. They'll review the work you're asking about and follow up.",
    );
    const out = await t.run((ctx) =>
      ctx.db.query("outboundMessages").collect(),
    );
    assert.equal(out.length, 2);
    assert.ok(out.every((m) => m.purpose === "reply"));
    assert.equal(
      (
        await t
          .withIdentity({ subject: "owner" })
          .query(api.leads.getLeadStats, { clerkId: "owner" })
      ).totalLeads,
      0,
    );
    await assert.rejects(
      t
        .withIdentity({ subject: "operator" })
        .mutation(api.pilot.activate, { clerkId: "owner", mode: "live" }),
      /delivered/,
    );
  } finally {
    if (oldAi === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = oldAi;
    if (oldTelnyx === undefined) delete process.env.TELNYX_API_KEY;
    else process.env.TELNYX_API_KEY = oldTelnyx;
  }
});

test("lead conversation shows queued and delivered outbox states without duplicate messages or owner alerts", async () => {
  const t = setup();
  await seed(t);
  const session = await startDemo(t);
  const { event } = await prepareNext(t);
  const leadId = (await t.run((ctx) => ctx.db.get(session.sessionId)))!.leadId!;
  const viewer = t.withIdentity({ subject: "owner" });
  const queued = await viewer.query(api.leads.getLeadWithMessagesForViewer, {
    leadId,
  });
  assert.equal(queued?.messages.length, 1);
  assert.equal(queued?.messages[0].delivery, "queued");
  const out = (
    await t.query(internal.automation.outbox, { eventId: event._id })
  )[0];
  await t.mutation(internal.automation.beginSend, {
    id: out._id,
    attempt: event.attempts,
  });
  await t.mutation(internal.automation.finishSend, {
    id: out._id,
    state: "accepted",
    providerId: "status-test",
  });
  const accepted = await viewer.query(api.leads.getLeadWithMessagesForViewer, {
    leadId,
  });
  assert.equal(accepted?.messages.length, 1);
  assert.equal(accepted?.messages[0].delivery, "accepted");
  const receipt = JSON.parse(
    sms(
      "status-receipt",
      "",
      sender,
      recipient,
      "message.finalized",
      "delivered",
    ),
  );
  receipt.data.payload.id = "status-test";
  await t.mutation(internal.automation.ingest, {
    body: JSON.stringify(receipt),
  });
  const delivered = await viewer.query(api.leads.getLeadWithMessagesForViewer, {
    leadId,
  });
  assert.equal(delivered?.messages.length, 1);
  assert.equal(delivered?.messages[0].delivery, "delivered");
});

test("overview counts and latest leads exclude samples, sessions, and other accounts", async () => {
  const t = setup();
  await seed(t);
  await seed(t, "other", "+12025550186");
  const ids = [];
  const statuses = [
    "new",
    "qualifying",
    "needs_followup",
    "needs_contractor_review",
    "qualified",
    "booking_link_sent",
  ] as const;
  for (let i = 0; i < statuses.length; i++) {
    const id = await t.mutation(internal.leads.createLead, {
      clerkId: "owner",
      phoneNumber: "+1202555020" + i,
      channel: "sms",
    });
    await t.run((ctx) =>
      ctx.db.patch(id, { status: statuses[i], createdAt: i + 1 }),
    );
    ids.push(id);
  }
  await t.mutation(internal.leads.createLead, {
    clerkId: "other",
    phoneNumber: "+12025550185",
    channel: "sms",
  });
  await t
    .withIdentity({ subject: "operator" })
    .mutation(api.pilot.seedDemo, { clerkId: "owner" });
  await startDemo(t);
  await prepareNext(t);
  const stats = await t
    .withIdentity({ subject: "owner" })
    .query(api.leads.getLeadStats, { clerkId: "owner" });
  assert.equal(stats.totalLeads, 6);
  assert.equal(stats.needsActionLeads, 4);
  assert.deepEqual(
    stats.recentLeads.map((lead) => lead._id),
    ids.slice(1).reverse(),
  );
  await assert.rejects(t.query(api.leads.getLeadStats, { clerkId: "owner" }));
  await assert.rejects(
    t
      .withIdentity({ subject: "other" })
      .query(api.leads.getLeadStats, { clerkId: "owner" }),
  );
});

test("guided onboarding saves in two steps, keeps preferences, and completes without activating or sending", async () => {
  const t = setup();
  const owner = t.withIdentity({ subject: "guided-owner" });
  await owner.mutation(api.users.getOrCreateUser, {
    clerkId: "guided-owner",
    email: "guided@example.test",
  });
  await owner.mutation(api.onboarding.saveOnboardingStep, {
    clerkId: "guided-owner",
    step: 2,
    data: {
      legalBusinessName: "Sample Roofer",
      businessPhone: "+12025550199",
      serviceAreas: [{ type: "city", value: "Mesa" }],
      aiTone: "bilingual",
      leadHandoffMode: "review_and_booking",
      bookingLink: "https://calendly.com/example/inspection",
      thingsNotToSay: "Do not quote prices.",
    },
  });
  assert.equal(
    await owner.query(api.users.hasCompletedOnboarding, {
      clerkId: "guided-owner",
    }),
    false,
  );
  const submit = {
    clerkId: "guided-owner",
    step: 5,
    data: {
      bookingDeliveryMethod: "phone" as const,
      bookingDeliveryPhone: "(202) 555-0199",
      accountSmsConsentGranted: true,
      accountSmsConsentText: ACCOUNT_SMS_CONSENT_TEXT,
      accountSmsConsentVersion: ACCOUNT_SMS_CONSENT_VERSION,
    },
  };
  // Repeating after a lost response must not create another account or send.
  await owner.mutation(api.onboarding.saveOnboardingStep, submit);
  await owner.mutation(api.onboarding.saveOnboardingStep, submit);
  await owner.mutation(api.onboarding.completeOnboarding, {
    clerkId: "guided-owner",
  });
  const a = await owner.query(api.onboarding.getOnboarding, {
    clerkId: "guided-owner",
  });
  assert.equal(a?.activationMode, "paused");
  assert.equal(a?.bookingDeliveryPhone, "+12025550199");
  assert.equal(a?.accountSmsConsentPhone, "+12025550199");
  assert.equal(a?.aiTone, "bilingual");
  assert.equal(a?.leadHandoffMode, "review_and_booking");
  assert.equal(a?.thingsNotToSay, "Do not quote prices.");
  assert.equal(a?.bookingLink, "https://calendly.com/example/inspection");
  assert.equal(
    await owner.query(api.users.hasCompletedOnboarding, {
      clerkId: "guided-owner",
    }),
    true,
  );
  assert.equal(
    (await t.run((ctx) => ctx.db.query("onboarding").collect())).length,
    1,
  );
  assert.equal(
    (await t.run((ctx) => ctx.db.query("outboundMessages").collect())).length,
    0,
  );
});
