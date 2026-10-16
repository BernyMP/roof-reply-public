import test from "node:test";
import assert from "node:assert/strict";
import { readDownloadRetry } from "./assessment-download-retry.ts";
import { SAMPLE_ASSESSMENT } from "./missed-call-assessment.ts";
const draft = {
  answers: SAMPLE_ASSESSMENT,
  company: "García Roofing",
  name: "",
  email: "",
  jobs: {
    mixed: { value: "5000", unknown: false },
    repairs: { value: "", unknown: true },
  },
  speed: "next-day",
  owner: "",
  saved: true,
  createdAt: 1000,
};
test("download retry retains personalized inputs and contact success without resubmitting", () => {
  assert.deepEqual(readDownloadRetry(JSON.stringify(draft), 2000), draft);
  assert.equal(readDownloadRetry(JSON.stringify(draft), 601001), null);
  assert.equal(readDownloadRetry(JSON.stringify(draft), 999), null);
});
test("download retry rejects malformed, invalid or missing browser drafts", () => {
  for (const raw of [
    null,
    "broken",
    "{}",
    JSON.stringify({
      ...draft,
      answers: { ...SAMPLE_ASSESSMENT, closeRate: 101 },
    }),
    JSON.stringify({
      ...draft,
      jobs: { mixed: { value: "Infinity", unknown: false } },
    }),
  ])
    assert.equal(readDownloadRetry(raw, 2000), null);
});
