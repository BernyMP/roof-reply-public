import { v } from "convex/values";

export const customerFields = {
  dreamOutcome: v.optional(v.string()),
  bookingDeliveryMethod: v.optional(v.literal("phone")),
  bookingDeliveryPhone: v.optional(v.string()),
  accountSmsConsentGranted: v.optional(v.boolean()),
  // Compatibility inputs; evidence and timestamps are always set on the server.
  accountSmsConsentAt: v.optional(v.number()),
  accountSmsConsentPhone: v.optional(v.string()),
  accountSmsConsentText: v.optional(v.string()),
  accountSmsConsentVersion: v.optional(v.string()),
  leadHandoffMode: v.optional(
    v.union(
      v.literal("review_first"),
      v.literal("booking_link"),
      v.literal("review_and_booking"),
      v.literal("emergency_escalation"),
    ),
  ),
  bookingLink: v.optional(v.string()),
  bookingLinkLabel: v.optional(v.string()),
  autoBookingJobTypes: v.optional(v.array(v.string())),
  handoffInstructions: v.optional(v.string()),
  serviceAreas: v.optional(
    v.array(
      v.object({
        type: v.union(v.literal("zip"), v.literal("city"), v.literal("radius")),
        value: v.string(),
      }),
    ),
  ),
  preferredJobTypes: v.optional(
    v.array(
      v.union(
        v.literal("leak_repairs"),
        v.literal("storm_damage"),
        v.literal("emergency_tarping"),
        v.literal("tile_shingle"),
        v.literal("insurance_jobs"),
      ),
    ),
  ),
  filteredJobTypes: v.optional(v.array(v.string())),
  aiTone: v.optional(
    v.union(
      v.literal("professional"),
      v.literal("friendly"),
      v.literal("straight_to_point"),
      v.literal("bilingual"),
      v.literal("custom"),
    ),
  ),
  typicalCallDescription: v.optional(v.string()),
  callApproach: v.optional(v.string()),
  thingsNotToSay: v.optional(v.string()),
  collectPhotosFirst: v.optional(v.literal(false)),
  legalBusinessName: v.optional(v.string()),
  website: v.optional(v.string()),
  businessPhone: v.optional(v.string()),
};
export const eventStatus = v.union(
  v.literal("queued"),
  v.literal("processing"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("ignored"),
);
export const deliveryStatus = v.union(
  v.literal("queued"),
  v.literal("sending"),
  v.literal("accepted"),
  v.literal("delivered"),
  v.literal("failed"),
  v.literal("uncertain"),
  v.literal("suppressed"),
);
