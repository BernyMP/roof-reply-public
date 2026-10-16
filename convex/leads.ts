import { needsAction, isRealLead } from "../lib/lead-presentation";
import { v } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { requireAuthenticatedClerkId } from "./authHelpers.util";

// Create a new lead from incoming call/SMS
export const createLead = internalMutation({
  args: {
    clerkId: v.string(),
    phoneNumber: v.string(),
    channel: v.union(v.literal("call"), v.literal("sms")),
    initialMessage: v.optional(v.string()),
    initialMessageTelnyxId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) throw new Error("User not found");

    // Check if we already have a lead from this phone number for this user
    const existingLead = await ctx.db
      .query("leads")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", args.phoneNumber))
      .filter((q) => q.eq(q.field("userId"), user._id))
      .first();

    if (existingLead) {
      // Add new message to existing conversation
      if (args.initialMessage) {
        await ctx.db.insert("messages", {
          leadId: existingLead._id,
          userId: user._id,
          sender: "lead",
          content: args.initialMessage,
          telnyxMessageId: args.initialMessageTelnyxId,
          createdAt: Date.now(),
        });
      }
      return existingLead._id;
    }

    const now = Date.now();
    const leadId = await ctx.db.insert("leads", {
      userId: user._id,
      clerkId: args.clerkId,
      phoneNumber: args.phoneNumber,
      channel: args.channel,
      status: "new",
      userNotified: false,
      createdAt: now,
      updatedAt: now,
    });

    // Add initial message if provided
    if (args.initialMessage) {
      await ctx.db.insert("messages", {
        leadId,
        userId: user._id,
        sender: "lead",
        content: args.initialMessage,
        telnyxMessageId: args.initialMessageTelnyxId,
        createdAt: now,
      });
    }

    return leadId;
  },
});

// Add a message to a lead conversation
export const addMessage = internalMutation({
  args: {
    leadId: v.id("leads"),
    sender: v.union(v.literal("lead"), v.literal("ai")),
    content: v.string(),
    telnyxMessageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const lead = await ctx.db.get(args.leadId);
    if (!lead) throw new Error("Lead not found");

    const messageId = await ctx.db.insert("messages", {
      leadId: args.leadId,
      userId: lead.userId,
      sender: args.sender,
      content: args.content,
      telnyxMessageId: args.telnyxMessageId,
      createdAt: Date.now(),
    });

    // Update lead
    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    // Update status to qualifying if it was new
    if (lead.status === "new") {
      updates.status = "qualifying";
    }

    // Increment AI response count
    if (args.sender === "ai") {
      updates.aiResponseCount = (lead.aiResponseCount || 0) + 1;
    }

    await ctx.db.patch(args.leadId, updates);

    return messageId;
  },
});

// Update lead with qualified information
export const updateLeadInfo = internalMutation({
  args: {
    leadId: v.id("leads"),
    name: v.optional(v.string()),
    jobType: v.optional(v.string()),
    location: v.optional(v.string()),
    urgency: v.optional(
      v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    ),
    summary: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("new"),
        v.literal("qualifying"),
        v.literal("qualified"),
        v.literal("not_qualified"),
        v.literal("needs_followup"),
        v.literal("booking_link_sent"),
        v.literal("needs_contractor_review"),
        v.literal("appointment_booked"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const { leadId, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined),
    );

    await ctx.db.patch(leadId, {
      ...filteredUpdates,
      updatedAt: Date.now(),
    });
  },
});

export const markLeadHandoff = internalMutation({
  args: {
    leadId: v.id("leads"),
    status: v.union(
      v.literal("qualified"),
      v.literal("needs_followup"),
      v.literal("booking_link_sent"),
      v.literal("needs_contractor_review"),
    ),
    handoffModeUsed: v.string(),
    handoffReason: v.optional(v.string()),
    bookingUrlSent: v.optional(v.string()),
    bookingLinkSentAt: v.optional(v.number()),
    contractorReviewSentAt: v.optional(v.number()),
    userNotified: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { leadId, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined),
    );

    const notificationUpdate = args.userNotified
      ? { notifiedAt: Date.now() }
      : {};

    await ctx.db.patch(leadId, {
      ...filteredUpdates,
      ...notificationUpdate,
      updatedAt: Date.now(),
    });
  },
});

