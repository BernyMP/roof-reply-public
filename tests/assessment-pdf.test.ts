import test from "node:test";
import assert from "node:assert/strict";
import { generateReport } from "../lib/pdf/generate-report";
import {
  SAMPLE_ASSESSMENT,
  DEFAULT_ASSESSMENT,
  type AssessmentAnswers,
} from "../lib/missed-call-assessment";

test("personalized reports stay within two readable pages across edge cases", () => {
  const variants: Partial<AssessmentAnswers>[] = [
    {},
    { existingRecoveryRate: 0 },
    { existingRecoveryRate: 50 },
    { existingRecoveryRate: 100 },
    { missedCallsPerWeek: 0 },
    { averageJobValue: 0 },
    { missedCallsPerWeek: 0.1 },
    { grossMargin: 0 },
    { grossMargin: 30 },
    {
      missedCallsPerWeek: 1000,
      averageJobValue: 1000000,
      realLeadRate: 100,
      engagementRate: 100,
      qualificationRate: 100,
      closeRate: 100,
    },
    { averageJobValue: null },
    { missedCallsPerWeek: null },
    DEFAULT_ASSESSMENT,
    { jobType: "replacements", grossMargin: 30 },
    { process: "both", replyOwner: "no" },
    { callbackSpeed: "fast" },
  ];
  for (const patch of variants)
    for (const company of [
      "",
      "García & Muñoz — Réparation de Toitures",
      "W".repeat(100),
    ]) {
      // The generator rejects content that would overflow; it never adds a third page or shrinks body text.
      const pdf = generateReport(
        { assessment: { ...SAMPLE_ASSESSMENT, ...patch }, company },
        { save: false, date: new Date("2026-09-21T12:00:00Z") },
      );
      assert.equal(pdf.getNumberOfPages(), 2);
      assert.ok(pdf.getFontList().PublicSans.includes("bold"));
      assert.ok(pdf.getFontList().SourceSerif.includes("normal"));
    }
});
