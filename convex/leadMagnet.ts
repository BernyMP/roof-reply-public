import { attributionValidator, followUpRequestValidator } from "./leadCaptureValidators";
import { captureMetadataSchema, followUpReceipt } from "../lib/lead-capture-metadata";
import { assessmentSnapshotValidator } from "./leadMagnetValidators";
import { parseLeadMagnetSubmission } from "../lib/lead-magnet-submission";
import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

export const createLead = internalMutation({
  args: {
    attribution: v.optional(attributionValidator),
    followUpRequest: v.optional(followUpRequestValidator),
    captureEventId: v.optional(v.string()),
    latestAssessment: v.optional(assessmentSnapshotValidator),
    name: v.string(),
    email: v.string(),
    phoneNumber: v.string(),
    averageJobValue: v.optional(v.number()),
    missedCallsPerWeek: v.optional(v.number()),
    closeRate: v.optional(v.number()),
    realLeadRate: v.optional(v.number()),
    engagementRate: v.optional(v.number()),
    qualificationRate: v.optional(v.number()),
    monthlyRecovery: v.optional(v.number()),
    yearlyRecovery: v.optional(v.number()),
    calculationVersion: v.optional(v.literal(2)),
    existingRecoveryRate: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const canonical = args.latestAssessment
      ? parseLeadMagnetSubmission({
          assessmentVersion: 1,
          answers: args.latestAssessment.answers,
          company: args.latestAssessment.company,
          name: args.name,
          email: args.email,
          attribution: args.attribution,
          followUpRequest: args.followUpRequest,
        })
      : parseLeadMagnetSubmission(args);
    const snapshot =
      "latestAssessment" in canonical ? canonical.latestAssessment : undefined;
    const assessmentPatch = snapshot
      ? { latestAssessment: snapshot, assessmentUpdatedAt: Date.now() }
      : {};

    const metadata = captureMetadataSchema.parse(args);
    const attribution = metadata.attribution && Object.keys(metadata.attribution).length ? metadata.attribution : undefined;
    const receipt = metadata.followUpRequest ? followUpReceipt(metadata.followUpRequest.version, Date.now()) : undefined;
    const capturePatch = {
      ...(attribution ? { originalAttribution: attribution } : {}),
      ...(receipt ? { followUpRequest: receipt } : {}),
      ...(args.captureEventId ? { captureEventId: args.captureEventId } : {}),
    };
    const existingByEmail = await ctx.db
      .query("leadMagnetLeads")
      .withIndex("by_email", (q) => q.eq("email", canonical.email))
      .first();

    if (existingByEmail) {
      await ctx.db.patch(existingByEmail._id, {
        ...assessmentPatch,
        ...(!existingByEmail.originalAttribution && attribution ? { originalAttribution: attribution } : {}),
        ...(!existingByEmail.followUpRequest && receipt ? { followUpRequest: receipt } : {}),
        ...(!existingByEmail.captureEventId && args.captureEventId ? { captureEventId: args.captureEventId } : {}),
      });
      return existingByEmail._id;
    }

    if (args.phoneNumber) {
      const existingByPhone = await ctx.db
        .query("leadMagnetLeads")
        .withIndex("by_phone", (q) => q.eq("phoneNumber", args.phoneNumber))
        .first();

      if (existingByPhone) {
        if (snapshot) await ctx.db.patch(existingByPhone._id, assessmentPatch);
        return existingByPhone._id;
      }
    }

    const leadId = await ctx.db.insert("leadMagnetLeads", {
      name: canonical.name,
      email: canonical.email,
      phoneNumber: canonical.phoneNumber,
      averageJobValue: canonical.averageJobValue,
      missedCallsPerWeek: canonical.missedCallsPerWeek,
      closeRate: canonical.closeRate,
      realLeadRate: canonical.realLeadRate,
      engagementRate: canonical.engagementRate,
      qualificationRate: canonical.qualificationRate,
      monthlyRecovery: canonical.monthlyRecovery,
      yearlyRecovery: canonical.yearlyRecovery,
      ...("calculationVersion" in canonical
        ? {
            calculationVersion: canonical.calculationVersion,
            existingRecoveryRate: canonical.existingRecoveryRate ?? null,
          }
        : {}),
      ...assessmentPatch,
      ...capturePatch,
      createdAt: Date.now(),
    });

    return leadId;
  },
});

// Internal receipt contains no identity or assessment data. Event IDs are assigned
// by the authenticated ingress and remain stable across retries for this lead.
export const captureReceipt = internalQuery({
  args: { id: v.id("leadMagnetLeads") },
  handler: async (ctx, { id }) => {
    const lead = await ctx.db.get(id);
    return { eventId: lead?.captureEventId ?? null };
  },
});

// Operator CLI only. Never expose contact exports through a public query/route.
export const listFollowUpRequests = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const result = await ctx.db.query("leadMagnetLeads")
      .withIndex("by_follow_up_requested_at", (q) => q.gt("followUpRequest.requestedAt", 0))
      .order("desc").paginate(paginationOpts);
    return { ...result, page: result.page.map((lead) => ({
      id: lead._id, name: lead.name, email: lead.email,
      company: lead.latestAssessment?.company ?? "",
      originalAttribution: lead.originalAttribution,
      followUpRequest: lead.followUpRequest,
    })) };
  },
});
