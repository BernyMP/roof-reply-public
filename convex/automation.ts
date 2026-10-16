import { admitEventDemo, isEventDemoAccount, reserveDemoCost } from "./eventDemoPolicy.util";
import { EVENT_DEMO, EVENT_DEMO_CLOSING, EVENT_DEMO_OPENING, eventDemoSms, eventDemoDay } from "../lib/event-demo-policy";
import { ConvexError, v } from "convex/values";
import {
  sessionAllowsSending,
  settleDemoReset,
} from "./demoSessionPolicy.util";
import { demoOpening, isClosingAcknowledgment } from "../lib/demo-conversation";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
  requireAuthenticatedClerkId,
  requireOpsAdmin,
} from "./authHelpers.util";
import {
  hasOwnerConsent,
  nextDeliveryState,
  parseTelnyxEvent,
} from "../lib/automation-policy";
import {
  isOptOutMessage,
  isOptInMessage,
  isHelpMessage,
  getSmsKeywordResponsesForNumber,
} from "../lib/telnyx";
import { evaluateQuotaStatus } from "../lib/usage-control";
import { deliveryStatus } from "./pilotValidators";
import { buildTestSmsMessage } from "../lib/test-sms";
import {
  DEMO_SMS_CONSENT_TEXT,
  DEMO_SMS_CONSENT_VERSION,
} from "../lib/ten-dlc-demo-campaign";

