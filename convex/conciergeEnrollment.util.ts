import type { MutationCtx } from "./_generated/server";
import {
  businessFormErrors,
  validSetupPhone,
  guidedSetupDefaults,
} from "../lib/guided-onboarding";
import { hasOwnerConsent } from "../lib/automation-policy";
import {
  CONCIERGE_CHECKLIST,
  sameDayDeadline,
  type ContactPreference,
} from "../lib/concierge";

export async function completeEnrollment(
  ctx: MutationCtx,
  clerkId: string,
  preference: ContactPreference = "email",
) {
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
    .unique();
  if (!user) throw new Error("User not found");
  // A retried completion must never pause an existing live customer or reset a deadline.
  if (user.onboardingCompleted) return;
  const account = await ctx.db
    .query("onboarding")
    .withIndex("by_user_id", (q) => q.eq("userId", user._id))
    .unique();
  if (!account) throw new Error("Onboarding not found");
  const errors = businessFormErrors({
    legalBusinessName: account.legalBusinessName || "",
    businessPhone: account.businessPhone || "",
    website: account.website || "",
    areas: account.serviceAreas?.map((area) => area.value).join(", ") || "",
  });
  if (
    Object.keys(errors).length ||
    account.serviceAreas?.some((area) => !area.value.trim())
  )
    throw new Error("Complete your business details before submitting.");
  if (
    !validSetupPhone(account.bookingDeliveryPhone || "") ||
    !hasOwnerConsent(account)
  )
    throw new Error(
      "Confirm your mobile number and current SMS permission before submitting.",
    );
  if (preference !== "sms" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email))
    throw new Error(
      "Add a valid primary email in your account, or choose Text for setup.",
    );
  const existing = await ctx.db
    .query("onboardingConcierge")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
    .unique();
  const now = Date.now();
  if (!existing)
    await ctx.db.insert("onboardingConcierge", {
      clerkId,
      userId: user._id,
      contactPreference: preference,
      enrolledAt: now,
      followUpDueAt: sameDayDeadline(now),
      nextAction: "Arrange your kickoff conversation",
      nextActionOwner: "berny",
      checklist: CONCIERGE_CHECKLIST.map(({ key }) => ({
        key,
        status: "pending" as const,
        reference: "",
        updatedAt: now,
        updatedBy: clerkId,
      })),
      privateNotes: "",
      updatedAt: now,
    });
  await ctx.db.patch(account._id, {
    ...guidedSetupDefaults(account),
    completedAt: account.completedAt ?? now,
    activationMode: "paused",
    updatedAt: now,
  });
  await ctx.db.patch(user._id, {
    onboardingCompleted: true,
    onboardingStep: 5,
    updatedAt: now,
  });
}

export async function invalidateConciergeReview(
  ctx: MutationCtx,
  clerkId: string,
) {
  const record = await ctx.db
    .query("onboardingConcierge")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
    .unique();
  if (!record) return;
  const now = Date.now();
  await ctx.db.patch(record._id, {
    // Keep the old references for context, but require new confirmation after changes.
    checklist: record.checklist.map((item) => ({
      ...item,
      status: "pending" as const,
      updatedAt: now,
      updatedBy: clerkId,
    })),
    nextAction: "Review your updated setup details with Berny",
    nextActionOwner: "berny",
    updatedAt: now,
  });
}
