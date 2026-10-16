"use client";

import { startTransition, useEffect, useRef, useState, type ComponentProps } from "react";
import posthog from "posthog-js";
import { attributedJourneyHref, currentCampaign, originalCampaign } from "@/lib/journey-attribution";

export function JourneyLink({ href = "/calculator", onClick, ...props }: ComponentProps<"a">) {
  const [target, setTarget] = useState(href);
  useEffect(() => {
    originalCampaign();
    const attributed = attributedJourneyHref(href, currentCampaign());
    startTransition(() => setTarget(attributed));
  }, [href]);
  return <a {...props} href={target} onClick={(event) => {
    onClick?.(event);
    if (!event.defaultPrevented && href.startsWith("https://calendly.com/") && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      posthog.capture("marketing_audit_clicked", { $geoip_disable: true });
    }
  }} />;
}

// Visiting this URL is not evidence that Calendly created an appointment.
// Confirmed booking counts come from Calendly, not this browser event.
export function BookingConfirmationView() {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    sent.current = true;
    posthog.capture("marketing_booking_confirmation_viewed", { $geoip_disable: true });
  }, []);
  return null;
}