async function account(ctx: MutationCtx, clerkId: string) {
  return ctx.db
    .query("onboarding")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
    .unique();
}
async function blocked(ctx: MutationCtx, sender: string, recipient: string) {
  const preference = await ctx.db
    .query("smsPreferences")
    .withIndex("by_pair", (q) =>
      q.eq("sender", sender).eq("recipient", recipient),
    )
    .unique();
  if (preference) return preference.blocked;
  // Existing global suppressions stay in force until explicit START to this sender.
  return Boolean(
    await ctx.db
      .query("optOuts")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", recipient))
      .first(),
  );
}
async function recipientEligible(
  ctx: MutationCtx,
  a: Doc<"onboarding">,
  recipient: string,
) {
  if (await blocked(ctx, a.telnyxPhoneNumber!, recipient)) return false;
  if (recipient === a.bookingDeliveryPhone) return hasOwnerConsent(a);
  if (!a.isDemoAccount) return true;
  const consent = await ctx.db
    .query("demoSmsOptIns")
    .withIndex("by_phone_created_at", (q) => q.eq("phoneNumber", recipient))
    .order("desc")
    .first();
  return Boolean(
    consent &&
    consent.consentVersion === DEMO_SMS_CONSENT_VERSION &&
    consent.consentText === DEMO_SMS_CONSENT_TEXT,
  );
}
async function recordPreference(
  ctx: MutationCtx,
  sender: string,
  recipient: string,
  value: boolean,
) {
  const preference = await ctx.db
    .query("smsPreferences")
    .withIndex("by_pair", (q) =>
      q.eq("sender", sender).eq("recipient", recipient),
    )
    .unique();
  if (preference)
    await ctx.db.patch(preference._id, {
      blocked: value,
      updatedAt: Date.now(),
    });
  else
    await ctx.db.insert("smsPreferences", {
      sender,
      recipient,
      blocked: value,
      updatedAt: Date.now(),
    });
}
async function reserve(
  ctx: MutationCtx,
  clerkId: string,
  pending: {
    smsOutbound?: number;
    aiCalls?: number;
    leadsCreated?: number;
    missedCallsSms?: number;
    ownerNotifications?: number;
  },
) {
  const date = new Date().toISOString().slice(0, 10);
  const month = date.slice(0, 7);
  const records = await ctx.db
    .query("usageTracking")
    .withIndex("by_clerk_and_date", (q) =>
      q.eq("clerkId", clerkId).gte("date", `${month}-01`),
    )
    .collect();
  const today = records.find((r) => r.date === date);
  const totals = records.reduce(
    (a, r) => ({
      smsOutbound: a.smsOutbound + r.smsOutbound,
      aiCalls: a.aiCalls + r.aiCalls,
      leadsCreated: a.leadsCreated + r.leadsCreated,
    }),
    { smsOutbound: 0, aiCalls: 0, leadsCreated: 0 },
  );
  const quotas = await ctx.db
    .query("usageQuotas")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
    .unique();
  const limits = quotas ?? {
    monthlySmslimit: 2000,
    monthlyAiLimit: 2000,
    monthlyLeadLimit: 500,
    dailySmsLimit: 200,
    dailyAiLimit: 100,
    dailyLeadLimit: 50,
    isActive: true,
  };
  const status = evaluateQuotaStatus({
    limits,
    todayUsage: today ?? { smsOutbound: 0, aiCalls: 0, leadsCreated: 0 },
    monthlyUsage: totals,
    pending,
  });
  if (status.exceeded) throw new Error(status.reason ?? "Quota exceeded");
  const increments = {
    smsOutbound: (today?.smsOutbound ?? 0) + (pending.smsOutbound ?? 0),
    aiCalls: (today?.aiCalls ?? 0) + (pending.aiCalls ?? 0),
    leadsCreated: (today?.leadsCreated ?? 0) + (pending.leadsCreated ?? 0),
    missedCallsSms:
      (today?.missedCallsSms ?? 0) + (pending.missedCallsSms ?? 0),
    ownerNotifications:
      (today?.ownerNotifications ?? 0) + (pending.ownerNotifications ?? 0),
    updatedAt: Date.now(),
  };
  if (today) await ctx.db.patch(today._id, increments);
  else
    await ctx.db.insert("usageTracking", {
      clerkId,
      date,
      smsInbound: 0,
      aiTokensUsed: 0,
      createdAt: Date.now(),
      ...increments,
    });
}
async function enqueueOutbound(
  ctx: MutationCtx,
  event: Doc<"automationEvents">,
  purpose: Doc<"outboundMessages">["purpose"],
  to: string,
  text: string,
) {
  if (!event.clerkId) throw new Error("Unknown account");
  if (event.demoSessionId && purpose === "owner") return null;
  if (event.demoSessionId && purpose !== "keyword") {
    const session = await ctx.db.get(event.demoSessionId);
    if (!session || !["active", "completed"].includes(session.state))
      return null;
  }
  const key = `${event._id}:${purpose}`;
  const previous = await ctx.db
    .query("outboundMessages")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  if (previous) return previous._id;
  if (event.demoSessionId && purpose !== "keyword") {
    const session = await ctx.db.get(event.demoSessionId);
    if (session?.eventDemo) {
      if ((session.messageCount ?? 0) >= EVENT_DEMO.messages || (session.outboundCount ?? 0) >= EVENT_DEMO.outbound) return null;
      text = eventDemoSms(text);
      await ctx.db.patch(session._id, { messageCount: (session.messageCount ?? 0) + 1, outboundCount: (session.outboundCount ?? 0) + 1, lastActivityAt: Date.now(), updatedAt: Date.now() });
    }
  }
  const a = await account(ctx, event.clerkId);
  // The approved demo campaign has embedded phone numbers disabled.
  const messageText = a?.isDemoAccount
    ? text.replace(/\+[1-9]\d{7,14}/g, "[demo number]")
    : text;
  return ctx.db.insert("outboundMessages", {
    key,
    demoSessionId: event.demoSessionId,
    eventId: event._id,
    clerkId: event.clerkId,
    leadId: event.leadId,
    from: event.sender,
    to,
    text:
      a?.isDemoAccount && !event.demoSessionId && purpose !== "keyword"
        ? `RoofReply demo: ${messageText}`
        : messageText,
    purpose,
    state: "queued",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

export const ingest = internalMutation({
  args: { body: v.string() },
  handler: async (ctx, args) => {
    const e = parseTelnyxEvent(JSON.parse(args.body));
    if (!e.incoming) return { status: "ignored" };
    const existing = await ctx.db
      .query("automationEvents")
      .withIndex("by_event", (q) => q.eq("eventId", e.id))
      .unique();
    if (existing) return { status: "duplicate" };
    const a = await ctx.db
      .query("onboarding")
      .withIndex("by_telnyx_phone", (q) => q.eq("telnyxPhoneNumber", e.sender))
      .unique();
    const receipt = e.type === "message.sent" || e.type === "message.finalized";
    // Use provider occurrence time so a delayed old event cannot enter a fresh test.
    const keywordEvent =
      e.type === "message.received" &&
      (isOptOutMessage(e.text) ||
        isOptInMessage(e.text) ||
        isHelpMessage(e.text));
    let demoSession =
      !receipt && !keywordEvent && a?.isDemoAccount
        ? await ctx.db
            .query("demoSessions")
            .withIndex("by_pair", (q) =>
              q
                .eq("sender", e.sender)
                .eq("recipient", e.recipient)
                .lte("createdAt", e.occurredAt),
            )
            .order("desc")
            .first()
        : null;
    let eventType: string = e.type;
    let ignoreEvent = false;
    if (a && isEventDemoAccount(a) && !receipt && !keywordEvent) {
      if (e.type === "call.initiated") {
        const prior = await ctx.db.query("automationEvents").withIndex("by_provider", (q) => q.eq("providerId", e.providerId)).first();
        const newest = await ctx.db.query("demoSessions").withIndex("by_pair", (q) => q.eq("sender", e.sender).eq("recipient", e.recipient)).order("desc").first();
        if (prior || process.env.EVENT_DEMO_CALLS_ENABLED !== "true" || (newest && newest.createdAt > e.occurredAt)) ignoreEvent = true;
        else {
          const admitted = await admitEventDemo(ctx, a, e.recipient, `call:${e.providerId}`, "call");
          if (admitted.ok && admitted.status === "queued") {
            demoSession = await ctx.db.get(admitted.sessionId);
            eventType = "demo.start";
          } else ignoreEvent = true;
        }
      } else if (!demoSession?.eventDemo) ignoreEvent = true;
    }
    const eventId = await ctx.db.insert("automationEvents", {
      demoSessionId: demoSession?._id,
      leadId: demoSession?.leadId,
      eventId: e.id,
      conversationKey: `${e.sender}:${e.recipient}`,
      clerkId: a?.clerkId,
      type: eventType,
      sender: e.sender,
      recipient: e.recipient,
      providerId: e.providerId,
      text: demoSession?.eventDemo ? e.text.slice(0, 320) : e.text,
      occurredAt: e.occurredAt,
      receivedAt: Date.now(),
      status: ignoreEvent ? "ignored" : receipt || !a ? "completed" : "queued",
      attempts: 0,
    });
    if (receipt) {
      const previous = await ctx.db
        .query("deliveryReceipts")
        .withIndex("by_provider", (q) => q.eq("providerId", e.providerId))
        .unique();
      const isTerminal = [
        "delivered",
        "delivery_failed",
        "sending_failed",
      ].includes(e.delivery);
      if (!previous)
        await ctx.db.insert("deliveryReceipts", {
          providerId: e.providerId,
          status: e.delivery,
          occurredAt: e.occurredAt,
        });
      else if (
        (e.delivery === "delivered" && e.occurredAt >= previous.occurredAt) ||
        (previous.status !== "delivered" &&
          (isTerminal ||
            !["delivery_failed", "sending_failed"].includes(previous.status)) &&
          e.occurredAt >= previous.occurredAt)
      )
        await ctx.db.patch(previous._id, {
          status: e.delivery,
          occurredAt: e.occurredAt,
        });
      const sent = await ctx.db
        .query("outboundMessages")
        .withIndex("by_provider", (q) => q.eq("providerId", e.providerId))
        .unique();
      if (sent && sent.from === e.sender && sent.to === e.recipient) {
        await ctx.db.patch(eventId, {
          demoSessionId: sent.demoSessionId,
          leadId: sent.leadId,
        });
        await applyDelivery(ctx, sent, e.delivery, e.occurredAt);
      }
      return { status: "recorded" };
    }
    if (!a || ignoreEvent) return { status: "ignored" };
    if (e.type === "message.received") {
      // Count each verified inbound event once, including keywords and paused accounts.
      const date = new Date().toISOString().slice(0, 10);
      const usage = await ctx.db
        .query("usageTracking")
        .withIndex("by_clerk_and_date", (q) =>
          q.eq("clerkId", a.clerkId).eq("date", date),
        )
        .unique();
      if (usage) {
        await ctx.db.patch(usage._id, {
          smsInbound: usage.smsInbound + 1,
          updatedAt: Date.now(),
        });
      } else {
        await ctx.db.insert("usageTracking", {
          clerkId: a.clerkId,
          date,
          smsInbound: 1,
          smsOutbound: 0,
          aiCalls: 0,
          aiTokensUsed: 0,
          leadsCreated: 0,
          missedCallsSms: 0,
          ownerNotifications: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
      const stop = isOptOutMessage(e.text),
        start = isOptInMessage(e.text),
        help = isHelpMessage(e.text);
      if (stop || start)
        await recordPreference(ctx, e.sender, e.recipient, stop);
      if (stop || start || help) {
        // Persist STOP before acknowledging, ahead of any in-flight AI work.
        if (
          a.keywordHandling === "application" &&
          a.provisioningStatus === "ready"
        ) {
          const responses = getSmsKeywordResponsesForNumber(e.sender);
          const event = await ctx.db.get(eventId);
          await enqueueOutbound(
            ctx,
            event!,
            "keyword",
            e.recipient,
            stop ? responses.optOut : start ? responses.optIn : responses.help,
          );
          await ctx.db.patch(eventId, { plannedAt: Date.now() });
        } else {
          await ctx.db.patch(eventId, { status: "completed" });
          return { status: "recorded" };
        }
      }
    }
    if (
      a.isDemoAccount &&
      e.type === "message.received" &&
      !isOptOutMessage(e.text) &&
      !isOptInMessage(e.text) &&
      !isHelpMessage(e.text)
    ) {
      const latest = await ctx.db
        .query("demoSessions")
        .withIndex("by_pair", (q) =>
          q.eq("sender", e.sender).eq("recipient", e.recipient),
        )
        .order("desc")
        .first();
      if (
        latest &&
        (!demoSession || !["active", "completed"].includes(demoSession.state))
      ) {
        await ctx.db.patch(eventId, {
          status: "ignored",
          error: "Outside an active demo session",
        });
        return { status: "ignored" };
      }
    }
    await ctx.scheduler.runAfter(0, internal.automationActions.process, {
      conversationKey: `${e.sender}:${e.recipient}`,
    });
    return { status: "queued" };
  },
});

export const claim = internalMutation({
  args: { conversationKey: v.string() },
  handler: async (ctx, { conversationKey }) => {
    const processing = await ctx.db
      .query("automationEvents")
      .withIndex("by_conversation_status", (q) =>
        q.eq("conversationKey", conversationKey).eq("status", "processing"),
      )
      .first();
    if (processing) return null;
    const event = await ctx.db
      .query("automationEvents")
      .withIndex("by_conversation_status", (q) =>
        q.eq("conversationKey", conversationKey).eq("status", "queued"),
      )
      .first();
    if (!event || (event.nextAttemptAt ?? 0) > Date.now()) return null;
    await ctx.db.patch(event._id, {
      status: "processing",
      startedAt: Date.now(),
      attempts: event.attempts + 1,
    });
    return {
      ...event,
      status: "processing" as const,
      attempts: event.attempts + 1,
    };
  },
});
export const prepare = internalMutation({
  args: { eventId: v.id("automationEvents"), attempt: v.number() },
  handler: async (ctx, { eventId, attempt }) => {
    const event = await ctx.db.get(eventId);
    if (
      !event ||
      event.status !== "processing" ||
      event.attempts !== attempt ||
      !event.clerkId
    )
      return null;
    let a = await account(ctx, event.clerkId);
    const session = event.demoSessionId
      ? await ctx.db.get(event.demoSessionId)
      : null;
    if (
      event.demoSessionId &&
      (!session || !["active", "completed"].includes(session.state))
    ) {
      await ctx.db.patch(eventId, {
        status: "ignored",
        error: "Test is no longer active",
      });
      return null;
    }
    if (session?.eventDemo && !event.plannedAt &&
        (session.state !== "active" || Date.now() - (session.lastActivityAt ?? session.updatedAt) >= EVENT_DEMO.idleMs)) {
      if (session.state === "active") await ctx.db.patch(session._id, { state: "completed", terminationReason: "inactive", updatedAt: Date.now() });
      await ctx.db.patch(eventId, { status: "ignored", error: "Demo session ended" });
      return null;
    }
    if (session && a)
      a = {
        ...a,
        legalBusinessName: session.businessName,
        leadHandoffMode: session.bookingEnabled
          ? "review_and_booking"
          : "review_first",
        bookingLink: session.bookingLink,
        bookingLinkLabel: session.bookingLinkLabel,
      };
    if (event.plannedAt)
      return { event, account: a, history: [], lead: null, readyToSend: true };
    if (
      !a ||
      !(await sessionAllowsSending(
        ctx,
        a,
        event.recipient,
        event.demoSessionId,
      )) ||
      !(await recipientEligible(ctx, a, event.recipient))
    ) {
      await ctx.db.patch(eventId, {
        status: "ignored",
        error: "Account paused, consent missing, or recipient opted out",
      });
      return null;
    }
    let lead = event.leadId
      ? await ctx.db.get(event.leadId)
      : await ctx.db
          .query("leads")
          .withIndex("by_account_phone", (q) =>
            q.eq("clerkId", event.clerkId!).eq("phoneNumber", event.recipient),
          )
          .filter((q) =>
            q.and(
              q.eq(q.field("sampleKey"), undefined),
              q.eq(q.field("demoSessionId"), undefined),
            ),
          )
          .order("desc")
          .first();
    if (event.type === "call.initiated") {
      const priorCall = await ctx.db
        .query("automationEvents")
        .withIndex("by_provider", (q) => q.eq("providerId", event.providerId))
        .filter((q) => q.neq(q.field("_id"), eventId))
        .first();
      if (
        priorCall ||
        (lead &&
          !lead.conversationEnded &&
          lead.updatedAt > Date.now() - 30 * 60 * 1000)
      ) {
        await ctx.db.patch(eventId, { status: "ignored" });
        return null;
      }
      if (lead?.conversationEnded) lead = null;
    }
    if (!lead) {
      await reserve(ctx, event.clerkId, { leadsCreated: 1 });
      const id = await ctx.db.insert("leads", {
        userId: a.userId,
        clerkId: a.clerkId,
        phoneNumber: event.recipient,
        channel: event.type === "call.initiated" ? "call" : "sms",
        status: "new",
        userNotified: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      lead = await ctx.db.get(id);
    }
    if (!lead) throw new Error("Lead not found");
    if (!event.leadId) await ctx.db.patch(eventId, { leadId: lead._id });
    const existingMessage = event.providerId
      ? await ctx.db
          .query("messages")
          .withIndex("by_telnyx_id", (q) =>
            q.eq("telnyxMessageId", event.providerId),
          )
          .first()
      : null;
    if (session?.eventDemo && event.type === "message.received" && !event.demoInboundCounted) {
      if ((session.messageCount ?? 0) >= EVENT_DEMO.messages - 1) {
        await ctx.db.patch(session._id, { state: "completed", terminationReason: "message_limit", updatedAt: Date.now() });
        await ctx.db.patch(eventId, { status: "ignored", error: "Demo message limit" });
        return null;
      }
      await ctx.db.patch(session._id, { messageCount: (session.messageCount ?? 0) + 1, lastActivityAt: Date.now(), updatedAt: Date.now() });
      await ctx.db.patch(eventId, { demoInboundCounted: true });
    }
    if (event.type !== "demo.start" && !existingMessage) {
      await ctx.db.insert("messages", {
        leadId: lead._id,
        userId: lead.userId,
        sender: "lead",
        content:
          event.type === "call.initiated"
            ? "[Missed call forwarded to RoofReply]"
            : event.text,
        telnyxMessageId: event.providerId,
        createdAt: Date.now(),
      });
    }
    if (event.type === "demo.start") {
      await enqueueOutbound(
        ctx,
        { ...event, leadId: lead._id },
        "reply",
        event.recipient,
        session?.eventDemo ? EVENT_DEMO_OPENING : demoOpening(session!.businessName),
      );
      await ctx.db.patch(eventId, { plannedAt: Date.now() });
      return { event, account: a, lead, history: [], readyToSend: true };
    }
    if (event.type === "call.initiated") {
      await enqueueOutbound(
        ctx,
        { ...event, leadId: lead._id },
        "reply",
        event.recipient,
        `Hi, it's ${a.legalBusinessName || "your roofing team"}. Sorry we missed your call. What's going on with your roof? Reply STOP to opt out.`,
      );
      await ctx.db.patch(eventId, { plannedAt: Date.now() });
      return { event, account: a, lead, history: [], readyToSend: true };
    }
    if (session?.eventDemo) {
      const current = (await ctx.db.get(session._id))!;
      if ((current.messageCount ?? 0) >= EVENT_DEMO.messages - 2 ||
          (current.aiCallCount ?? 0) >= EVENT_DEMO.aiCalls ||
          (current.outboundCount ?? 0) >= EVENT_DEMO.outbound - 1) {
        await enqueueOutbound(ctx, { ...event, leadId: lead._id }, "reply", event.recipient, EVENT_DEMO_CLOSING);
        await ctx.db.patch(session._id, { state: "completed", terminationReason: "message_limit", updatedAt: Date.now() });
        await ctx.db.patch(lead._id, { conversationEnded: true, status: "needs_followup", handoffReason: "Demo limit reached", updatedAt: Date.now() });
        await ctx.db.patch(eventId, { plannedAt: Date.now() });
        return { event, account: a, lead, history: [], readyToSend: true };
      }
    }
    if (
      lead.conversationEnded &&
      event.demoSessionId &&
      isClosingAcknowledgment(event.text)
    ) {
      // Keep late acknowledgments in the transcript without another response or alert.
      await ctx.db.patch(eventId, { plannedAt: Date.now() });
      return { event, account: a, lead, history: [], readyToSend: true };
    }
    if (lead.conversationEnded && event.demoSessionId)
      lead = { ...lead, conversationEnded: false };
    if (lead.conversationEnded || (lead.aiResponseCount ?? 0) >= 10) {
      await ctx.db.patch(lead._id, {
        status: "needs_followup",
        conversationEnded: true,
        updatedAt: Date.now(),
      });
      await enqueueOutbound(
        ctx,
        { ...event, leadId: lead._id },
        "owner",
        a.bookingDeliveryPhone!,
        `RoofReply: A roofing conversation needs your review. Open your lead inbox. Caller: ${lead.phoneNumber}`,
      );
      await ctx.db.patch(eventId, { plannedAt: Date.now() });
      return { event, account: a, lead, history: [], readyToSend: true };
    }
    try {
      if (session?.eventDemo) {
        if (!(await reserveDemoCost(ctx, session._id, `${event._id}:ai:${attempt}`, "ai"))) throw new Error("Demo budget exhausted");
      } else await reserve(ctx, event.clerkId, { aiCalls: 1 });
    } catch {
      await ctx.db.patch(lead._id, {
        status: "needs_followup",
        conversationEnded: true,
        handoffReason: "AI quota exhausted; contractor review required",
        updatedAt: Date.now(),
      });
      await enqueueOutbound(
        ctx,
        { ...event, leadId: lead._id },
        "owner",
        a.bookingDeliveryPhone!,
        `RoofReply: A roofing inquiry needs your review. Caller: ${lead.phoneNumber}. Open the lead inbox.`,
      );
      await ctx.db.patch(eventId, {
        plannedAt: Date.now(),
        error: "AI quota exhausted; contractor review required",
      });
      return { event, account: a, lead, history: [], readyToSend: true };
    }
    const history = await ctx.db
      .query("messages")
      .withIndex("by_lead_id", (q) => q.eq("leadId", lead._id))
      .order("desc")
      .take(25);
    return {
      event: { ...event, leadId: lead._id },
      account: a,
      lead,
      history: session?.eventDemo ? history.reverse().slice(-12).map((m) => ({ ...m, content: m.content.slice(0, 320) })) : history.reverse(),
      readyToSend: false,
    };
  },
});

export const savePlan = internalMutation({
  args: {
    eventId: v.id("automationEvents"),
    attempt: v.number(),
    reply: v.optional(v.string()),
    info: v.object({
      name: v.optional(v.string()),
      jobType: v.optional(v.string()),
      location: v.optional(v.string()),
      urgency: v.optional(
        v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
      ),
      summary: v.optional(v.string()),
    }),
    complete: v.boolean(),
    mode: v.string(),
    reason: v.string(),
    booking: v.optional(v.string()),
    owner: v.optional(v.string()),
    failed: v.boolean(),
  },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (
      !event ||
      event.status !== "processing" ||
      event.attempts !== args.attempt ||
      event.plannedAt ||
      !event.leadId ||
      !event.clerkId
    )
      return;
    const lead = await ctx.db.get(event.leadId);
    const a = await account(ctx, event.clerkId);
    if (!lead || !a) return;
    if (
      !(await sessionAllowsSending(
        ctx,
        a,
        event.recipient,
        event.demoSessionId,
      ))
    )
      return;
    if (event.demoSessionId && (args.complete || args.failed))
      await ctx.db.patch(event.demoSessionId, {
        state: "completed",
        terminationReason: args.failed ? "ai_failure" : "intake_complete",
        updatedAt: Date.now(),
      });
    const info = Object.fromEntries(
      Object.entries(args.info).filter(([, v]) => v !== undefined),
    );
    await ctx.db.patch(lead._id, {
      ...info,
      updatedAt: Date.now(),
      ...(args.complete || args.failed
        ? {
            conversationEnded: true,
            status:
              args.failed ||
              !(args.info.name || lead.name) ||
              !(args.info.location || lead.location) ||
              !(args.info.jobType || lead.jobType) ||
              !(args.info.urgency || lead.urgency)
                ? ("needs_followup" as const)
                : ("needs_contractor_review" as const),
            handoffModeUsed: args.mode,
            handoffReason: args.reason,
          }
        : { status: "qualifying" as const, conversationEnded: false }),
    });
    if (args.reply)
      await enqueueOutbound(ctx, event, "reply", event.recipient, args.reply);
    if (args.booking && !lead.bookingLinkSentAt)
      await enqueueOutbound(
        ctx,
        event,
        "booking",
        event.recipient,
        args.booking,
      );
    if (args.owner && !lead.userNotified && a.bookingDeliveryPhone)
      await enqueueOutbound(
        ctx,
        event,
        "owner",
        a.bookingDeliveryPhone,
        args.owner,
      );
    await ctx.db.patch(event._id, {
      plannedAt: Date.now(),
      ...(args.failed
        ? { error: "AI unavailable; contractor follow-up required" }
        : {}),
    });
  },
});
export const outbox = internalQuery({
  args: { eventId: v.id("automationEvents") },
  handler: (ctx, { eventId }) =>
    ctx.db
      .query("outboundMessages")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .collect(),
});
export const beginSend = internalMutation({
  args: { id: v.id("outboundMessages"), attempt: v.number() },
  handler: async (ctx, { id, attempt }) => {
    const sent = await ctx.db.get(id);
    if (!sent || sent.state !== "queued") return null;
    const event = await ctx.db.get(sent.eventId);
    if (!event || event.status !== "processing" || event.attempts !== attempt)
      return null;
    const a = await account(ctx, sent.clerkId);
    const cappedSession = sent.demoSessionId ? await ctx.db.get(sent.demoSessionId) : null;
    const keyword =
      sent.purpose === "keyword" &&
      a?.keywordHandling === "application" &&
      a.provisioningStatus === "ready";
    if (
      !a ||
      (isEventDemoAccount(a) && !keyword && !cappedSession?.eventDemo) ||
      a.telnyxPhoneNumber !== sent.from ||
      (!keyword &&
        (!(await sessionAllowsSending(ctx, a, sent.to, sent.demoSessionId)) ||
          !(await recipientEligible(ctx, a, sent.to)))) ||
      (Boolean(sent.demoSessionId) && sent.purpose === "owner") ||
      ((sent.purpose === "owner" || sent.purpose === "test") &&
        (!hasOwnerConsent(a) || sent.to !== a.bookingDeliveryPhone))
    ) {
      await ctx.db.patch(id, {
        state: "suppressed",
        error: "Account or consent no longer permits sending",
        updatedAt: Date.now(),
      });
      return null;
    }
    try {
      const demo = sent.demoSessionId ? await ctx.db.get(sent.demoSessionId) : null;
      if (demo?.eventDemo && !keyword) {
        const key = event.type === "demo.start" ? `${demo._id}:opening:${eventDemoDay()}` : `${sent._id}:sms`;
        if (!(await reserveDemoCost(ctx, demo._id, key, "sms"))) throw new Error("Demo budget exhausted");
      } else await reserve(ctx, sent.clerkId, {
        smsOutbound: 1,
        missedCallsSms:
          sent.purpose === "reply" && event.type === "call.initiated" ? 1 : 0,
        ownerNotifications: sent.purpose === "owner" ? 1 : 0,
      });
    } catch {
      await ctx.db.patch(id, {
        state: "failed",
        error: "SMS quota exhausted; operator review required",
        updatedAt: Date.now(),
      });
      return null;
    }
    await ctx.db.patch(id, { state: "sending", updatedAt: Date.now() });
    return { ...sent, messagingProfileId: a.messagingProfileId };
  },
});
async function applyDelivery(
  ctx: MutationCtx,
  sent: Doc<"outboundMessages">,
  incoming: string,
  at: number,
) {
  if (sent.receiptAt !== undefined && at < sent.receiptAt) return;
  const state = nextDeliveryState(sent.state, incoming);
  await ctx.db.patch(sent._id, { state, receiptAt: at, updatedAt: Date.now() });
  if (sent.leadId && state === "failed")
    await ctx.db.patch(sent.leadId, {
      status: "needs_followup",
      handoffReason: "SMS delivery failed; operator review required",
      updatedAt: Date.now(),
    });
  await settleDemoReset(ctx, sent.demoSessionId);
}
export const finishSend = internalMutation({
  args: {
    id: v.id("outboundMessages"),
    state: deliveryStatus,
    providerId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sent = await ctx.db.get(args.id);
    if (!sent) return;
    if (sent.state !== "sending") return;
    await ctx.db.patch(sent._id, {
      state: args.state,
      providerId: args.providerId,
      error: args.error,
      updatedAt: Date.now(),
    });
    const lead = sent.leadId ? await ctx.db.get(sent.leadId) : null;
    if (lead) {
      if (args.state === "accepted") {
        if (sent.purpose !== "owner")
          await ctx.db.insert("messages", {
            leadId: lead._id,
            userId: lead.userId,
            sender: "ai",
            content: sent.text,
            telnyxMessageId: args.providerId,
            createdAt: Date.now(),
          });
        if (sent.purpose === "reply")
          await ctx.db.patch(lead._id, {
            aiResponseCount: (lead.aiResponseCount ?? 0) + 1,
            updatedAt: Date.now(),
          });
        if (sent.purpose === "booking")
          await ctx.db.patch(lead._id, {
            bookingLinkSentAt: Date.now(),
            bookingUrlSent: sent.text.match(/https:\/\/\S+/)?.[0],
            status: "booking_link_sent",
            updatedAt: Date.now(),
          });
        if (sent.purpose === "owner")
          await ctx.db.patch(lead._id, {
            userNotified: true,
            contractorReviewSentAt: Date.now(),
            notifiedAt: Date.now(),
          });
      } else
        await ctx.db.patch(lead._id, {
          status: "needs_followup",
          handoffReason: args.error ?? "SMS requires operator review",
          updatedAt: Date.now(),
        });
    }
    await settleDemoReset(ctx, sent.demoSessionId);
    if (args.providerId) {
      const receipt = await ctx.db
        .query("deliveryReceipts")
        .withIndex("by_provider", (q) => q.eq("providerId", args.providerId!))
        .unique();
      if (receipt)
        await applyDelivery(
          ctx,
          { ...sent, state: args.state },
          receipt.status,
          receipt.occurredAt,
        );
    }
  },
});
export const finish = internalMutation({
  args: {
    eventId: v.id("automationEvents"),
    attempt: v.number(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { eventId, attempt, error }) => {
    const event = await ctx.db.get(eventId);
    if (!event || event.attempts !== attempt) return;
    if (event.status === "ignored") {
      await ctx.scheduler.runAfter(0, internal.automationActions.process, {
        conversationKey: event.conversationKey,
      });
      return;
    }
    if (event.status !== "processing") return;
    const sends = await ctx.db
      .query("outboundMessages")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .collect();
    const uncertain = sends.some((s) =>
      ["uncertain", "sending", "failed", "suppressed"].includes(s.state),
    );
    const retry = Boolean(error) && !uncertain && event.attempts < 3;
    const delay = [5000, 30000, 120000][Math.max(0, event.attempts - 1)];
    await ctx.db.patch(eventId, {
      status: retry ? "queued" : error || uncertain ? "failed" : "completed",
      error:
        error ?? (uncertain ? "Outbound message requires review" : event.error),
      nextAttemptAt: retry ? Date.now() + delay : undefined,
    });
    if (!retry && (error || uncertain) && event.leadId)
      await ctx.db.patch(event.leadId, {
        status: "needs_followup",
        updatedAt: Date.now(),
      });
    await ctx.scheduler.runAfter(
      retry ? delay : 0,
      internal.automationActions.process,
      { conversationKey: event.conversationKey },
    );
  },
});
export const recover = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const event of await ctx.db
      .query("automationEvents")
      .withIndex("by_status", (q) => q.eq("status", "processing"))
      .take(100)) {
      if ((event.startedAt ?? 0) > Date.now() - 120000) continue;
      const sends = await ctx.db
        .query("outboundMessages")
        .withIndex("by_event", (q) => q.eq("eventId", event._id))
        .collect();
      for (const sent of sends)
        if (sent.state === "sending")
          await ctx.db.patch(sent._id, {
            state: "uncertain",
            error:
              "Worker stopped during submission; reconcile before resending",
            updatedAt: Date.now(),
          });
      const uncertain = sends.some(
        (s) => s.state === "sending" || s.state === "uncertain",
      );
      await ctx.db.patch(event._id, {
        status: uncertain || event.attempts >= 3 ? "failed" : "queued",
        error: "Worker interrupted",
      });
      if (event.leadId)
        await ctx.db.patch(event.leadId, {
          status: "needs_followup",
          updatedAt: Date.now(),
        });
      await ctx.scheduler.runAfter(0, internal.automationActions.process, {
        conversationKey: event.conversationKey,
      });
    }
    for (const event of await ctx.db
      .query("automationEvents")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .take(100))
      if ((event.nextAttemptAt ?? 0) <= Date.now())
        await ctx.scheduler.runAfter(0, internal.automationActions.process, {
          conversationKey: event.conversationKey,
        });
  },
});

export const requestTest = mutation({
  args: { kind: v.union(v.literal("test"), v.literal("demo")) },
  handler: async (ctx, { kind }) => {
    if (kind === "demo")
      throw new ConvexError("Use the updated Demo page to start a fresh test.");
    const clerkId = await requireAuthenticatedClerkId(ctx);
    const a = await account(ctx, clerkId);
    if (
      !a ||
      !a.bookingDeliveryPhone ||
      !hasOwnerConsent(a) ||
      !(await sessionAllowsSending(ctx, a, a.bookingDeliveryPhone))
    )
      throw new Error(
        "Operator activation and current SMS permission are required",
      );
    const recent = await ctx.db
      .query("automationEvents")
      .withIndex("by_account", (q) => q.eq("clerkId", clerkId))
      .filter((q) =>
        q.and(
          q.eq(q.field("type"), "test"),
          q.gt(q.field("receivedAt"), Date.now() - 3600000),
        ),
      )
      .take(3);
    if (recent.length >= 3)
      throw new Error("Test limit reached; try again in an hour");
    const id = await ctx.db.insert("automationEvents", {
      eventId: crypto.randomUUID(),
      conversationKey: `${a.telnyxPhoneNumber}:${a.bookingDeliveryPhone}`,
      clerkId,
      type: "test",
      sender: a.telnyxPhoneNumber!,
      recipient: a.bookingDeliveryPhone,
      providerId: "",
      text: "",
      occurredAt: Date.now(),
      receivedAt: Date.now(),
      status: "queued",
      attempts: 0,
      plannedAt: Date.now(),
    });
    const event = await ctx.db.get(id);
    await enqueueOutbound(
      ctx,
      event!,
      "test",
      a.bookingDeliveryPhone,
      buildTestSmsMessage(a.telnyxPhoneNumber!),
    );
    await ctx.scheduler.runAfter(0, internal.automationActions.process, {
      conversationKey: event!.conversationKey,
    });
    return {
      success: true,
      eventId: id,
      message:
        "Message queued. Check delivery status before treating the test as successful.",
    };
  },
});
export const failures = query({
  args: {},
  handler: async (ctx) => {
    await requireOpsAdmin(ctx);
    const events = await ctx.db
      .query("automationEvents")
      .withIndex("by_status", (q) => q.eq("status", "failed"))
      .order("desc")
      .take(30);
    const messages = (
      await Promise.all(
        ["failed", "uncertain"].map((state) =>
          ctx.db
            .query("outboundMessages")
            .withIndex("by_state", (q) =>
              q.eq("state", state as "failed" | "uncertain"),
            )
            .order("desc")
            .take(30),
        ),
      )
    ).flat();
    const stalled = (
      await Promise.all(
        (["queued", "processing"] as const).map((status) =>
          ctx.db
            .query("automationEvents")
            .withIndex("by_status", (q) => q.eq("status", status))
            .filter((q) => q.lt(q.field("receivedAt"), Date.now() - 120000))
            .take(30),
        ),
      )
    ).flat();
    const pending = await ctx.db
      .query("outboundMessages")
      .withIndex("by_state", (q) => q.eq("state", "accepted"))
      .filter((q) => q.lt(q.field("updatedAt"), Date.now() - 300000))
      .take(30);
    return {
      stalled: stalled.map((e) => ({
        _id: e._id,
        status: e.status,
        receivedAt: e.receivedAt,
      })),
      pending: pending.map((m) => ({
        _id: m._id,
        providerId: m.providerId,
        state: m.state,
        error: m.error,
      })),
      events: events.map(({ _id, clerkId, error, receivedAt }) => ({
        _id,
        clerkId,
        error,
        receivedAt,
      })),
      messages: messages.map(
        ({ _id, clerkId, state, error, providerId, updatedAt }) => ({
          _id,
          clerkId,
          state,
          error,
          providerId,
          updatedAt,
        }),
      ),
    };
  },
});

export const reconcile = internalMutation({
  args: {
    id: v.id("outboundMessages"),
    providerId: v.string(),
    sender: v.string(),
    recipient: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const sent = await ctx.db.get(args.id);
    if (!sent || sent.from !== args.sender || sent.to !== args.recipient)
      throw new Error(
        "Provider message does not match the selected conversation",
      );
    if (sent.providerId && sent.providerId !== args.providerId)
      throw new Error("A different provider message is already recorded");
    const duplicate = await ctx.db
      .query("outboundMessages")
      .withIndex("by_provider", (q) => q.eq("providerId", args.providerId))
      .unique();
    if (duplicate && duplicate._id !== sent._id)
      throw new Error(
        "Provider message is already attached to another submission",
      );
    if (!["uncertain", "accepted", "failed"].includes(sent.state))
      throw new Error("Message does not require reconciliation");
    await ctx.db.patch(sent._id, { providerId: args.providerId });
    await applyDelivery(
      ctx,
      { ...sent, state: sent.state === "uncertain" ? "accepted" : sent.state },
      args.status,
      Date.now(),
    );
  },
});
export const retryEvent = mutation({
  args: { id: v.id("automationEvents") },
  handler: async (ctx, { id }) => {
    await requireOpsAdmin(ctx);
    const event = await ctx.db.get(id);
    if (!event || event.status !== "failed")
      throw new Error("Select a failed event");
    if (event.demoSessionId) {
      const session = await ctx.db.get(event.demoSessionId);
      if (!session || ["resetting", "archived"].includes(session.state))
        throw new ConvexError("This test was reset. Start a new test instead.");
    }
    const messages = await ctx.db
      .query("outboundMessages")
      .withIndex("by_event", (q) => q.eq("eventId", id))
      .collect();
    if (messages.some((m) => m.state === "uncertain" || m.state === "sending"))
      throw new Error("Reconcile the uncertain submission in Telnyx first");
    for (const message of messages)
      if (message.state === "failed")
        await ctx.db.patch(message._id, {
          state: "queued",
          providerId: undefined,
          receiptAt: undefined,
          error: undefined,
          updatedAt: Date.now(),
        });
    await ctx.db.patch(id, {
      status: "queued",
      attempts: 0,
      nextAttemptAt: undefined,
      error: undefined,
    });
    await ctx.scheduler.runAfter(0, internal.automationActions.process, {
      conversationKey: event.conversationKey,
    });
  },
});
