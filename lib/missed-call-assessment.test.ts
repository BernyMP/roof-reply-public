import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAssessment,
  SAMPLE_ASSESSMENT,
  DEFAULT_ASSESSMENT,
  type AssessmentAnswers,
} from "./missed-call-assessment.ts";
import {
  calculateRecoveryEstimate,
  DEFAULT_CALCULATOR_INPUTS,
} from "./calculator-estimates.ts";
import { parseLeadMagnetSubmission } from "./lead-magnet-submission.ts";
const build = (patch: Partial<AssessmentAnswers> = {}) =>
  buildAssessment({ ...SAMPLE_ASSESSMENT, ...patch });
test("assessment, calculator and submitted snapshot agree without rounding", () => {
  for (const missedCallsPerWeek of [5, 6, 0, 0.001, 1000])
    for (const existingRecoveryRate of [null, 0, 50, 100]) {
      const b = build({ missedCallsPerWeek, existingRecoveryRate });
      const expected = calculateRecoveryEstimate({
        ...DEFAULT_CALCULATOR_INPUTS,
        missedCallsPerWeek,
        existingRecoveryRate,
      });
      assert.deepEqual(b.estimate, expected);
      const saved = parseLeadMagnetSubmission({
        assessmentVersion: 1,
        answers: b.answers,
        email: "qa@example.test",
        monthlyRecovery: 999999,
      });
      assert.ok("latestAssessment" in saved);
      assert.equal(
        saved.latestAssessment.monthlyRecovery,
        expected.monthlyRevenue,
      );
      assert.equal(
        saved.latestAssessment.yearlyRecovery,
        expected.yearlyRevenue,
      );
      assert.deepEqual(
        saved.latestAssessment.ruleIds,
        b.findings.map((f) => f.id),
      );
    }
  assert.equal(build({ missedCallsPerWeek: 5 }).estimate?.monthlyRevenue, 4550);
  assert.ok(Math.abs(build().estimate!.yearlyRevenue - 65520) < 1e-8);
});
test("unknown quantities stay distinct from zero and never borrow sample values", () => {
  const noValue = build({ averageJobValue: null });
  assert.equal(noValue.estimate, null);
  assert.ok(noValue.funnel!.yearlyClosedJobs > 0);
  assert.equal(noValue.status, "incomplete");
  const noCalls = build({ missedCallsPerWeek: null });
  assert.equal(noCalls.estimate, null);
  assert.equal(noCalls.funnel, null);
  assert.equal(build({ averageJobValue: 0 }).status, "zero");
  const submitted = parseLeadMagnetSubmission({
    assessmentVersion: 1,
    answers: DEFAULT_ASSESSMENT,
    email: "qa@example.test",
  });
  assert.equal(submitted.averageJobValue, undefined);
  assert.equal(submitted.monthlyRecovery, undefined);
});
test("process findings cover each operational branch without changing revenue", () => {
  const cases: [Partial<AssessmentAnswers>, string][] = [
    [{}, "after-hours"],
    [{ timing: "both" }, "after-hours"],
    [{ timing: "business-hours" }, "callback-window"],
    [{ callbackSpeed: "fast" }, "verify-reconnection"],
    [{ callbackSpeed: "same-day" }, "callback-window"],
    [{ callbackSpeed: "unknown" }, "callback-window"],
    [{ process: "text", replyOwner: "sometimes" }, "reply-ownership"],
    [{ process: "both", replyOwner: "no" }, "reply-ownership"],
    [{ process: "both", replyOwner: "yes" }, "verify-handoff"],
    [{ process: "text", replyOwner: "unknown" }, "verify-process"],
    [{ process: "none" }, "assign-owner"],
    [{ process: "unknown" }, "verify-process"],
  ];
  for (const [patch, id] of cases) {
    const b = build(patch);
    assert.equal(b.findings[1].id, id);
    assert.deepEqual(b.estimate, build().estimate);
  }
});
test("zero and low opportunity take precedence, and full coverage is acknowledged", () => {
  assert.equal(build({ missedCallsPerWeek: 0 }).status, "zero");
  assert.equal(build({ missedCallsPerWeek: 0.1 }).status, "low");
  assert.match(build({ missedCallsPerWeek: 0.1 }).firstAction, /existing team/);
  assert.match(
    build({ existingRecoveryRate: 100 }).firstAction,
    /every eligible inquiry/,
  );
  assert.match(
    build({ existingRecoveryRate: 0 }).resultExplanation,
    /no existing-follow-up deduction/,
  );
  assert.doesNotMatch(
    build({ existingRecoveryRate: 50 }).resultExplanation,
    /unknown|not been deducted/,
  );
});
test("inactive answers are removed and explicit rate provenance survives returning to defaults", () => {
  const b = build({
    process: "text",
    replyOwner: "no",
    callbackSpeed: "next-day",
    suppliedRates: ["closeRate", "closeRate"],
  });
  assert.equal(b.answers.callbackSpeed, null);
  assert.deepEqual(b.answers.suppliedRates, ["closeRate"]);
  assert.equal(
    b.rows.find((r) => r.label === "Qualified inquiry to sale")?.source,
    "Your input",
  );
  assert.equal(
    b.rows.find((r) => r.label === "Reply to follow-up")?.source,
    "Illustrative assumption",
  );
});
test("mixed job values and margin only affect their intended amounts", () => {
  const b = build({ grossMargin: 30 });
  assert.ok(Math.abs(b.grossProfit!.monthly - 1638) < 1e-8);
  assert.deepEqual(b.estimate, build().estimate);
  assert.match(b.costCopy!, /no setup or service fee/);
  assert.match(build({ grossMargin: 0 }).costCopy!, /Paid continuation is agreed separately/);
  assert.equal(build().grossProfit, null);
  assert.ok(
    Math.abs(
      build({ averageJobValue: 1500, jobType: "repairs" }).estimate!
        .monthlyRevenue - 1638,
    ) < 1e-8,
  );
  assert.match(
    build({ jobType: "replacements" }).handoff[0].value,
    /replacement/,
  );
  assert.match(
    build({ jobType: "replacements" }).conversation[1].text,
    /replace/,
  );
});
test("invalid inputs and missing conditional answers are rejected", () => {
  for (const key of [
    "missedCallsPerWeek",
    "averageJobValue",
    "closeRate",
    "grossMargin",
    "existingRecoveryRate",
  ] as const)
    for (const value of [-1, Infinity, NaN])
      assert.throws(() => build({ [key]: value }));
  for (const key of [
    "closeRate",
    "realLeadRate",
    "engagementRate",
    "qualificationRate",
    "grossMargin",
    "existingRecoveryRate",
  ] as const)
    assert.throws(() => build({ [key]: 101 }));
  assert.throws(() => build({ callbackSpeed: null }));
  assert.throws(() => build({ process: "both", replyOwner: null }));
});
