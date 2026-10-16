import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import {
  ACCOUNT_SMS_CONSENT_TEXT,
  ACCOUNT_SMS_CONSENT_VERSION,
} from "../lib/account-sms-consent";
import { CONCIERGE_CHECKLIST, sameDayDeadline } from "../lib/concierge";
const modules = Object.fromEntries(
  readdirSync(new URL("../convex/", import.meta.url))
    .filter((file) => file.endsWith(".ts"))
    .map((file) => [
      `../convex/${file}`,
      () =>
        import(fileURLToPath(new URL(`../convex/${file}`, import.meta.url))),
    ]),
);
modules["../convex/_generated/server.ts"] = () =>
  import("../convex/_generated/server");
function setup() {
  process.env.OPS_ADMIN_CLERK_IDS = "operator";
  return convexTest(schema, modules);
}
async function prepare(t: ReturnType<typeof setup>, clerkId = "owner") {
  const owner = t.withIdentity({ subject: clerkId });
  await owner.mutation(api.users.getOrCreateUser, {
    clerkId,
    email: `${clerkId}@example.test`,
    name: "Sample Owner",
  });
  await owner.mutation(api.onboarding.saveOnboardingStep, {
    clerkId,
    step: 2,
    data: {
      legalBusinessName: "Sample Roofing",
      businessPhone: "+16025550100",
      serviceAreas: [{ type: "city", value: "Mesa" }],
      bookingDeliveryPhone: "+16025550101",
      accountSmsConsentGranted: true,
      accountSmsConsentText: ACCOUNT_SMS_CONSENT_TEXT,
      accountSmsConsentVersion: ACCOUNT_SMS_CONSENT_VERSION,
      aiTone: "bilingual",
      leadHandoffMode: "review_and_booking",
      bookingLink: "https://calendly.com/sample/roof",
    },
  });
  return owner;
}

