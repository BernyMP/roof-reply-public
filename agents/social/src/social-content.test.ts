import test from "node:test";
import assert from "node:assert/strict";
import {
  SAMPLE_CONTENT,
  validateContent,
  dueAtForDate,
  upcomingDates,
  phoenixDate,
  captionFor,
  repeatsHook,
  socialSourceVersion,
} from "./social-content.ts";
import { SOCIAL_CONFIG, socialConfigurationErrors } from "./social-config.ts";
import { validateSocialPng } from "./social-image.ts";

test("Phoenix publishing is 15:00 UTC in summer and winter, including DST transition days", () => {
  for (const date of ["2026-01-12", "2026-07-12", "2026-03-08", "2026-11-01"]) {
    assert.equal(
      new Date(dueAtForDate(date)).toISOString(),
      `${date}T15:00:00.000Z`,
    );
  }
  assert.equal(phoenixDate(Date.parse("2026-09-12T06:59:59Z")), "2026-09-11");
  assert.throws(() => dueAtForDate("2026-02-30"));
});
test("three-day queue skips today at cutoff and handles year rollover", () => {
  assert.deepEqual(upcomingDates(Date.parse("2026-12-31T13:00:00Z")), [
    "2026-12-31",
    "2027-01-01",
    "2027-01-02",
  ]);
  assert.equal(
    upcomingDates(Date.parse("2026-12-31T14:45:00Z"))[0],
    "2027-01-01",
  );
});
test("publishing requires explicit activation prerequisites", () => {
  assert.ok(
    socialConfigurationErrors({
      ...SOCIAL_CONFIG,
      sampleApproved: false,
      instagramBioConfirmed: false,
      organizationId: "",
      facebookChannelId: "",
      instagramChannelId: "",
    }).length >= 4,
  );
  assert.match(socialSourceVersion(), /^sources-/);
});
test("sample content validates; final captions use platform-specific tracked CTA", () => {
  assert.deepEqual(validateContent(SAMPLE_CONTENT), SAMPLE_CONTENT);
  assert.match(
    captionFor(SAMPLE_CONTENT, "facebook", "2026-09-12"),
    /utm_source=facebook.*utm_content=2026-09-12/,
  );
  assert.match(
    captionFor(SAMPLE_CONTENT, "instagram", "2026-09-12"),
    /link in our bio/,
  );
  assert.doesNotMatch(
    captionFor(SAMPLE_CONTENT, "instagram", "2026-09-12"),
    /https?:/,
  );
});
test("duplicate and lightly reworded hooks are rejected", () => {
  assert.ok(
    repeatsHook("On the roof, away from the phone!", [SAMPLE_CONTENT.hook]),
  );
  assert.throws(
    () => validateContent(SAMPLE_CONTENT, [SAMPLE_CONTENT.hook]),
    /repeats/,
  );
});
test("unsupported claims, links, numeric results and invalid sources fail validation", () => {
  for (const facebook of [
    "Our clients recovered $5000 after using our amazing software service.",
    "RoofReply guarantees booked inspections for all the roofing businesses.",
    "We recovered 25 new leads through our missed-call recovery service.",
    "Read about the solution at https://example.test for more information.",
  ]) {
    assert.throws(() => validateContent({ ...SAMPLE_CONTENT, facebook }));
  }
  assert.throws(() =>
    validateContent({ ...SAMPLE_CONTENT, sources: ["invented"] }),
  );
  assert.throws(() =>
    validateContent({
      ...SAMPLE_CONTENT,
      graphic: { ...SAMPLE_CONTENT.graphic, headline: "x".repeat(73) },
    }),
  );
});
test("fictional conversations require three messages and get disclosure on both captions", () => {
  const example = {
    ...SAMPLE_CONTENT,
    topic: "example",
    graphic: {
      ...SAMPLE_CONTENT.graphic,
      template: "conversation",
      items: [
        "I have a roof leak.",
        "Is water coming inside?",
        "No, I want it checked.",
      ],
    },
  };
  const valid = validateContent(example);
  for (const p of ["facebook", "instagram"] as const)
    assert.match(captionFor(valid, p, "sample"), /^Illustrative example/);
  assert.throws(() =>
    validateContent({ ...example, graphic: { ...example.graphic, items: [] } }),
  );
});
test("image validation rejects HTML, wrong dimensions and oversized assets", () => {
  assert.throws(() =>
    validateSocialPng(new TextEncoder().encode("<html>error</html>")),
  );
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, 1080);
  view.setUint32(20, 1350);
  validateSocialPng(bytes);
  view.setUint32(20, 630);
  assert.throws(() => validateSocialPng(bytes));
});
