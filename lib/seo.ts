import type { Metadata } from "next";

export const SITE_URL = "https://www.roofreply.com";
export const SITE_HOST = "www.roofreply.com";
export const PUBLIC_PAGES = [
  { path: "/", name: "Home" },
  { path: "/pricing", name: "Pricing" },
  { path: "/how-it-works", name: "How it works" },
  { path: "/about", name: "About RoofReply" },
  { path: "/calculator", name: "Revenue recovery assessment" },
  { path: "/rescue-kit", name: "Roofing Missed-Call Rescue Kit" },
  { path: "/privacy", name: "Privacy policy" },
  { path: "/terms", name: "Terms of service" },
  { path: "/sms-disclosure", name: "SMS messaging terms" },
] as const;

export function indexingEnabled() {
  return process.env.ROOFREPLY_INDEXING_ENABLED === "true";
}
export function isCanonicalHost(host: string | null) {
  return host?.toLowerCase() === SITE_HOST;
}
export function isIndexablePath(path: string) {
  return PUBLIC_PAGES.some((page) => page.path === path);
}
export function shouldNoIndex(host: string | null, path: string, enabled: boolean) {
  return !enabled || !isCanonicalHost(host) || !isIndexablePath(path);
}
export function absoluteUrl(path: string) {
  return path === "/" ? SITE_URL : new URL(path, SITE_URL).href;
}
export function pageMetadata(path: string, title: string, description: string, indexable = true): Metadata {
  const index = indexingEnabled() && indexable && isIndexablePath(path);
  const socialTitle = `${title} | RoofReply`;
  return {
    title, description, alternates: { canonical: absoluteUrl(path) },
    robots: { index, follow: true, googleBot: { index, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
    openGraph: {
      type: "website", locale: "en_US", siteName: "RoofReply",
      title: socialTitle, description, url: absoluteUrl(path),
      images: [{ url: absoluteUrl("/opengraph-image"), width: 1200, height: 630, alt: "RoofReply managed missed-call recovery for residential roofers" }],
    },
    twitter: { card: "summary_large_image", title: socialTitle, description, images: [absoluteUrl("/opengraph-image")] },
  };
}
export function robotsContent(publishSitemap: boolean) {
  const agents = ["*", "Googlebot", "Bingbot", "OAI-SearchBot", "Claude-SearchBot", "PerplexityBot"];
  const rules = agents.map((agent) => `User-agent: ${agent}\nAllow: /\nDisallow: /api/\nDisallow: /ingest/`);
  // Google-Extended also controls Gemini app grounding, independently of Search.
  for (const agent of ["GPTBot", "ClaudeBot", "Google-Extended"]) rules.push(`User-agent: ${agent}\nDisallow: /`);
  if (publishSitemap) rules.push(`Sitemap: ${SITE_URL}/sitemap.xml`);
  return `${rules.join("\n\n")}\n`;
}
export function jsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
