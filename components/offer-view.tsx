"use client";
import { useEffect, useRef } from "react";
import posthog from "posthog-js";
import { currentCampaign } from "@/lib/journey-attribution";

export function OfferView() {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    sent.current = true;
    posthog.capture("marketing_offer_viewed", {
      ...Object.fromEntries(new URLSearchParams(currentCampaign())),
      $geoip_disable: true,
    });
  }, []);
  return null;
}
