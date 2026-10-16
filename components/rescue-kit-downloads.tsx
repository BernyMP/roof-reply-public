"use client";

import { useEffect, useRef } from "react";
import posthog from "posthog-js";
import { KIT_CSV_URL, KIT_PDF_URL, KIT_VERSION } from "@/lib/rescue-kit";

export function RescueKitDownloads() {
  const viewed = useRef(false);
  useEffect(() => {
    if (viewed.current || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    viewed.current = true;
    posthog.capture("rescue_kit_viewed", { kit_version: KIT_VERSION, $geoip_disable: true });
  }, []);
  function track(format: "pdf" | "csv") {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    posthog.capture("rescue_kit_download_clicked", {
      kit_version: KIT_VERSION, format, $geoip_disable: true,
    });
  }
  return (
    <div className="rk-downloads">
      <a className="rk-button" href={KIT_PDF_URL} download onClick={() => track("pdf")}>
        Download the complete kit <span>PDF ↓</span>
      </a>
      <a className="rk-button rk-button-secondary" href={KIT_CSV_URL} download onClick={() => track("csv")}>
        Get the tracking sheet <span>CSV ↓</span>
      </a>
    </div>
  );
}
