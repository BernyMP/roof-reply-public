"use client";

import Script from "next/script";
import { emitLeadOnce } from "@/lib/conversion-receipt";

const sentLeads = new Set<string>();
export function trackCapturedLead(eventId: string) {
  let storage: Storage | undefined;
  try { storage = window.localStorage; } catch { /* Optional browser storage. */ }
  return emitLeadOnce(eventId, () => {
    if (typeof window.fbq !== "function") return false;
    trackMetaEvent("Lead", { content_name: "Requested roofing follow-up", content_category: "Lead magnet" }, eventId);
    return true;
  }, sentLeads, storage);
}

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    __roofReplyMetaEvents?: Record<string, boolean>;
  }
}

const metaPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;

export function trackMetaEvent(
  eventName: string,
  params?: Record<string, unknown>,
  eventId?: string
) {
  if (typeof window === "undefined" || typeof window.fbq !== "function") {
    return;
  }

  window.fbq(
    "track",
    eventName,
    params ?? {},
    eventId ? { eventID: eventId } : undefined
  );
}

export function MetaPixel() {
  if (!metaPixelId) {
    return null;
  }

  return (
    <>
      <Script
        id="meta-pixel"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', ${JSON.stringify(metaPixelId)});
            fbq('track', 'PageView');
          `,
        }}
      />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          alt=""
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${encodeURIComponent(
            metaPixelId
          )}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}
