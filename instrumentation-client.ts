import posthog from "posthog-js";
import { safeAnalyticsProperties } from "./lib/analytics-policy";

if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: "/ingest",
    ui_host: "https://us.posthog.com",
    defaults: "2025-05-24",
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
    capture_exceptions: false,
    capture_performance: false,
    person_profiles: "never",
    persistence: "memory",
    before_send: (event) => {
      if (!event) return null;
      const properties = safeAnalyticsProperties(event.event, event.properties);
      if (!properties) return null;
      event.properties = properties;
      return event;
    },
    loaded: (client) => {
      const host = window.location.hostname;
      client.capture("roofreply_app_loaded", {
        environment:
          host === "www.roofreply.com" || host === "roofreply.com"
            ? "pilot"
            : "demo",
        surface: window.location.pathname.startsWith("/onboarding")
          ? "onboarding"
          : window.location.pathname.startsWith("/dashboard")
            ? "dashboard"
            : "public",
        $geoip_disable: true,
      });
    },
  });
}
