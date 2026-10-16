"use node";
import { v } from "convex/values";
import { internalAction, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { generateAiResponse, generateLeadSummary } from "../lib/ai";
import { roofingHandoffReply } from "../agents/roofing-lead/src/conversation";
import { resolveLeadHandoff } from "../lib/lead-handoff";
import { sendSms, SmsSubmissionError } from "../lib/telnyx";

export async function processConversation(
  ctx: ActionCtx,
  { conversationKey }: { conversationKey: string },
): Promise<void> {
  const event = await ctx.runMutation(internal.automation.claim, {
    conversationKey,
  });
  if (!event) return;
  try {
    const prepared = await ctx.runMutation(internal.automation.prepare, {
      eventId: event._id,
      attempt: event.attempts,
    });
    if (!prepared) {
      await ctx.runMutation(internal.automation.finish, {
        eventId: event._id,
        attempt: event.attempts,
      });
      return;
    }
    if (!prepared.readyToSend && prepared.account && prepared.lead) {
      const a = prepared.account,
        lead = prepared.lead;
      try {
        const response = await generateAiResponse(
          prepared.history.map((m) => ({
            role:
              m.sender === "lead" ? ("user" as const) : ("assistant" as const),
            content: m.content,
          })),
          {
            eventDemo: Boolean(event.demoSessionId && prepared.history.every((m) => m.content.length <= 320)),
            businessName: a.legalBusinessName || "the roofing team",
            aiTone: a.aiTone || "professional",
            preferredJobTypes: a.preferredJobTypes || [],
            serviceAreas: (a.serviceAreas || []).map((s) => s.value),
            thingsNotToSay: a.thingsNotToSay,
            collectPhotosFirst: false,
            leadHandoffMode: a.leadHandoffMode,
            bookingLink: a.bookingLink,
            bookingLinkLabel: a.bookingLinkLabel,
            handoffInstructions: a.handoffInstructions,
            startedFromMissedCall:
              lead.channel === "call" || Boolean(lead.demoSessionId),
            knownLead: {
              name: lead.name,
              jobType: lead.jobType,
              location: lead.location,
              urgency: lead.urgency,
            },
          },
        );
        const decision = resolveLeadHandoff({
          mode: a.leadHandoffMode,
          isQualified:
            !response.requiresHumanReview && response.leadInfo.isQualified === true,
          urgency: response.leadInfo.urgency,
          bookingLink: a.bookingLink,
          jobType: response.leadInfo.jobType,
          autoBookingJobTypes: a.autoBookingJobTypes,
        });
        const complete =
          response.conversationComplete ||
          response.requiresHumanReview ||
          response.leadInfo.urgency === "high";
        const reply = complete
          ? roofingHandoffReply({
              urgency: response.leadInfo.urgency,
              requiresHumanReview: response.requiresHumanReview,
              shouldSendBookingLink: decision.shouldSendBookingLink,
            })
          : response.message;
        const { name, jobType, location, urgency, summary } = response.leadInfo;
        await ctx.runMutation(internal.automation.savePlan, {
          eventId: event._id,
          attempt: event.attempts,
          reply:
            reply +
            (!lead.demoSessionId && (lead.aiResponseCount ?? 0) === 0
              ? " Reply STOP to opt out."
              : ""),
          info: { name, jobType, location, urgency, summary },
          complete,
          mode: decision.mode,
          reason: decision.reason,
          failed: false,
          booking:
            complete && decision.shouldSendBookingLink && a.bookingLink
              ? `${a.bookingLinkLabel || "Schedule roof inspection"}: ${a.bookingLink}`
              : undefined,
          owner:
            complete && decision.shouldNotifyContractor
              ? generateLeadSummary({
                  ...lead,
                  ...response.leadInfo,
                  phoneNumber: lead.phoneNumber,
                })
              : undefined,
        });
      } catch {
        await ctx.runMutation(internal.automation.savePlan, {
          eventId: event._id,
          attempt: event.attempts,
          info: {},
          complete: true,
          mode: "review_first",
          reason: "AI unavailable; contractor review required",
          failed: true,
          owner: `RoofReply: A roofing inquiry needs your review. Caller: ${lead.phoneNumber}. Open the lead inbox for the conversation.`,
        });
      }
    }
    for (const item of await ctx.runQuery(internal.automation.outbox, {
      eventId: event._id,
    })) {
      const send = await ctx.runMutation(internal.automation.beginSend, {
        id: item._id,
        attempt: event.attempts,
      });
      if (!send) continue;
      try {
        const result = await sendSms({
          from: send.from,
          to: send.to,
          text: send.text,
          messagingProfileId: send.messagingProfileId,
        });
        await ctx.runMutation(internal.automation.finishSend, {
          id: send._id,
          state: "accepted",
          providerId: result.data.id,
        });
      } catch (error) {
        const knownRejected =
          error instanceof SmsSubmissionError && error.rejected;
        await ctx.runMutation(internal.automation.finishSend, {
          id: send._id,
          state: knownRejected ? "failed" : "uncertain",
          error: knownRejected
            ? "Provider rejected message; check routing, consent, or campaign"
            : "Submission outcome unknown; reconcile in Telnyx before any resend",
        });
      }
    }
    await ctx.runMutation(internal.automation.finish, {
      eventId: event._id,
      attempt: event.attempts,
    });
  } catch {
    await ctx.runMutation(internal.automation.finish, {
      eventId: event._id,
      attempt: event.attempts,
      error: "Processing failed; bounded retry or operator review required",
    });
  }
}
export const process = internalAction({
  args: { conversationKey: v.string() },
  handler: processConversation,
});
