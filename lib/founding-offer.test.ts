import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  AUDIT_CTA_LABEL,
  AUDIT_CTA_URL,
  CORE_PRICE_COPY,
  FOUNDING_IMPLEMENTATION_FEE,
  FOUNDING_MONTHLY_FEE,
  FOUNDING_INITIAL_MONTHS,
  FOUNDING_INITIAL_COMMITMENT,
  FOUNDING_KICKOFF_PAYMENT,
  LEGACY_PAYMENT_SCHEDULE_COPY,
  FREE_OFFER_SUMMARY,
  FREE_USAGE_COPY,
  FOUNDING_INCLUDED_FOLLOWUPS,
  QUALIFICATION_ASSURANCE_COPY,
  ENTERPRISE_SCOPE_COPY,
  ENTERPRISE_CONTACT_URL,
} from "./pricing-copy.ts";
import {
  SPECIAL_OFFERS,
  getSpecialOffer,
  getSpecialOfferSlugs,
} from "./special-offers.ts";
import { marketingFaqs, REPORTING_MEASURES } from "./marketing-copy.ts";

test("founding commitment includes implementation and three management months", () => {
  assert.equal(FOUNDING_IMPLEMENTATION_FEE, 1500);
  assert.equal(FOUNDING_MONTHLY_FEE, 750);
  assert.equal(FOUNDING_INITIAL_MONTHS, 3);
  assert.equal(FOUNDING_INITIAL_COMMITMENT, 3750);
  assert.equal(FOUNDING_INCLUDED_FOLLOWUPS, 500);
  assert.equal(FOUNDING_KICKOFF_PAYMENT, 2250);
  assert.equal(
    FOUNDING_KICKOFF_PAYMENT + FOUNDING_MONTHLY_FEE * (FOUNDING_INITIAL_MONTHS - 1),
    FOUNDING_INITIAL_COMMITMENT,
  );
  assert.match(LEGACY_PAYMENT_SCHEDULE_COPY, /\$2,250 at kickoff/);
  assert.match(LEGACY_PAYMENT_SCHEDULE_COPY, /\$750 at the start of months two and three/);
  assert.match(LEGACY_PAYMENT_SCHEDULE_COPY, /agreed service activation date/);
  assert.match(FREE_OFFER_SUMMARY, /30 days.*\$100/);
  assert.match(FREE_OFFER_SUMMARY, /whichever comes first/);
  assert.match(CORE_PRICE_COPY, /first five qualifying/);
  assert.doesNotMatch(CORE_PRICE_COPY, /\$750|\$3,750|90-day/);

});
test("existing offer URL presents the free offer with shared CTA and visible FAQ source", () => {
  assert.deepEqual(getSpecialOfferSlugs(), ["pilot"]);
  const offer = getSpecialOffer("pilot");
  assert.equal(offer.indexable, false);
  assert.equal(offer.primaryCtaLabel, "Book a 20-minute fit call");
  assert.equal(offer.primaryCtaLabel, AUDIT_CTA_LABEL);
  assert.equal(offer.primaryCtaHref, AUDIT_CTA_URL);
  assert.equal(new URL(AUDIT_CTA_URL).hostname, "calendly.com");
  assert.equal(
    new URL(AUDIT_CTA_URL).pathname,
    "/example/roofing-audit",
  );
  assert.deepEqual(offer.faq, marketingFaqs);
  assert.equal(REPORTING_MEASURES.length, 6);
  assert.match(QUALIFICATION_ASSURANCE_COPY, /does not guarantee/);
  assert.match(FREE_USAGE_COPY, /provider cost, without markup/);
  assert.match(FREE_OFFER_SUMMARY, /No automatic charges/);

});
test("public acquisition sources do not retain the obsolete offer", () => {
  const files = [
    "components/landing-page.tsx",
    "components/marketing-shell.tsx",
    "components/special-offer-pilot-page.tsx",
    "app/layout.tsx",
    "app/page.tsx",
    "app/calculator/page.tsx",
    "app/terms/page.tsx",
    "lib/pdf/generate-report.ts",
  ];
  for (const file of files) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(
      source,
      /\$149|\$249|price:\s*["'](?:149|249)["']|30.days free|free.{0,10}pilot|no pilot commitment|Book a guided demo|pays for itself fastest/iu,
      file,
    );
  }
});

test("higher volume is an agreed enterprise scope with no automatic overage", () => {
  assert.match(ENTERPRISE_SCOPE_COPY, /separate agreement/);
  assert.match(ENTERPRISE_SCOPE_COPY, /no automatic overage charges/);
  assert.equal(new URL(ENTERPRISE_CONTACT_URL).pathname, "hello@example.com");
  assert.ok(JSON.stringify(marketingFaqs).includes(ENTERPRISE_SCOPE_COPY));
  assert.ok(JSON.stringify(SPECIAL_OFFERS).includes(ENTERPRISE_SCOPE_COPY));
});
