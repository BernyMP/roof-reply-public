import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRecoveryBrief,
  potentialJobSummary,
  count,
} from "./recovery-brief.ts";
import { DEFAULT_CALCULATOR_INPUTS as inputs } from "./calculator-estimates.ts";

test("unknown follow-up never establishes additional revenue", () => {
  const report = buildRecoveryBrief(inputs);
  assert.equal(report.status, "verify-follow-up");
  assert.match(
    report.resultExplanation,
    /has not been deducted because it is unknown/,
  );
  assert.match(
    report.resultExplanation,
    /additional revenue has not been established/,
  );
  assert.ok(report.rows.filter((r) => r.source === "Example").length >= 6);
});
test("job summaries use monthly approximations only from 0.9 and preserve small opportunities", () => {
  for (const [monthly, annual, expected] of [
    [0, 0, "No potential jobs at these inputs."],
    [0.0001, 0.0012, "Less than 1 potential job per year."],
    [0.999 / 12, 0.999, "Less than 1 potential job per year."],
    [1 / 12, 1, "About 1 potential job per year"],
    [0.5, 6, "About 6 potential jobs per year"],
    [0.899, 10.788, "About 11 potential jobs per year"],
    [0.9, 10.8, "About 1 potential job per month"],
    [0.91, 10.92, "About 1 potential job per month"],
    [1.092, 13.104, "About 1 potential job per month"],
    [1.5, 18, "About 2 potential jobs per month"],
  ] as const)
    assert.equal(potentialJobSummary(monthly, annual), expected);
  assert.equal(count(0), "0");
  assert.equal(count(0.0001), "<0.01");
  assert.equal(count(0.0099), "<0.01");
  assert.equal(count(0.01), "0.01");
});
test("known follow-up has one accurate explanation, including explicit zero", () => {
  for (const rate of [0, 50, 100]) {
    const r = buildRecoveryBrief({ ...inputs, existingRecoveryRate: rate });
    assert.doesNotMatch(
      r.resultExplanation,
      /unknown|not established|Not adjusted/,
    );
    assert.equal(r.rows[4].value, `${rate}%`);
    assert.equal(r.rows[4].source, "Your estimate");
    assert.match(r.resultExplanation, /excludes job costs and service fees/);
    assert.match(
      r.resultExplanation,
      /not guaranteed revenue or a verified loss/,
    );
    assert.match(
      r.resultExplanation,
      rate === 0 ? /0% already reached/ : new RegExp(`excludes the ${rate}%`),
    );
  }
});
test("zero and small results take priority over unknown follow-up or existing coverage", () => {
  for (const gap of ["both", "covered"] as const) {
    assert.equal(
      buildRecoveryBrief({ ...inputs, missedCallsPerWeek: 0.1 }, gap).status,
      "small-opportunity",
    );
    const zeroValue = buildRecoveryBrief(
      { ...inputs, averageJobValue: 0 },
      gap,
    );
    assert.equal(zeroValue.status, "no-opportunity");
    assert.match(zeroValue.finding.body, /does not support adding a paid/);
  }
  assert.equal(buildRecoveryBrief(inputs, "covered").status, "verify-coverage");
  const sample = buildRecoveryBrief({ ...inputs, missedCallsPerWeek: 5 });
  assert.equal(sample.estimate.monthlyRevenue, 4550);
  assert.equal(sample.estimate.yearlyRevenue, 54600);
  assert.equal(
    sample.jobDetails,
    "Modeled averages: 0.91 jobs/month; 10.92 jobs/year.",
  );
});
test("zero, small and already-covered opportunities do not force a fit", () => {
  assert.equal(
    buildRecoveryBrief({ ...inputs, existingRecoveryRate: 100 }).status,
    "no-opportunity",
  );
  assert.equal(
    buildRecoveryBrief({
      ...inputs,
      missedCallsPerWeek: 0.1,
      existingRecoveryRate: 0,
    }).status,
    "small-opportunity",
  );
  assert.equal(
    buildRecoveryBrief({ ...inputs, existingRecoveryRate: 0 }, "covered")
      .status,
    "verify-coverage",
  );
});
test("optional margin does not alter revenue; fee threshold uses job contribution", () => {
  const unknown = buildRecoveryBrief(inputs);
  assert.equal(unknown.contributionPerJob, null);
  assert.equal(unknown.breakEvenJobs, null);
  const zero = buildRecoveryBrief(inputs, "both", 0);
  assert.equal(zero.breakEvenJobs, null);
  const r = buildRecoveryBrief(inputs, "both", 30);
  assert.equal(r.contributionPerJob, 1500);
  assert.equal(r.breakEvenJobs, 3);
  assert.equal(r.contributionPerJob! * r.breakEvenJobs!, 4500);
  assert.equal(r.estimate.monthlyRevenue, unknown.estimate.monthlyRevenue);
  for (const invalid of [-1, 101, NaN, Infinity])
    assert.throws(
      () => buildRecoveryBrief(inputs, "both", invalid),
      RangeError,
    );
});
test("input provenance and flow preserve the selected adjustment", () => {
  const r = buildRecoveryBrief(
    { ...inputs, existingRecoveryRate: 50 },
    "both",
    null,
    ["missedCallsPerWeek"],
  );
  assert.equal(r.rows[0].source, "Your input");
  assert.equal(r.rows[1].source, "Example");
  assert.equal(r.rows[4].value, "50%");
  assert.equal(r.flow[2].value, r.flow[1].value / 2);
});