export const updateLeadStatusForViewer = mutation({
  args: {
    clerkId: v.string(),
    leadId: v.id("leads"),
    status: v.union(
      v.literal("new"),
      v.literal("qualifying"),
      v.literal("qualified"),
      v.literal("not_qualified"),
      v.literal("needs_followup"),
      v.literal("booking_link_sent"),
      v.literal("needs_contractor_review"),
      v.literal("appointment_booked"),
    ),
  },
  handler: async (ctx, args) => {
    await requireAuthenticatedClerkId(ctx, args.clerkId);

    const lead = await ctx.db.get(args.leadId);
    if (!lead) throw new Error("Lead not found");
    if (lead.clerkId !== args.clerkId) throw new Error("Forbidden");

    await ctx.db.patch(args.leadId, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

export const resetLeadConversationForViewer = mutation({
  args: {
    clerkId: v.string(),
    leadId: v.id("leads"),
  },
  handler: async (ctx, args) => {
    await requireAuthenticatedClerkId(ctx, args.clerkId);

    const lead = await ctx.db.get(args.leadId);
    if (!lead) throw new Error("Lead not found");
    if (lead.clerkId !== args.clerkId) throw new Error("Forbidden");
    if (!lead.sampleKey)
      throw new Error(
        "Only sample conversations can be reset. Real leads are retained.",
      );

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_lead_id", (q) => q.eq("leadId", args.leadId))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    await ctx.db.replace(args.leadId, {
      userId: lead.userId,
      clerkId: lead.clerkId,
      phoneNumber: lead.phoneNumber,
      channel: lead.channel,
      status: "new",
      userNotified: false,
      aiResponseCount: 0,
      conversationEnded: false,
      sampleKey: lead.sampleKey,
      createdAt: lead.createdAt,
      updatedAt: Date.now(),
    });
  },
});

// Mark lead as notified (user received SMS summary)
export const markLeadNotified = internalMutation({
  args: { leadId: v.id("leads") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.leadId, {
      userNotified: true,
      notifiedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// Mark conversation as ended (AI limit reached)
export const markConversationEnded = internalMutation({
  args: { leadId: v.id("leads") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.leadId, {
      conversationEnded: true,
      status: "needs_followup",
      updatedAt: Date.now(),
    });
  },
});

// Get all leads for a user
export const getLeads = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    await requireAuthenticatedClerkId(ctx, args.clerkId);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) return [];

    const leads = await ctx.db
      .query("leads")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    return leads
      .filter((l) => !l.demoSessionId)
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Get lead by ID with messages for the signed-in viewer
export const getLeadWithMessagesForViewer = query({
  args: { leadId: v.id("leads") },
  handler: async (ctx, args) => {
    const viewerClerkId = await requireAuthenticatedClerkId(ctx);
    const lead = await ctx.db.get(args.leadId);
    if (!lead) return null;
    if (lead.clerkId !== viewerClerkId) return null;

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_lead_id", (q) => q.eq("leadId", args.leadId))
      .order("asc")
      .collect();

    const outbox = await ctx.db
      .query("outboundMessages")
      .withIndex("by_lead", (q) => q.eq("leadId", lead._id))
      .collect();
    const homeownerMessages = outbox.filter(
      (m) => m.purpose !== "owner" && m.purpose !== "keyword",
    );
    const tracked = new Set(
      homeownerMessages.map((m) => m.providerId).filter(Boolean),
    );
    return {
      ...lead,
      messages: [
        ...messages
          .filter(
            (m) =>
              m.sender === "lead" ||
              !m.telnyxMessageId ||
              !tracked.has(m.telnyxMessageId),
          )
          .map((m) => ({ ...m, delivery: undefined })),
        ...homeownerMessages.map((m) => ({
          _id: m._id,
          sender: "ai" as const,
          content: m.text,
          createdAt: m.createdAt,
          delivery: m.state,
        })),
      ].sort((a, b) => a.createdAt - b.createdAt),
    };
  },
});

// Get lead by ID with messages for server-side webhook processing
export const getLeadWithMessages = internalQuery({
  args: { leadId: v.id("leads") },
  handler: async (ctx, args) => {
    const lead = await ctx.db.get(args.leadId);
    if (!lead) return null;

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_lead_id", (q) => q.eq("leadId", args.leadId))
      .order("asc")
      .collect();

    return { ...lead, messages };
  },
});

// Get lead by phone number for a specific user
export const getLeadByPhone = query({
  args: {
    clerkId: v.string(),
    phoneNumber: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuthenticatedClerkId(ctx, args.clerkId);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) return null;

    const lead = await ctx.db
      .query("leads")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", args.phoneNumber))
      .filter((q) => q.eq(q.field("userId"), user._id))
      .first();

    if (!lead) return null;

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_lead_id", (q) => q.eq("leadId", lead._id))
      .order("asc")
      .collect();

    return { ...lead, messages };
  },
});

// Check whether an inbound Telnyx message was already processed (webhook retry dedup)
export const getMessageByTelnyxId = internalQuery({
  args: { telnyxMessageId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_telnyx_id", (q) =>
        q.eq("telnyxMessageId", args.telnyxMessageId),
      )
      .first();
  },
});

// Get lead by phone number for trusted server-side webhook processing.
// Webhooks are authenticated by Telnyx signature validation, not Clerk.
export const getLeadByPhoneForWebhook = internalQuery({
  args: {
    clerkId: v.string(),
    phoneNumber: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) return null;

    const lead = await ctx.db
      .query("leads")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", args.phoneNumber))
      .filter((q) => q.eq(q.field("userId"), user._id))
      .first();

    if (!lead) return null;

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_lead_id", (q) => q.eq("leadId", lead._id))
      .order("asc")
      .collect();

    return { ...lead, messages };
  },
});

// Get recent leads for dashboard
export const getRecentLeads = query({
  args: { clerkId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAuthenticatedClerkId(ctx, args.clerkId);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) return [];

    const leads = await ctx.db
      .query("leads")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("demoSessionId"), undefined))
      .order("desc")
      .take(Math.min(args.limit ?? 10, 100));

    return leads;
  },
});

