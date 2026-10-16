"use client";

import { useEffect } from "react";

type MetaLeadEventProps = {
  eventName?: string;
  eventId: string;
  contentName: string;
  contentCategory?: string;
};

// Fires a Meta event once per eventId. The pixel base code is loaded globally
// by <MetaPixel /> in the root layout (components/meta-pixel.tsx).
export function MetaLeadEvent({
  eventName = "Lead",
  eventId,
  contentName,
  contentCategory = "Calendly booking",
}: MetaLeadEventProps) {
  useEffect(() => {
    let attempts = 0;

    const fireLeadEvent = () => {
      window.__roofReplyMetaEvents = window.__roofReplyMetaEvents ?? {};

      if (window.__roofReplyMetaEvents[eventId]) {
        return true;
      }

      if (typeof window.fbq !== "function") {
        return false;
      }

      window.fbq(
        "track",
        eventName,
        {
          content_name: contentName,
          content_category: contentCategory,
        },
        {
          eventID: eventId,
        }
      );
      window.__roofReplyMetaEvents[eventId] = true;

      return true;
    };

    if (fireLeadEvent()) {
      return;
    }

    const interval = window.setInterval(() => {
      attempts += 1;

      if (fireLeadEvent() || attempts >= 10) {
        window.clearInterval(interval);
      }
    }, 300);

    return () => window.clearInterval(interval);
  }, [contentCategory, contentName, eventId, eventName]);

  return null;
}
