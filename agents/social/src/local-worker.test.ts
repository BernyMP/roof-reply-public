import test from "node:test";
import assert from "node:assert/strict";
import { subscriptionFailure, generationMessage } from "./local-worker.ts";
test("subscription errors are classified without disclosing provider details", () => {
  const error = Object.assign(new Error("Bad Request"), { statusCode: 400, responseBody: "model is not supported for this account private-value" });
  assert.match(subscriptionFailure(error)!, /sign-in or model access/);
  assert.ok(!subscriptionFailure(error)!.includes("private-value"));
  assert.match(subscriptionFailure(Object.assign(new Error("Too Many Requests"), { statusCode: 429 }))!, /allowance/);
  assert.equal(subscriptionFailure(new Error("connection lost")), undefined);
});
test("operator drafts go directly to review without rewriting", () => {
  assert.match(generationMessage(2, true), /version 2/);
  assert.match(generationMessage(2, true), /Do not research, rewrite/);
  assert.match(generationMessage(0, false), /research within its limits/);
});