// Get lead stats for dashboard
export const getLeadStats = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    await requireAuthenticatedClerkId(ctx, args.clerkId);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) {
      return {
        totalLeads: 0,
        needsActionLeads: 0,
        recentLeads: [],
        qualifiedLeads: 0,
        newLeads: 0,
        conversionRate: 0,
      };
    }

    const allLeads = await ctx.db
      .query("leads")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();

    const leads = allLeads.filter(isRealLead);
    const totalLeads = leads.length;
    const qualifiedStatuses = new Set([
      "qualified",
      "booking_link_sent",
      "needs_contractor_review",
      "appointment_booked",
    ]);
    const qualifiedLeads = leads.filter((l) =>
      qualifiedStatuses.has(l.status),
    ).length;
    const newLeads = leads.filter((l) => l.status === "new").length;
    const conversionRate =
      totalLeads > 0 ? Math.round((qualifiedLeads / totalLeads) * 100) : 0;

    return {
      totalLeads,
      needsActionLeads: leads.filter((lead) => needsAction(lead.status)).length,
      recentLeads: [...leads]
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 5)
        .map(
          ({
            _id,
            name,
            phoneNumber,
            jobType,
            location,
            status,
            createdAt,
          }) => ({
            _id,
            name,
            phoneNumber,
            jobType,
            location,
            status,
            createdAt,
          }),
        ),
      qualifiedLeads,
      newLeads,
      conversionRate,
    };
  },
});
