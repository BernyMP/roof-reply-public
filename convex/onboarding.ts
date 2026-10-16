import { v } from "convex/values";
import { customerFields } from "./pilotValidators";
import { contactPreference } from "./conciergeValidators";
import {
  completeEnrollment,
  invalidateConciergeReview,
} from "./conciergeEnrollment.util";
import {
  ACCOUNT_SMS_CONSENT_TEXT,
  ACCOUNT_SMS_CONSENT_VERSION,
  normalizeConsentPhone,
} from "../lib/account-sms-consent";
import { phoneSchema } from "../lib/automation-policy";
import { mutation, query, internalQuery } from "./_generated/server";
import {
  requireAuthenticatedClerkId,
  requireOpsAdmin,
} from "./authHelpers.util";

// Get or create onboarding record
const customerValidator = v.object(customerFields);

export const getOrCreateOnboarding = mutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    await requireAuthenticatedClerkId(ctx, args.clerkId);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) throw new Error("User not found");

    const existing = await ctx.db
      .query("onboarding")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .first();

    if (existing) {
      return existing._id;
    }

    const now = Date.now();
    const onboardingId = await ctx.db.insert("onboarding", {
      userId: user._id,
      clerkId: args.clerkId,
      createdAt: now,
      updatedAt: now,
    });

    return onboardingId;
  },
});

// Get onboarding data
export const getOnboarding = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    await requireAuthenticatedClerkId(ctx, args.clerkId);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) return null;

    return await ctx.db
      .query("onboarding")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .first();
  },
});

// Save onboarding step data
export const saveOnboardingStep = mutation({
  args: {
    clerkId: v.string(),
    step: v.number(),
    data: customerValidator,
  },
  handler: async (ctx, args) => {
    await requireAuthenticatedClerkId(ctx, args.clerkId);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) throw new Error("User not found");

    let onboarding = await ctx.db
      .query("onboarding")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .first();

    if (!onboarding) {
      const now = Date.now();
      const onboardingId = await ctx.db.insert("onboarding", {
        userId: user._id,
        clerkId: args.clerkId,
        createdAt: now,
        updatedAt: now,
      });
      onboarding = await ctx.db.get(onboardingId);
    }

    if (!onboarding) throw new Error("Failed to create onboarding");

    if (![1, 2, 3, 4, 5].includes(args.step))
      throw new Error("Invalid onboarding step");
    const updates = customerUpdates(args.data, onboarding);
    // Update onboarding data
    await ctx.db.patch(onboarding._id, {
      ...updates,
      updatedAt: Date.now(),
    });
    await invalidateConciergeReview(ctx, args.clerkId);

    // Update user step
    await ctx.db.patch(user._id, {
      onboardingStep: args.step,
      updatedAt: Date.now(),
    });
  },
});

// Get all assigned Telnyx phone numbers (to avoid re-assigning)
export const getAllAssignedTelnyxNumbers = internalQuery({
  args: {},
  handler: async (ctx) => {
    const allOnboarding = await ctx.db.query("onboarding").collect();
    return allOnboarding
      .filter((o) => o.telnyxPhoneNumber)
      .map((o) => o.telnyxPhoneNumber as string);
  },
});

// Get user by Telnyx phone number
export const getUserByTelnyxNumber = internalQuery({
  args: { telnyxPhoneNumber: v.string() },
  handler: async (ctx, args) => {
    const onboarding = await ctx.db
      .query("onboarding")
      .withIndex("by_telnyx_phone", (q) =>
        q.eq("telnyxPhoneNumber", args.telnyxPhoneNumber),
      )
      .first();

    if (!onboarding) return null;

    const user = await ctx.db.get(onboarding.userId);
    return user ? { user, onboarding } : null;
  },
});

