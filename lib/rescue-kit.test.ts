import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { KIT_SECTIONS, KIT_TITLE, KIT_PROMISE, KIT_VERSION, TRACKING_COLUMNS, trackingCsv } from "./rescue-kit.ts";
import { safeAnalyticsProperties } from "./analytics-policy.ts";
import { attributedJourneyHref, campaignQuery } from "./journey-attribution.ts";
import { AUDIT_CTA_URL } from "../packages/brand/src/pricing-copy.ts";

test("public kit preserves every customer paragraph without the internal appendix", () => {
  const publicText = JSON.stringify({ KIT_TITLE, KIT_PROMISE, KIT_SECTIONS });
  const source = readFileSync(new URL("../tests/fixtures/rescue-kit.md", import.meta.url), "utf8").split("<!-- customer-kit:end -->")[0];
  for (const line of source.split("\n")) {
    if (!line.trim() || line.startsWith("|") || line.startsWith("```") || line.includes("\t")) continue;
    const text = line.replace(/^#{1,3} /, "").replace(/^> /, "").replace(/^(?:\d+\.|-) /, "").replace(/^\*\*|\*\*$/g, "");
    assert.ok(publicText.includes(JSON.stringify(text).slice(1, -1)), `Missing public content: ${text}`);
  }
  assert.doesNotMatch(publicText, /Internal launch|\[KIT_URL\]|Headline hypotheses|Email drafts|test A:/);
  assert.equal(new Set(KIT_SECTIONS.map((s) => s.id)).size, KIT_SECTIONS.length);
  for (const section of KIT_SECTIONS) for (const block of section.blocks) {
    if (block.type === "table") for (const row of block.rows) assert.equal(row.length, block.headers.length);
  }
  assert.equal(publicText.match(/https:\/\/calendly.com\/[^)]+/g)?.length, 1);
  assert.ok(publicText.includes(AUDIT_CTA_URL));
});

test("tracking CSV contains only nine quoted headings and round-trips exactly", () => {
  const csv = trackingCsv();
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.endsWith("\r\n"));
  const records = csv.slice(1).trimEnd().split("\r\n");
  assert.equal(records.length, 1);
  const cells = [...records[0].matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map((m) => m[1].replaceAll('""', '"'));
  assert.deepEqual(cells, [...TRACKING_COLUMNS]);
  assert.equal(cells.length, 9);
  assert.ok(cells.every((c) => !/^[=+@\-\t\r]/.test(c)));
  assert.doesNotMatch(csv, /JR-001|Alex|Morgan/);
});

test("kit analytics allow only fixed version and download format, never user data", () => {
  const inputs = { kit_version: KIT_VERSION, format: "pdf", email: "private@example.com", owner: "Private", utm_source: "campaign", raw_answers: {}, $geoip_disable: true };
  assert.deepEqual(safeAnalyticsProperties("rescue_kit_viewed", inputs), { kit_version: KIT_VERSION, $geoip_disable: true });
  assert.deepEqual(safeAnalyticsProperties("rescue_kit_download_clicked", inputs), { kit_version: KIT_VERSION, format: "pdf", $geoip_disable: true });
  assert.deepEqual(safeAnalyticsProperties("rescue_kit_download_clicked", { kit_version: "arbitrary", format: "email@example.com" }), {});
  assert.deepEqual(safeAnalyticsProperties("rescue_kit_download_clicked", { format: "csv" }), { format: "csv" });
  assert.equal(safeAnalyticsProperties("rescue_kit_completed", inputs), null);
});

test("kit attribution forwards only sanitized campaign tags and preserves anchors", () => {
  const campaign = campaignQuery("?utm_source=founder&email=private@example.com&owner=Alex&utm_content=kit_A");
  assert.equal(attributedJourneyHref("/rescue-kit#office-plan", campaign), "/rescue-kit?utm_source=founder&utm_content=kit_A#office-plan");
  assert.equal(attributedJourneyHref("/downloads/roofreply-missed-call-rescue-kit.pdf", campaign), "/downloads/roofreply-missed-call-rescue-kit.pdf");
});
