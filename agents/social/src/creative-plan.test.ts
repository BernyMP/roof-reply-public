import test from "node:test";
import assert from "node:assert/strict";
import {
  validateCreativePlan,
  validateCreativeDraft,
  ideaHistory,
  creativeBrief,
  reviewChecksSchema,
} from "./creative-plan.ts";
import { validateAgentDraft } from "./social-agent.ts";
import { captionFor } from "./social-content.ts";
import { samplePlan, sampleCreativeContent } from "./fixtures/creative.ts";

test("planning rejects copied rewards, unretained evidence and unexplained reinforcement", () => {
  const p = samplePlan();
  p.candidates[1].reward = p.candidates[0].reward;
  assert.throws(() => validateCreativePlan(p), /distinct/);
  const q = samplePlan();
  q.candidates[0].evidence[0] = {
    ...q.candidates[0].evidence[0],
    kind: "research",
    reference: "https://example.com/study",
  };
  assert.throws(() => validateCreativePlan(q), /retained/);
  const h = ideaHistory("prior", 1, sampleCreativeContent());
  assert.throws(
    () => validateCreativePlan(samplePlan(), [h]),
    /Repeated lesson/,
  );
  const r = samplePlan();
  r.reinforces = ["prior"];
  r.newApplication =
    "A different case demonstrates exactly how to complete the note.";
  assert.doesNotThrow(() => validateCreativePlan(r, [h]));
});
test("drafts match their plans, no CTA is appended, and legacy missing history stays unknown", () => {
  const c = sampleCreativeContent();
  assert.doesNotThrow(() => validateAgentDraft(c));
  assert.doesNotThrow(() => validateCreativeDraft(c, c.editorial!));
  assert.equal(
    captionFor(c, "facebook", "2026-09-30"),
    `ILLUSTRATIVE EXAMPLE\n\n${c.facebook}`,
  );
  const changed = {
    ...c,
    hook: "A new unsupported idea substituted after planning",
  };
  assert.throws(() => validateCreativeDraft(changed, c.editorial!), /match/);
  const legacy = { ...c, editorial: undefined };
  assert.equal(ideaHistory("old", 1, legacy).lesson, null);
});
test("exact-property reward requires a complete example or the precise question", () => {
  const c = sampleCreativeContent();
  c.hook = "Which property needs the callback?";
  c.editorial!.hook = c.hook;
  c.graphic.items = [
    "The house on Maple Street.",
    "Call the homeowner about a roof leak.",
  ];
  assert.throws(() => validateCreativeDraft(c, c.editorial!), /Exact-property/);
  c.graphic.items[1] =
    "What is the full street address, including the city or town?";
  assert.doesNotThrow(() => validateCreativeDraft(c, c.editorial!));
});
test("illustrative arithmetic requires correct assumptions and does not relax outcome bans", () => {
  const p = samplePlan();
  p.format = "calculation";
  p.calculation = {
    count: 4,
    minutesEach: 5,
    totalMinutes: 21,
    assumptions:
      "Assume four callbacks each taking five minutes, for illustration.",
  };
  assert.throws(() => validateCreativePlan(p), /arithmetic/);
  p.calculation.totalMinutes = 20;
  assert.doesNotThrow(() => validateCreativePlan(p));
  const c = sampleCreativeContent();
  c.facebook =
    "A fictional example: 4 callbacks at 5 minutes each require 20 minutes. These are assumptions, not measured performance.";
  assert.doesNotThrow(() => validateAgentDraft(c));
  c.facebook = "Our clients recovered 90% more roofing jobs.";
  assert.throws(() => validateAgentDraft(c));
});
test("public audience mix contains four attraction, two trust and one evaluation slot", () => {
  const stages = Array.from(
    { length: 7 },
    (_, i) => creativeBrief(`2026-09-${17 + i}`, "morning").stage,
  );
  assert.equal(stages.filter((x) => x === "attraction").length, 4);
  assert.equal(stages.filter((x) => x === "trust").length, 2);
  assert.equal(stages.filter((x) => x === "evaluation").length, 1);
  assert.equal(Object.keys(reviewChecksSchema.shape).length, 8);
});

test("format contracts allow distinct structures and bound large calculation text", () => {
  for (const [format, count] of Object.entries({
    comparison: 2,
    script: 1,
    decision: 3,
    story: 3,
    annotated: 4,
    calculation: 3,
  })) {
    const c = sampleCreativeContent();
    c.graphic.design = format as typeof c.graphic.design;
    c.graphic.items = Array.from(
      { length: count },
      () => "A concrete useful example.",
    );
    c.graphic.labels = Array.from({ length: count }, () => "Example");
    assert.doesNotThrow(() => validateAgentDraft(c));
    c.graphic.items.pop();
    assert.throws(() => validateAgentDraft(c), /labeled items/);
  }
  const c = sampleCreativeContent();
  c.graphic.design = "calculation";
  c.graphic.items = [
    "Assume four calls.",
    "A long paragraph instead of the short arithmetic equation.",
    "Illustrative only.",
  ];
  c.graphic.labels = ["Inputs", "Operation", "Meaning"];
  assert.throws(() => validateAgentDraft(c), /short equation/);
});

test("strict model tool schemas can express no calculation with null", () => {
  const p = samplePlan();
  p.calculation = null;
  assert.doesNotThrow(() => validateCreativePlan(p));
  p.format = "calculation";
  assert.throws(() => validateCreativePlan(p), /arithmetic/);
});

test("calculation image must match the verified assumptions", () => {
  const c = sampleCreativeContent();
  c.editorial!.format = "calculation";
  c.editorial!.calculation = {
    count: 4,
    minutesEach: 5,
    totalMinutes: 20,
    assumptions: "Four fictional calls each need five minutes.",
  };
  c.graphic.design = "calculation";
  c.graphic.items = [
    "Four fictional calls at five minutes each",
    "4 × 5 = 25 minutes",
    "Illustrative workload only",
  ];
  c.graphic.labels = ["Inputs", "Equation", "Meaning"];
  assert.throws(
    () => validateCreativeDraft(c, c.editorial!),
    /Displayed equation/,
  );
  c.graphic.items[1] = "4 × 5 = 20 minutes";
  assert.doesNotThrow(() => validateCreativeDraft(c, c.editorial!));
});
