import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { PUBLIC_PAGES, absoluteUrl, indexingEnabled, isCanonicalHost } from "@/lib/seo";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!indexingEnabled() || !isCanonicalHost((await headers()).get("host"))) return [];
  return PUBLIC_PAGES.map(({ path }) => ({ url: absoluteUrl(path) }));
}