test("each contact preference completes atomically, preserves preferences, and never provisions or sends", async () => {
  for (const preference of ["email", "sms", "both"] as const) {
    const t = setup();
    const owner = await prepare(t);
    await Promise.all(
      [1, 2].map(() =>
        owner.mutation(api.onboarding.completeOnboarding, {
          clerkId: "owner",
          contactPreference: preference,
        }),
      ),
    );
    const first = await owner.query(api.concierge.customerProgress, {
      clerkId: "owner",
    });
    assert.ok(first);
    await owner.mutation(api.onboarding.completeOnboarding, {
      clerkId: "owner",
      contactPreference: "email",
    });
    assert.deepEqual(
      await owner.query(api.concierge.customerProgress, { clerkId: "owner" }),
      first,
    );
    assert.equal(first.contactPreference, preference);
    assert.equal(first.followUpDueAt, sameDayDeadline(first.enrolledAt));
    const account = await owner.query(api.onboarding.getOnboarding, {
      clerkId: "owner",
    });
    assert.equal(account?.activationMode, "paused");
    assert.equal(account?.aiTone, "bilingual");
    assert.equal(account?.leadHandoffMode, "review_and_booking");
    assert.equal(account?.telnyxPhoneNumber, undefined);
    assert.equal(
      (await t.run((ctx) => ctx.db.query("onboardingConcierge").collect()))
        .length,
      1,
    );
    assert.equal(
      (await t.run((ctx) => ctx.db.query("outboundMessages").collect())).length,
      0,
    );
    assert.equal(
      (await t.run((ctx) => ctx.db.query("automationEvents").collect())).length,
      0,
    );
  }
});
test("all completion entrypoints validate business details and current consent", async () => {
  const t = setup();
  const owner = await prepare(t);
  await owner.mutation(api.onboarding.saveOnboardingStep, {
    clerkId: "owner",
    step: 2,
    data: { legalBusinessName: " " },
  });
  await assert.rejects(
    owner.mutation(api.onboarding.completeOnboarding, { clerkId: "owner" }),
    /business details/,
  );
  await assert.rejects(
    owner.mutation(api.users.updateOnboardingStep, {
      clerkId: "owner",
      step: 5,
      completed: true,
    }),
    /business details/,
  );
  await owner.mutation(api.onboarding.saveOnboardingStep, {
    clerkId: "owner",
    step: 2,
    data: {
      legalBusinessName: "Sample Roofing",
      bookingDeliveryPhone: "+16025550102",
    },
  });
  await assert.rejects(
    owner.mutation(api.onboarding.completeOnboarding, {
      clerkId: "owner",
      contactPreference: "sms",
    }),
    /SMS permission/,
  );
  assert.equal(
    await owner.query(api.users.hasCompletedOnboarding, { clerkId: "owner" }),
    false,
  );
  assert.equal(
    (await t.run((ctx) => ctx.db.query("onboardingConcierge").collect()))
      .length,
    0,
  );
  await owner.mutation(api.onboarding.saveOnboardingStep, {
    clerkId: "owner",
    step: 5,
    data: {
      accountSmsConsentGranted: true,
      accountSmsConsentText: ACCOUNT_SMS_CONSENT_TEXT,
      accountSmsConsentVersion: ACCOUNT_SMS_CONSENT_VERSION,
    },
  });
  await owner.mutation(api.users.updateOnboardingStep, {
    clerkId: "owner",
    step: 5,
    completed: true,
  });
  assert.equal(
    (await owner.query(api.concierge.customerProgress, { clerkId: "owner" }))
      ?.contactPreference,
    "email",
  );
});
test("private concierge records are operator-only; progress is projected and account-scoped", async () => {
  const t = setup();
  const owner = await prepare(t);
  await owner.mutation(api.onboarding.completeOnboarding, { clerkId: "owner" });
  const operator = t.withIdentity({ subject: "operator" });
  await operator.mutation(api.concierge.updateCoordination, {
    clerkId: "owner",
    nextAction: "Meet with Berny",
    nextActionOwner: "customer",
    privateNotes: "Private operator note",
    kickoffAt: Date.now() + 60000,
  });
  await operator.mutation(api.concierge.updateChecklist, {
    clerkId: "owner",
    key: "registration",
    status: "complete",
    reference: "private-provider-reference",
  });
  const progress = await owner.query(api.concierge.customerProgress, {
    clerkId: "owner",
  });
  assert.ok(progress?.kickoffAt);
  assert.equal(progress.nextAction, "Meet with Berny");
  assert.doesNotMatch(
    JSON.stringify(progress),
    /private-provider-reference|Private operator note|updatedBy|"checklist"/,
  );
  for (const key of [
    "privateNotes",
    "checklist",
    "emailContactedBy",
    "smsContactedBy",
    "clerkId",
    "userId",
  ])
    assert.equal(key in progress, false);
  const records = await operator.query(api.concierge.enrollments, {});
  assert.equal(records[0].privateNotes, "Private operator note");
  await operator.mutation(api.concierge.updateChecklist, {
    clerkId: "owner",
    key: "routing",
    status: "waiting",
    reference: "Private phone-system access note",
  });
  const waiting = await owner.query(api.concierge.customerProgress, {
    clerkId: "owner",
  });
  assert.deepEqual(waiting?.waitingOn, ["Your existing phone setup"]);
  assert.doesNotMatch(JSON.stringify(waiting), /Private phone-system/);
  await assert.rejects(
    t.query(api.concierge.customerProgress, { clerkId: "owner" }),
    /Unauthorized/,
  );
  await assert.rejects(
    t
      .withIdentity({ subject: "other" })
      .query(api.concierge.customerProgress, { clerkId: "owner" }),
    /Forbidden/,
  );
  await assert.rejects(owner.query(api.concierge.enrollments, {}), /Forbidden/);
  await assert.rejects(
    owner.mutation(api.concierge.updateChecklist, {
      clerkId: "owner",
      key: "launch",
      status: "complete",
      reference: "fake",
    }),
    /Forbidden/,
  );
  await assert.rejects(
    owner.mutation(api.concierge.markContacted, {
      clerkId: "owner",
      channel: "email",
    }),
    /Forbidden/,
  );
});
test("contact recording is per channel and idempotent; copies do not count as contact", async () => {
  const t = setup();
  const owner = await prepare(t);
  await owner.mutation(api.onboarding.completeOnboarding, {
    clerkId: "owner",
    contactPreference: "both",
  });
  const operator = t.withIdentity({ subject: "operator" });
  const original = await owner.query(api.concierge.customerProgress, {
    clerkId: "owner",
  });
  assert.equal(original?.emailContactedAt, undefined);
  await operator.mutation(api.concierge.markContacted, {
    clerkId: "owner",
    channel: "email",
  });
  const emailed = await owner.query(api.concierge.customerProgress, {
    clerkId: "owner",
  });
  assert.ok(emailed?.emailContactedAt);
  assert.equal(emailed.smsContactedAt, undefined);
  await operator.mutation(api.concierge.markContacted, {
    clerkId: "owner",
    channel: "email",
  });
  assert.deepEqual(
    await owner.query(api.concierge.customerProgress, { clerkId: "owner" }),
    emailed,
  );
  await operator.mutation(api.concierge.markContacted, {
    clerkId: "owner",
    channel: "sms",
  });
  const both = await owner.query(api.concierge.customerProgress, {
    clerkId: "owner",
  });
  assert.ok(both?.smsContactedAt);
  assert.equal(both.nextActionOwner, "customer");
  assert.equal(both.followUpDueAt, original?.followUpDueAt);
  assert.equal(
    (await t.run((ctx) => ctx.db.query("outboundMessages").collect())).length,
    0,
  );
});
test("new enrollments need concierge completion as well as existing delivery evidence", async () => {
  const t = setup();
  const owner = await prepare(t);
  await owner.mutation(api.onboarding.completeOnboarding, { clerkId: "owner" });
  const operator = t.withIdentity({ subject: "operator" });
  const account = await owner.query(api.onboarding.getOnboarding, {
    clerkId: "owner",
  });
  await t.run((ctx) =>
    ctx.db.patch(account!._id, {
      provisioningStatus: "ready",
      telnyxPhoneNumber: "+16025550103",
      messagingProfileId: "profile",
      voiceApplicationId: "voice",
      campaignId: "campaign",
      campaignStatus: "approved",
      verificationStatus: "approved",
      providerEvidence: "verified",
      forwardingEvidence: "verified",
      rehearsalEvidence: "verified",
      keywordHandling: "telnyx",
    }),
  );
  await assert.rejects(
    operator.mutation(api.pilot.activate, { clerkId: "owner", mode: "live" }),
    /concierge setup/,
  );
  await operator.mutation(api.pilot.activate, {
    clerkId: "owner",
    mode: "rehearsal",
  });
  await assert.rejects(
    operator.mutation(api.concierge.updateChecklist, {
      clerkId: "owner",
      key: "registration",
      status: "complete",
      reference: " ",
    }),
    /confirmation/,
  );
  await assert.rejects(
    operator.mutation(api.concierge.updateChecklist, {
      clerkId: "owner",
      key: "launch",
      status: "complete",
      reference: "Approved",
    }),
    /other setup/,
  );
  for (const { key } of CONCIERGE_CHECKLIST)
    await operator.mutation(api.concierge.updateChecklist, {
      clerkId: "owner",
      key,
      status: "complete",
      reference: "Reviewed with owner",
    });
  await assert.rejects(
    operator.mutation(api.pilot.activate, { clerkId: "owner", mode: "live" }),
    /three separate conversations/,
  );
  assert.equal(
    (await owner.query(api.concierge.customerProgress, { clerkId: "owner" }))
      ?.setupComplete,
    true,
  );
  // Deterministic delivery fixtures: no provider calls or actual texts are sent.
  await t.run(async (ctx) => {
    for (let index = 0; index < 3; index++) {
      const leadId = await ctx.db.insert("leads", {
        userId: account!.userId,
        clerkId: "owner",
        phoneNumber: "+16025550101",
        status: "qualified",
        channel: "sms",
        userNotified: true,
        createdAt: 1,
        updatedAt: 1,
      });
      const eventId = await ctx.db.insert("automationEvents", {
        eventId: `rehearsal-${index}`,
        conversationKey: `rehearsal-${index}`,
        clerkId: "owner",
        type: "message.received",
        sender: "+16025550103",
        recipient: "+16025550101",
        providerId: `provider-${index}`,
        text: "Test",
        occurredAt: 1,
        receivedAt: 1,
        status: "completed",
        attempts: 1,
        leadId,
      });
      for (const purpose of ["reply", "owner"] as const)
        await ctx.db.insert("outboundMessages", {
          key: `${index}-${purpose}`,
          eventId,
          clerkId: "owner",
          leadId,
          from: "+16025550103",
          to: "+16025550101",
          text: "Test",
          purpose,
          state: "delivered",
          createdAt: 1,
          updatedAt: 1,
        });
    }
  });
  await operator.mutation(api.pilot.activate, {
    clerkId: "owner",
    mode: "live",
  });
  assert.equal(
    (await owner.query(api.onboarding.getOnboarding, { clerkId: "owner" }))
      ?.activationMode,
    "live",
  );
  await operator.mutation(api.concierge.updateChecklist, {
    clerkId: "owner", key: "routing", status: "waiting", reference: "Phone system changed; confirm routing again",
  });
  assert.equal((await owner.query(api.onboarding.getOnboarding, { clerkId: "owner" }))?.activationMode, "paused");
  await assert.rejects(operator.mutation(api.pilot.activate, { clerkId: "owner", mode: "live" }), /concierge setup/);
  await operator.mutation(api.concierge.updateConfiguration, {
    clerkId: "owner",
    data: { aiTone: "professional" },
  });
  const updated = await owner.query(api.onboarding.getOnboarding, {
    clerkId: "owner",
  });
  assert.equal(updated?.activationMode, "paused");
  assert.equal(updated?.rehearsalEvidence, undefined);
  assert.equal(updated?.accountSmsConsentGranted, true);
  assert.equal(
    (await owner.query(api.concierge.customerProgress, { clerkId: "owner" }))
      ?.setupComplete,
    false,
  );
  await assert.rejects(
    owner.mutation(api.concierge.updateConfiguration, {
      clerkId: "owner",
      data: { aiTone: "friendly" },
    }),
    /Forbidden/,
  );
});
test("existing completed live accounts are not reenrolled or paused by legacy retries", async () => {
  const t = setup();
  const owner = await prepare(t);
  const account = await owner.query(api.onboarding.getOnboarding, {
    clerkId: "owner",
  });
  await t.run(async (ctx) => {
    await ctx.db.patch(account!._id, {
      activationMode: "live",
      completedAt: 1,
    });
    await ctx.db.patch(account!.userId, { onboardingCompleted: true });
  });
  await owner.mutation(api.onboarding.completeOnboarding, { clerkId: "owner" });
  await owner.mutation(api.users.updateOnboardingStep, {
    clerkId: "owner",
    step: 5,
    completed: true,
  });
  assert.equal(
    (await owner.query(api.onboarding.getOnboarding, { clerkId: "owner" }))
      ?.activationMode,
    "live",
  );
  assert.equal(
    await owner.query(api.concierge.customerProgress, { clerkId: "owner" }),
    null,
  );
});
