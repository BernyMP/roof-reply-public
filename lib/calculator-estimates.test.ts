import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateRecoveryEstimate,
  DEFAULT_CALCULATOR_INPUTS,
} from "./calculator-estimates.ts";
const near = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test("five-call example reconciles monthly and annual revenue and job equivalents", () => {
  const e = calculateRecoveryEstimate({
    ...DEFAULT_CALCULATOR_INPUTS,
    missedCallsPerWeek: 5,
  });
  near(e.monthlyRevenue, 4550);
  near(e.yearlyRevenue, 54600);
  near(e.monthlyClosedJobs, 0.91);
  near(e.yearlyClosedJobs, 10.92);
});
test("six-call default uses an average month, without rounding intermediate stages", () => {
  const e = calculateRecoveryEstimate(DEFAULT_CALCULATOR_INPUTS);
  near(e.monthlyRevenue, 5460);
  near(e.yearlyRevenue, 65520);
  near(e.monthlyRevenue * 12, e.yearlyRevenue);
  near(e.monthlyClosedJobs, 1.092);
  assert.equal(e.existingFollowUpKnown, false);
});
test("existing follow-up is separate from legitimate share and excluded once", () => {
  const base = { ...DEFAULT_CALCULATOR_INPUTS, missedCallsPerWeek: 5 };
  const e = calculateRecoveryEstimate({ ...base, existingRecoveryRate: 50 });
  near(e.yearlyLegitimateInquiries, 104);
  near(e.yearlyEligibleInquiries, 52);
  near(e.monthlyRevenue, 2275);
  near(e.yearlyRevenue, 27300);
  assert.equal(e.existingFollowUpKnown, true);
  const knownZero = calculateRecoveryEstimate({
    ...base,
    existingRecoveryRate: 0,
  });
  assert.equal(knownZero.existingFollowUpKnown, true);
  near(knownZero.monthlyRevenue, 4550);
  const full = calculateRecoveryEstimate({
    ...base,
    existingRecoveryRate: 100,
  });
  assert.equal(full.monthlyRevenue, 0);
  assert.equal(full.yearlyEligibleInquiries, 0);
});
test("every zero conversion stage produces a sensible zero result", () => {
  for (const key of [
    "missedCallsPerWeek",
    "averageJobValue",
    "closeRate",
    "realLeadRate",
    "engagementRate",
    "qualificationRate",
  ] as const) {
    const e = calculateRecoveryEstimate({
      ...DEFAULT_CALCULATOR_INPUTS,
      [key]: 0,
    });
    assert.equal(e.monthlyRevenue, 0);
    assert.equal(e.yearlyRevenue, 0);
  }
});
test("non-finite, negative and out-of-range inputs are rejected", () => {
  for (const key of [
    "closeRate",
    "realLeadRate",
    "engagementRate",
    "qualificationRate",
    "existingRecoveryRate",
  ] as const) {
    for (const value of [-1, 101, NaN, Infinity])
      assert.throws(
        () =>
          calculateRecoveryEstimate({
            ...DEFAULT_CALCULATOR_INPUTS,
            [key]: value,
          }),
        RangeError,
      );
  }
  for (const key of ["averageJobValue", "missedCallsPerWeek"] as const)
    for (const value of [-1, NaN, Infinity])
      assert.throws(
        () =>
          calculateRecoveryEstimate({
            ...DEFAULT_CALCULATOR_INPUTS,
            [key]: value,
          }),
        RangeError,
      );
});
