import { ConvexError, v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { requireOpsAdmin } from "./authHelpers.util";
import { readinessBlockers, phoneSchema } from "../lib/automation-policy";
import { conciergeBlockers } from "../lib/concierge";

export const accounts = query({
  args: {},
  handler: async (ctx) => {
    await requireOpsAdmin(ctx);
    return (await ctx.db.query("onboarding").take(100)).map((a) => ({
      ...a,
      blockers: readinessBlockers(a),
    }));
  },
});
export const saveEvidence = mutation({
  args: {
    clerkId: v.string(),
    campaignId: v.string(),
    providerEvidence: v.string(),
    forwardingEvidence: v.string(),
    rehearsalEvidence: v.string(),
    keywordHandling: v.union(v.literal("telnyx"), v.literal("application")),
    approved: v.boolean(),
    isDemoAccount: v.boolean(),
  },
  handler: async (ctx, args) => {
    const operator = await requireOpsAdmin(ctx);
    const a = await ctx.db
      .query("onboarding")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();
    if (!a) throw new Error("Account not found");
    for (const value of [
      args.providerEvidence,
      args.forwardingEvidence,
      args.rehearsalEvidence,
    ])
      if (value.length > 4000) throw new Error("Evidence too long");
    if (
      args.approved &&
      (!args.campaignId.trim() || !args.providerEvidence.trim())
    )
      throw new Error(
        "Record the provider campaign ID and approval evidence first",
      );
    await ctx.db.patch(a._id, {
      campaignId: args.campaignId.trim(),
      providerEvidence: args.providerEvidence.trim(),
      forwardingEvidence: args.forwardingEvidence.trim(),
      rehearsalEvidence: args.rehearsalEvidence.trim(),
      keywordHandling: args.keywordHandling,
      isDemoAccount: args.isDemoAccount,
      verificationStatus: args.approved ? "approved" : "pending",
      campaignStatus: args.approved ? "approved" : "pending",
      activationMode: "paused",
      evidenceUpdatedAt: Date.now(),
      evidenceUpdatedBy: operator,
      updatedAt: Date.now(),
    });
  },
});
export const activate = mutation({
  args: {
    clerkId: v.string(),
    mode: v.union(
      v.literal("paused"),
      v.literal("rehearsal"),
      v.literal("live"),
    ),
  },
  handler: async (ctx, { clerkId, mode }) => {
    await requireOpsAdmin(ctx);
    const a = await ctx.db
      .query("onboarding")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();
    if (!a) throw new Error("Account not found");
    if (mode !== "paused") {
      const errors = readinessBlockers(a, mode === "live");
      if (errors.length) throw new ConvexError(errors.join(". "));
      if (mode === "live") {
        const concierge = await ctx.db.query("onboardingConcierge").withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId)).unique();
        if (concierge && conciergeBlockers(concierge.checklist).length)
          throw new ConvexError(`Complete concierge setup: ${conciergeBlockers(concierge.checklist).join(", ")}`);
        const deliveries = await ctx.db
          .query("outboundMessages")
          .withIndex("by_account", (q) => q.eq("clerkId", clerkId))
          .filter((q) => q.eq(q.field("state"), "delivered"))
          .collect();
        const current = deliveries.filter(
          (d) =>
            !d.demoSessionId && d.from === a.telnyxPhoneNumber &&
            d.createdAt >= (a.telnyxProvisionedAt ?? 0),
        );
        const rehearsed = new Set(
          current
            .filter(
              (d) =>
                d.purpose === "reply" &&
                d.leadId &&
                current.some(
                  (h) =>
                    h.leadId === d.leadId &&
                    (h.purpose === "owner" || h.purpose === "booking"),
                ),
            )
            .map((d) => d.leadId),
        );
        if (rehearsed.size < 3)
          throw new ConvexError(
            "Verify three separate conversations with delivered replies and delivered handoffs before live activation",
          );
      }
    }
    await ctx.db.patch(a._id, { activationMode: mode, updatedAt: Date.now() });
  },
});
export const reserveAssignment = internalMutation({
  args: {
    clerkId: v.string(),
    phoneNumber: v.string(),
    phoneNumberId: v.string(),
    profileId: v.string(),
    voiceId: v.string(),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    phoneSchema.parse(args.phoneNumber);
    const a = await ctx.db
      .query("onboarding")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();
    if (!a) throw new Error("Account not found");
    const assigned = await ctx.db
      .query("onboarding")
      .withIndex("by_telnyx_phone", (q) =>
        q.eq("telnyxPhoneNumber", args.phoneNumber),
      )
      .collect();
    if (assigned.some((other) => other._id !== a._id))
      throw new Error("Number already assigned to another account");
    if (a.telnyxPhoneNumber && a.telnyxPhoneNumber !== args.phoneNumber)
      throw new Error("Existing number must be reviewed before reassignment");
    if (a.provisioningStatus === "pending" && a.updatedAt > Date.now() - 120000)
      throw new Error("Assignment already in progress");
    await ctx.db.patch(a._id, {
      telnyxPhoneNumber: args.phoneNumber,
      telnyxPhoneNumberId: args.phoneNumberId,
      messagingProfileId: args.profileId,
      voiceApplicationId: args.voiceId,
      assignmentToken: args.token,
      provisioningStatus: "pending",
      activationMode: "paused",
      providerEvidence: undefined,
      forwardingEvidence: undefined,
      rehearsalEvidence: undefined,
      updatedAt: Date.now(),
    });
  },
});
export const finishAssignment = internalMutation({
  args: { clerkId: v.string(), token: v.string(), success: v.boolean() },
  handler: async (ctx, args) => {
    const a = await ctx.db
      .query("onboarding")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();
    if (!a || a.assignmentToken !== args.token)
      throw new Error("Assignment changed during verification");
    await ctx.db.patch(a._id, {
      provisioningStatus: args.success ? "ready" : "failed",
      assignmentToken: undefined,
      telnyxProvisionedAt: args.success ? Date.now() : a.telnyxProvisionedAt,
      updatedAt: Date.now(),
    });
  },
});
export const seedDemo = mutation({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    await requireOpsAdmin(ctx);
    const a = await ctx.db
      .query("onboarding")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();
    if (!a?.isDemoAccount)
      throw new Error("Select the designated demo account first");
    if (!a.bookingLink)
      throw new Error("Configure the demo Calendly link first");
    const scenarios = [
      {
        key: "review",
        name: "Alex Morgan",
        jobType: "Leak repair",
        urgency: "medium" as const,
        status: "needs_contractor_review" as const,
        mode: "review_first",
        reason: "Contractor reviews the leak details before scheduling.",
      },
      {
        key: "booking",
        name: "Jordan Lee",
        jobType: "Shingle inspection",
        urgency: "low" as const,
        status: "booking_link_sent" as const,
        mode: "booking_link",
        reason: "Qualified inspection; sample booking link sent.",
      },
      {
        key: "both",
        name: "Casey Taylor",
        jobType: "Storm damage",
        urgency: "medium" as const,
        status: "booking_link_sent" as const,
        mode: "review_and_booking",
        reason: "Sample owner alert and booking handoff.",
      },
      {
        key: "emergency",
        name: "Sam Rivera",
        jobType: "Active water intrusion",
        urgency: "high" as const,
        status: "needs_contractor_review" as const,
        mode: "emergency_escalation",
        reason: "Urgent contractor review; no arrival-time promise.",
      },
    ];
    const samples = await ctx.db
      .query("leads")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .filter((q) => q.neq(q.field("sampleKey"), undefined))
      .collect();
    for (const old of samples) {
      for (const message of await ctx.db
        .query("messages")
        .withIndex("by_lead_id", (q) => q.eq("leadId", old._id))
        .collect())
        await ctx.db.delete(message._id);
      await ctx.db.delete(old._id);
    }
    for (const [i, s] of scenarios.entries()) {
      const now = Date.now();
      const booking = s.status === "booking_link_sent";
      const leadId = await ctx.db.insert("leads", {
        userId: a.userId,
        clerkId,
        sampleKey: s.key,
        phoneNumber: `+1202555010${i}`,
        name: s.name,
        jobType: s.jobType,
        location: "Phoenix, AZ",
        urgency: s.urgency,
        summary: `Sample scenario: ${s.reason}`,
        status: s.status,
        channel: "call",
        userNotified: s.key !== "booking",
        handoffModeUsed: s.mode,
        handoffReason: s.reason,
        conversationEnded: true,
        createdAt: now - i,
        updatedAt: now,
        ...(booking
          ? { bookingUrlSent: a.bookingLink, bookingLinkSentAt: now }
          : {}),
      });
      for (const [j, content] of [
        `[Sample missed call] ${s.jobType} in Phoenix.`,
        "What is the property location and your name?",
        `I'm ${s.name}, in Phoenix.`,
        booking
          ? `Sample booking link: ${a.bookingLink}`
          : "The roofing team will review these details.",
      ].entries())
        await ctx.db.insert("messages", {
          leadId,
          userId: a.userId,
          sender: j % 2 === 0 ? "lead" : "ai",
          content,
          createdAt: now + j,
        });
    }
    return { created: 4 };
  },
});
export const deliveryForViewer = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const messages = await ctx.db
      .query("outboundMessages")
      .withIndex("by_account", (q) => q.eq("clerkId", identity.subject))
      .order("desc")
      .take(10);
    return messages.map(({ _id, state, purpose, createdAt, error }) => ({
      _id,
      state,
      purpose,
      createdAt,
      error,
    }));
  },
});