// Update onboarding settings (for config page edits)
export const updateSettings = mutation({
  args: { clerkId: v.string(), ...customerFields },
  handler: async (ctx, args) => {
    const { clerkId, ...updates } = args;
    await requireAuthenticatedClerkId(ctx, clerkId);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .first();

    if (!user) throw new Error("User not found");

    const onboarding = await ctx.db
      .query("onboarding")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .first();

    if (!onboarding) throw new Error("Onboarding not found");

    // Filter out undefined values
    const filteredUpdates = customerUpdates(updates, onboarding);

    await ctx.db.patch(onboarding._id, {
      ...filteredUpdates,
      rehearsalEvidence: undefined,
      activationMode: "paused",
      updatedAt: Date.now(),
    });
    await invalidateConciergeReview(ctx, clerkId);
  },
});

// Update compliance / verification state for the signed-in user's account
export const updateComplianceStatus = mutation({
  args: {
    clerkId: v.string(),
    verificationStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const { clerkId, ...updates } = args;
    await requireOpsAdmin(ctx);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .first();

    if (!user) throw new Error("User not found");

    const onboarding = await ctx.db
      .query("onboarding")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .first();

    if (!onboarding) throw new Error("Onboarding not found");

    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined),
    );

    await ctx.db.patch(onboarding._id, {
      ...filteredUpdates,
      providerEvidence: undefined,
      rehearsalEvidence: undefined,
      activationMode: "paused",
      updatedAt: Date.now(),
    });
  },
});

// Complete onboarding
export const completeOnboarding = mutation({
  args: {
    clerkId: v.string(),
    contactPreference: v.optional(contactPreference),
  },
  handler: async (ctx, args) => {
    await requireAuthenticatedClerkId(ctx, args.clerkId);
    await completeEnrollment(ctx, args.clerkId, args.contactPreference);
  },
});

export function customerUpdates(
  data: Partial<import("convex/values").Infer<typeof customerValidator>>,
  existing: {
    bookingDeliveryPhone?: string;
    legalBusinessName?: string;
    website?: string;
    businessPhone?: string;
  },
) {
  const updates = Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined),
  );
  for (const value of Object.values(updates))
    if (typeof value === "string" && value.length > 2000)
      throw new Error("Field too long");
  if (data.bookingLink) {
    const url = new URL(data.bookingLink);
    if (
      url.protocol !== "https:" ||
      !["calendly.com", "www.calendly.com"].includes(url.hostname) ||
      url.username ||
      url.password
    )
      throw new Error("Use an HTTPS Calendly booking link");
  }
  if (data.bookingDeliveryPhone !== undefined)
    updates.bookingDeliveryPhone = phoneSchema.parse(
      normalizeConsentPhone(data.bookingDeliveryPhone),
    );
  const phone = String(
    updates.bookingDeliveryPhone ?? existing.bookingDeliveryPhone ?? "",
  );
  for (const key of [
    "accountSmsConsentAt",
    "accountSmsConsentPhone",
    "accountSmsConsentText",
    "accountSmsConsentVersion",
  ])
    delete updates[key];
  if (data.accountSmsConsentGranted === true) {
    phoneSchema.parse(phone);
    if (
      data.accountSmsConsentText !== ACCOUNT_SMS_CONSENT_TEXT ||
      data.accountSmsConsentVersion !== ACCOUNT_SMS_CONSENT_VERSION
    )
      throw new Error("Please accept the current SMS disclosure");
    Object.assign(updates, {
      accountSmsConsentAt: Date.now(),
      accountSmsConsentPhone: phone,
      accountSmsConsentText: ACCOUNT_SMS_CONSENT_TEXT,
      accountSmsConsentVersion: ACCOUNT_SMS_CONSENT_VERSION,
    });
  } else if (
    data.bookingDeliveryPhone !== undefined &&
    phone !== existing.bookingDeliveryPhone
  ) {
    updates.accountSmsConsentGranted = false;
  }
  const businessIdentityChanged = (
    ["legalBusinessName", "website", "businessPhone"] as const
  ).some((key) => updates[key] !== undefined && updates[key] !== existing[key]);
  // Consent and handoff edits do not change the provider's brand/campaign approval.
  // Business identity edits require that evidence to be reviewed again.
  return {
    ...updates,
    ...(businessIdentityChanged ? { providerEvidence: undefined } : {}),
    collectPhotosFirst: false,
    activationMode: "paused" as const,
    forwardingEvidence: undefined,
    rehearsalEvidence: undefined,
  };
}
