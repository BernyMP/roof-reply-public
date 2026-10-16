import test from "node:test";
import assert from "node:assert/strict";
import { parseLeadMagnetSubmission } from "./lead-magnet-submission.ts";
import { DEFAULT_CALCULATOR_INPUTS } from "./calculator-estimates.ts";
const lead = {
  ...DEFAULT_CALCULATOR_INPUTS,
  name: " Owner ",
  email: "OWNER@EXAMPLE.COM",
  monthlyRecovery: -5,
  yearlyRecovery: -6,
};
test("version 2 submissions recompute tampered totals with the shared model", () => {
  const result = parseLeadMagnetSubmission({
    ...lead,
    existingRecoveryRate: 50,
  });
  assert.ok(Math.abs(result.monthlyRecovery! - 2730) < 1e-8);
  assert.ok(Math.abs(result.yearlyRecovery! - 32760) < 1e-8);
  assert.equal(result.name, "Owner");
  assert.equal(result.email, "owner@example.com");
});
test("legacy submissions keep their existing contract and totals", () => {
  const { calculationVersion, existingRecoveryRate, ...old } = lead;
  void calculationVersion;
  void existingRecoveryRate;
  const result = parseLeadMagnetSubmission({
    ...old,
    monthlyRecovery: 4200,
    yearlyRecovery: 54600,
  });
  assert.equal(result.monthlyRecovery, 4200);
  assert.equal(result.yearlyRecovery, 54600);
  assert.equal("calculationVersion" in result, false);
  assert.doesNotThrow(() =>
    parseLeadMagnetSubmission({ ...old, name: "A".repeat(101) }),
  );
});
test("new requests require a known-or-unknown follow-up value and valid inputs", () => {
  for (const patch of [
    { existingRecoveryRate: undefined },
    { existingRecoveryRate: 101 },
    { closeRate: 101 },
    { averageJobValue: NaN },
    { calculationVersion: 3 },
    { name: "A".repeat(101) },
  ])
    assert.throws(() => parseLeadMagnetSubmission({ ...lead, ...patch }));
  assert.doesNotThrow(() =>
    parseLeadMagnetSubmission({ ...lead, existingRecoveryRate: null }),
  );
});
