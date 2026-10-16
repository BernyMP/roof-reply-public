"use client";
import posthog from "posthog-js";
export function trackOnboarding(
  event:
    | "onboarding_started"
    | "onboarding_step_saved"
    | "onboarding_validation_failed"
    | "onboarding_completed",
  step: number,
  startedAt: number,
  field?: string,
) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  posthog.capture(event, {
    flow_version: "concierge_v1",
    step,
    elapsed_ms: Math.min(86400000, Math.max(0, Date.now() - startedAt)),
    ...(field ? { field } : {}),
    $geoip_disable: true,
  });
}
