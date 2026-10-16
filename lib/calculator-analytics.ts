"use client";
import { currentCampaign } from "./journey-attribution";
import posthog from "posthog-js";
export function trackCalculator(
  event:
    | "calculator_step_viewed"
    | "calculator_step_completed"
    | "calculator_contact_saved"
    | "calculator_contact_failed"
    | "calculator_engaged"
    | "calculator_completed"
    | "calculator_report_requested"
    | "calculator_report_downloaded"
    | "calculator_report_failed"
    | "calculator_audit_clicked"
    | "calculator_offer_clicked"
    | "kit_offer_clicked",
  existingFollowUpKnown: boolean,
  context: {
    step?: 1 | 2 | 3;
    flow_version?: "assessment_v2" | "assessment_v3";
  } = {},
) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  posthog.capture(event, {
    flow_version: "assessment_v2",
    existing_follow_up_known: existingFollowUpKnown,
    $geoip_disable: true,
    ...context,
    ...Object.fromEntries(new URLSearchParams(currentCampaign())),
  });
}
