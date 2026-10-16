import { campaignQuery } from "./journey-attribution.ts";
const baseProperties = new Set([
  "token",
  "distinct_id",
  "$lib",
  "$lib_version",
  "$session_id",
  "$device_id",
  "environment",
  "surface",
  "$geoip_disable",
]);
const onboardingEvents = new Set([
  "onboarding_started",
  "onboarding_step_saved",
  "onboarding_validation_failed",
  "onboarding_completed",
]);
const marketingEvents = new Set([
  "marketing_audit_clicked",
  "marketing_offer_viewed",
  "marketing_booking_confirmation_viewed",
]);
const rescueKitEvents = new Set(["rescue_kit_viewed", "rescue_kit_download_clicked"]);
export const calculatorEvents = new Set([
  "calculator_step_viewed",
  "calculator_step_completed",
  "calculator_contact_saved",
  "calculator_contact_failed",
  "calculator_engaged",
  "calculator_completed",
  "calculator_report_requested",
  "calculator_report_downloaded",
  "calculator_report_failed",
  "calculator_audit_clicked",
  "calculator_offer_clicked",
  "kit_offer_clicked",
]);
export function safeAnalyticsProperties(
  event: string,
  properties: Record<string, unknown>,
) {
  if (
    event !== "roofreply_app_loaded" &&
    !marketingEvents.has(event) &&
    !rescueKitEvents.has(event) &&
    !onboardingEvents.has(event) &&
    !calculatorEvents.has(event)
  )
    return null;
  return Object.fromEntries(
    Object.entries(properties).filter(([key, value]) => {
      if (baseProperties.has(key)) return true;
      if (rescueKitEvents.has(event)) {
        if (key === "kit_version") return value === "rescue_kit_v1";
        return event === "rescue_kit_download_clicked" && key === "format" && (value === "pdf" || value === "csv");
      }
      if ((calculatorEvents.has(event) || marketingEvents.has(event)) && key.startsWith("utm_") && typeof value === "string") {
        return new URLSearchParams(campaignQuery(new URLSearchParams({ [key]: value }).toString())).get(key) === value;
      }
      if (calculatorEvents.has(event)) {
        if (key === "flow_version")
          return value === "assessment_v2" || value === "assessment_v3";
        if (key === "step") return value === 1 || value === 2 || value === 3;
        if (key === "existing_follow_up_known")
          return typeof value === "boolean";
        return false;
      }
      if (!onboardingEvents.has(event)) return false;
      if (key === "flow_version") return value === "concierge_v1";
      if (key === "step") return value === 1 || value === 2;
      if (key === "elapsed_ms")
        return (
          typeof value === "number" &&
          Number.isFinite(value) &&
          value >= 0 &&
          value <= 86400000
        );
      if (key === "field")
        return (
          typeof value === "string" &&
          [
            "legalBusinessName",
            "businessPhone",
            "areas",
            "website",
            "alertPhone",
            "smsConsent",
            "email",
          ].includes(value)
        );
      return false;
    }),
  );
}