export const configureDemo = mutation({
  args: { clerkId: v.string(), bookingLink: v.string() },
  handler: async (ctx, { clerkId, bookingLink }) => {
    await requireOpsAdmin(ctx);
    const link = new URL(bookingLink);
    if (
      link.protocol !== "https:" ||
      !["calendly.com", "www.calendly.com"].includes(link.hostname) ||
      link.username ||
      link.password
    )
      throw new Error("Use the verified Calendly demo link");
    const a = await ctx.db
      .query("onboarding")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();
    if (!a) throw new Error("Account not found");
    await ctx.db.patch(a._id, {
      isDemoAccount: true,
      legalBusinessName: "Desert Ridge Roofing — demo",
      bookingLink,
      bookingLinkLabel: "Open demo booking page",
      leadHandoffMode: "review_and_booking",
      serviceAreas: [
        { type: "city", value: "Phoenix" },
        { type: "city", value: "Scottsdale" },
        { type: "city", value: "Mesa" },
      ],
      preferredJobTypes: [
        "leak_repairs",
        "storm_damage",
        "emergency_tarping",
        "insurance_jobs",
      ],
      collectPhotosFirst: false,
      activationMode: "paused",
      forwardingEvidence: undefined,
      rehearsalEvidence: undefined,
      updatedAt: Date.now(),
    });
  },
});
