import test from "node:test";
import assert from "node:assert/strict";
import { PUBLIC_PAGES, SITE_HOST, SITE_URL, shouldNoIndex, pageMetadata, robotsContent, jsonLd } from "./seo.ts";
import { serviceSchema, organizationSchema, breadcrumbSchema } from "./seo-schema.ts";
import { CORE_PRICE_COPY, FOUNDING_INCLUDED_FOLLOWUPS } from "./pricing-copy.ts";

test("only canonical production public pages can be indexed", () => {
  for (const { path } of PUBLIC_PAGES) {
    assert.equal(shouldNoIndex(SITE_HOST, path, true), false);
    for (const host of [SITE_HOST, "roofreply.com", "demo.roofreply.com", "roof-reply-abc.vercel.app", "www.roofreply.com.evil.test", null]) {
      assert.equal(shouldNoIndex(host, path, false), true);
      if (host !== SITE_HOST) assert.equal(shouldNoIndex(host, path, true), true);
    }
  }
  for (const path of ["/dashboard", "/dashboard/settings", "/onboarding", "/sign-in", "/sign-in/step", "/demo-sms", "/specials/pilot", "/specials/pilot/booked", "/api/telnyx/webhook", "/missing"]) assert.equal(shouldNoIndex(SITE_HOST, path, true), true);
});

test("search crawlers can discover noindex pages and rendering assets; training is independently blocked", () => {
  const text = robotsContent(true);
  for (const agent of ["*", "Googlebot", "Bingbot", "OAI-SearchBot", "Claude-SearchBot", "PerplexityBot"]) {
    const block = text.split("\n\n").find((value) => value.startsWith(`User-agent: ${agent}\n`))!;
    assert.ok(block.includes("Allow: /\n"));
    assert.ok(block.includes("Disallow: /api/"));
    assert.ok(!block.includes("Disallow: /\n"));
    assert.ok(!block.includes("Disallow: /sign-in"));
    assert.ok(!block.includes("Disallow: /_next"));
  }
  for (const agent of ["GPTBot", "ClaudeBot", "Google-Extended"]) assert.ok(text.includes(`User-agent: ${agent}\nDisallow: /`));
  assert.ok(text.includes(`Sitemap: ${SITE_URL}/sitemap.xml`));
  assert.ok(!robotsContent(false).includes("Sitemap:"));
});

test("metadata has a canonical and social URL for each public page, without fake freshness", () => {
  const previous = process.env.ROOFREPLY_INDEXING_ENABLED;
  try {
    process.env.ROOFREPLY_INDEXING_ENABLED = "true";
    const titles = new Set();
    for (const { path, name } of PUBLIC_PAGES) {
      const metadata = pageMetadata(path, name, `${name} description`);
      const canonical = path === "/" ? SITE_URL : new URL(path, SITE_URL).href;
      assert.equal(metadata.alternates?.canonical, canonical);
      assert.equal(metadata.openGraph?.url, canonical);
      assert.equal((metadata.robots as { index: boolean }).index, true);
      titles.add(metadata.title);
    }
    assert.equal(titles.size, PUBLIC_PAGES.length);
    assert.equal((pageMetadata("/demo-sms", "Demo", "Consent", false).robots as { index: boolean }).index, false);
    delete process.env.ROOFREPLY_INDEXING_ENABLED;
    assert.equal((pageMetadata("/", "Home", "Home").robots as { index: boolean }).index, false);
  } finally {
    if (previous === undefined) delete process.env.ROOFREPLY_INDEXING_ENABLED;
    else process.env.ROOFREPLY_INDEXING_ENABLED = previous;
  }
});

test("service schema uses the complete shared offer, not a misleading monthly-only price", () => {
  assert.equal(serviceSchema.offers.price, "0");
  assert.ok(serviceSchema.offers.description.includes(CORE_PRICE_COPY));
  assert.match(serviceSchema.offers.description, /whichever comes first/);
  assert.equal(FOUNDING_INCLUDED_FOLLOWUPS, 500);
  assert.match(serviceSchema.offers.description, /\$100/);
  assert.equal(serviceSchema.offers.url, `${SITE_URL}/pricing`);
  assert.equal(serviceSchema.provider["@id"], organizationSchema["@id"]);
  assert.equal(breadcrumbSchema("/pricing", "Pricing").itemListElement[1].item, `${SITE_URL}/pricing`);
});

test("structured data cannot close its script tag", () => {
  const input = { text: "</script><script>alert(1)</script>" };
  const output = jsonLd(input);
  assert.ok(!output.includes("<"));
  assert.deepEqual(JSON.parse(output), input);
});
