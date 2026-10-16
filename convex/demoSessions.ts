import { admitEventDemo, isEventDemoAccount } from "./eventDemoPolicy.util";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireOpsAdmin } from "./authHelpers.util";
import { phoneSchema, readinessBlockers } from "../lib/automation-policy";
import {
  demoConsentReference,
  settleDemoReset,
} from "./demoSessionPolicy.util";

export const start = mutation({
  args: {
    clerkId: v.string(),
    businessName: v.string(),
    recipient: v.string(),
    bookingEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const operatorId = await requireOpsAdmin(ctx);
    const a = await ctx.db
      .query("onboarding")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();
    if (!a?.isDemoAccount)
      throw new ConvexError("Select the designated demo account.");
    const blockers = readinessBlockers(a, false);
    if (!a.activationMode || a.activationMode === "paused")
      blockers.unshift("Enable rehearsal in the operator screen");
    if (blockers.length) throw new ConvexError(blockers.join(". "));
    const businessName = args.businessName.trim();
    if (
      !businessName ||
      businessName.length > 60 ||
      /[\r\n<>]|https?:|\+\d{7}/i.test(businessName)
    )
      throw new ConvexError(
        "Enter a business name of 1–60 characters, without links or phone numbers.",
      );
    if (!phoneSchema.safeParse(args.recipient).success)
      throw new ConvexError(
        "Enter a phone number with its country code, such as +1.",
      );
    const consentReference = await demoConsentReference(ctx, a, args.recipient);
    if (!consentReference)
      throw new ConvexError(
        "This phone needs current demo SMS consent and must not be opted out.",
      );
    if (isEventDemoAccount(a)) {
      const result = await admitEventDemo(ctx, a, args.recipient, `operator:${crypto.randomUUID()}`, "operator");
      if (!result.ok) throw new ConvexError(result.message);
      if (result.status === "queued") {
        await ctx.db.insert("automationEvents", {
          eventId: crypto.randomUUID(), conversationKey: `${a.telnyxPhoneNumber}:${args.recipient}`,
          clerkId: a.clerkId, demoSessionId: result.sessionId, leadId: result.leadId,
          type: "demo.start", sender: a.telnyxPhoneNumber!, recipient: args.recipient, providerId: "", text: "",
          occurredAt: Date.now(), receivedAt: Date.now(), status: "queued", attempts: 0,
        });
        await ctx.scheduler.runAfter(0, internal.automationActions.process, { conversationKey: `${a.telnyxPhoneNumber}:${args.recipient}` });
      }
      return { sessionId: result.sessionId, state: "queued" as const };
    }
    const previous = await ctx.db
      .query("demoSessions")
      .withIndex("by_pair", (q) =>
        q.eq("sender", a.telnyxPhoneNumber!).eq("recipient", args.recipient),
      )
      .order("desc")
      .first();
    if (previous && previous.state !== "archived")
      throw new ConvexError(
        previous.state === "resetting"
          ? "The previous test is finishing. Wait for delivery or resolve it in the operator screen."
          : "A test already exists for this phone. Open it or choose Start over first.",
      );
    const now = Date.now();
    const recent = await ctx.db
      .query("demoSessions")
      .withIndex("by_account", (q) =>
        q.eq("clerkId", args.clerkId).gt("createdAt", now - 3600000),
      )
      .collect();
    const pairRecent = recent.filter((s) => s.recipient === args.recipient);
    const limited =
      pairRecent.length >= 3 ? pairRecent : recent.length >= 12 ? recent : null;
    if (limited)
      throw new ConvexError(
        `Test limit reached. Try again at ${new Date(limited[0].createdAt + 3600000).toISOString()}.`,
      );
    if (args.bookingEnabled && !a.bookingLink)
      throw new ConvexError(
        "Add a verified demo booking link in Settings first.",
      );
    const sessionId = await ctx.db.insert("demoSessions", {
      clerkId: args.clerkId,
      operatorId,
      sender: a.telnyxPhoneNumber!,
      recipient: args.recipient,
      businessName,
      consentReference,
      state: "active",
      bookingEnabled: args.bookingEnabled === true,
      bookingLink: args.bookingEnabled ? a.bookingLink : undefined,
      bookingLinkLabel: args.bookingEnabled ? a.bookingLinkLabel : undefined,
      createdAt: now,
      updatedAt: now,
    });
    const leadId = await ctx.db.insert("leads", {
      userId: a.userId,
      clerkId: a.clerkId,
      demoSessionId: sessionId,
      phoneNumber: args.recipient,
      channel: "sms",
      status: "new",
      userNotified: false,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(sessionId, { leadId });
    await ctx.db.insert("automationEvents", {
      eventId: crypto.randomUUID(),
      conversationKey: `${a.telnyxPhoneNumber}:${args.recipient}`,
      clerkId: a.clerkId,
      demoSessionId: sessionId,
      leadId,
      type: "demo.start",
      sender: a.telnyxPhoneNumber!,
      recipient: args.recipient,
      providerId: "",
      text: "",
      occurredAt: now,
      receivedAt: now,
      status: "queued",
      attempts: 0,
    });
    await ctx.scheduler.runAfter(0, internal.automationActions.process, {
      conversationKey: `${a.telnyxPhoneNumber}:${args.recipient}`,
    });
    return { sessionId, state: "queued" as const };
  },
});

export const reset = mutation({
  args: { sessionId: v.id("demoSessions") },
  handler: async (ctx, { sessionId }) => {
    await requireOpsAdmin(ctx);
    const session = await ctx.db.get(sessionId);
    if (!session) throw new ConvexError("Test not found.");
    if (session.state === "archived") return { state: "archived" as const };
    await ctx.db.patch(sessionId, {
      state: "resetting",
      updatedAt: Date.now(),
    });
    const events = await ctx.db
      .query("automationEvents")
      .withIndex("by_session", (q) => q.eq("demoSessionId", sessionId))
      .collect();
    for (const event of events)
      if (event.status === "queued")
        await ctx.db.patch(event._id, {
          status: "ignored",
          error: "Test reset by operator",
        });
    const messages = await ctx.db
      .query("outboundMessages")
      .withIndex("by_session", (q) => q.eq("demoSessionId", sessionId))
      .collect();
    for (const message of messages)
      if (message.state === "queued")
        await ctx.db.patch(message._id, {
          state: "suppressed",
          error: "Test reset by operator",
          updatedAt: Date.now(),
        });
    await settleDemoReset(ctx, sessionId);
    await ctx.scheduler.runAfter(0, internal.automationActions.process, {
      conversationKey: `${session.sender}:${session.recipient}`,
    });
    return { state: (await ctx.db.get(sessionId))!.state };
  },
});

export const inspect = query({
  args: { clerkId: v.string(), recipient: v.string() },
  handler: async (ctx, { clerkId, recipient }) => {
    await requireOpsAdmin(ctx);
    const a = await ctx.db
      .query("onboarding")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();
    if (!a?.isDemoAccount || !a.telnyxPhoneNumber) return null;
    const session = await ctx.db
      .query("demoSessions")
      .withIndex("by_pair", (q) =>
        q.eq("sender", a.telnyxPhoneNumber!).eq("recipient", recipient),
      )
      .order("desc")
      .first();
    const consentReady = Boolean(await demoConsentReference(ctx, a, recipient));
    if (!session || session.state === "archived")
      return { session: null, consentReady, messages: [], lead: null };
    if (session.state === "resetting")
      return { session, consentReady, messages: [], lead: null };
    const lead = session.leadId ? await ctx.db.get(session.leadId) : null;
    const incoming = lead
      ? await ctx.db
          .query("messages")
          .withIndex("by_lead_id", (q) => q.eq("leadId", lead._id))
          .collect()
      : [];
    const outgoing = await ctx.db
      .query("outboundMessages")
      .withIndex("by_session", (q) => q.eq("demoSessionId", session._id))
      .collect();
    return {
      session,
      consentReady,
      lead,
      messages: [
        ...incoming
          .filter((m) => m.sender === "lead")
          .map((m) => ({
            _id: String(m._id),
            sender: "lead" as const,
            content: m.content,
            createdAt: m.createdAt,
            delivery: undefined,
          })),
        ...outgoing
          .filter((m) => m.purpose !== "owner" && m.purpose !== "keyword")
          .map((m) => ({
            _id: String(m._id),
            sender: "ai" as const,
            content: m.text,
            createdAt: m.createdAt,
            delivery: m.state,
          })),
      ].sort((a, b) => a.createdAt - b.createdAt),
    };
  },
});
