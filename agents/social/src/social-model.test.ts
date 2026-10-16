import test from "node:test";
import assert from "node:assert/strict";
import {
  EDITORIAL_MODEL,
  RESEARCH_MODEL,
  socialModelPolicy,
} from "./social-model.ts";

test("model reservations cover a full context and output, including reasoning tokens", () => {
  for (const policy of [EDITORIAL_MODEL, RESEARCH_MODEL]) {
    const maximumCost =
      (policy.contextTokens * policy.inputUsdPerMillion +
        policy.outputTokens * policy.outputUsdPerMillion) /
      1e6;
    assert.ok(policy.reserveUsd >= maximumCost);
  }
  // Stay below GPT-5.4's long-context price threshold.
  assert.ok(EDITORIAL_MODEL.contextTokens < 272000);
});

test("only approved models receive reservations; legacy calls keep their existing tariff", () => {
  assert.equal(socialModelPolicy(), RESEARCH_MODEL);
  assert.equal(socialModelPolicy(EDITORIAL_MODEL.id), EDITORIAL_MODEL);
  assert.throws(() => socialModelPolicy("unapproved-model"));
});
