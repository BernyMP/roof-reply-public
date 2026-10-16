import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  canMessage,
  hasOwnerConsent,
  readinessBlockers,
} from "../lib/automation-policy";
import {
  DEMO_SMS_CONSENT_TEXT,
  DEMO_SMS_CONSENT_VERSION,
} from "../lib/ten-dlc-demo-campaign";

type ReadCtx = Pick<QueryCtx | MutationCtx, "db">;
export async function demoConsentReference(
  ctx: ReadCtx,
  a: Doc<"onboarding">,
  recipient: string,
) {
  const preference = await ctx.db
    .query("smsPreferences")
    .withIndex("by_pair", (q) =>
      q.eq("sender", a.telnyxPhoneNumber!).eq("recipient", recipient),
    )
    .unique();
  const legacy = preference
    ? null
    : await ctx.db
        .query("optOuts")
        .withIndex("by_phone", (q) => q.eq("phoneNumber", recipient))
        .first();
  if (preference?.blocked || legacy) return null;
  if (recipient === a.bookingDeliveryPhone && hasOwnerConsent(a))
    return `account:${a._id}:${a.accountSmsConsentVersion}:${a.accountSmsConsentAt ?? 0}`;
  const consent = await ctx.db
    .query("demoSmsOptIns")
    .withIndex("by_phone_created_at", (q) => q.eq("phoneNumber", recipient))
    .order("desc")
    .first();
  return consent?.consentText === DEMO_SMS_CONSENT_TEXT &&
    consent.consentVersion === DEMO_SMS_CONSENT_VERSION
    ? String(consent._id)
    : null;
}

export async function sessionAllowsSending(
  ctx: ReadCtx,
  a: Doc<"onboarding">,
  recipient: string,
  sessionId?: Id<"demoSessions">,
) {
  if (!sessionId) return canMessage(a, recipient);
  const session = await ctx.db.get(sessionId);
  return Boolean(
    session &&
    ["active", "completed"].includes(session.state) &&
    (!session.eventDemo || (process.env.EVENT_DEMO_ENABLED === "true" &&
      process.env.EVENT_DEMO_RATES_VERIFIED === "true" && session.terminationReason !== "budget" &&
      Date.now() - (session.lastActivityAt ?? session.updatedAt) < 30 * 60 * 1000)) &&
    session.clerkId === a.clerkId &&
    session.sender === a.telnyxPhoneNumber &&
    session.recipient === recipient &&
    a.isDemoAccount &&
    a.activationMode &&
    a.activationMode !== "paused" &&
    readinessBlockers(a, false).length === 0 &&
    (await demoConsentReference(ctx, a, recipient)),
  );
}

export async function settleDemoReset(
  ctx: MutationCtx,
  sessionId?: Id<"demoSessions">,
) {
  if (!sessionId) return;
  const session = await ctx.db.get(sessionId);
  if (session?.state !== "resetting") return;
  const messages = await ctx.db
    .query("outboundMessages")
    .withIndex("by_session", (q) => q.eq("demoSessionId", sessionId))
    .collect();
  // Accepted submissions can still arrive on the handset; wait for their final receipt too.
  if (
    messages.some((m) => ["sending", "uncertain", "accepted"].includes(m.state))
  )
    return;
  await ctx.db.patch(sessionId, {
    state: "archived",
    archivedAt: Date.now(),
    updatedAt: Date.now(),
  });
}
