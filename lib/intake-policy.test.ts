import test from "node:test";
import assert from "node:assert/strict";
import {
  hasIntakeDetails,
  needsNumericClarification,
  repeatsKnownQuestion,
  nextIntakeQuestion,
} from "./intake-policy.ts";
import { demoOpening, isClosingAcknowledgment } from "./demo-conversation.ts";
test("complete intake stops questions and corrections do not erase known details", () => {
  const details = {
    name: "Alex",
    location: "Tempe",
    jobType: "Replacement",
    urgency: "low" as const,
  };
  assert.equal(hasIntakeDetails(details), true);
  assert.equal(hasIntakeDetails({ ...details, name: undefined }), false);
  assert.equal(
    repeatsKnownQuestion("What name should I pass to the team?", details),
    true,
  );
  assert.equal(nextIntakeQuestion(details).includes("?"), false);
});
test("ambiguous severity is clarified without treating roof age or an address as an emergency", () => {
  assert.equal(
    needsNumericClarification("Only 1", "Are you seeing leaks inside?"),
    true,
  );
  assert.equal(needsNumericClarification("12", "How old is the roof?"), false);
  assert.equal(
    needsNumericClarification("123 Oak St", "What is the address?"),
    false,
  );
});
test("demo greeting identifies the simulation once and closing acknowledgments are quiet", () => {
  assert.equal(
    (demoOpening("Acme Roofing").match(/RoofReply/g) || []).length,
    1,
  );
  assert.match(demoOpening("Acme Roofing"), /STOP/);
  assert.equal(isClosingAcknowledgment("Okay"), true);
  assert.equal(isClosingAcknowledgment("Okay thanks!"), true);
  assert.equal(isClosingAcknowledgment("Done!"), true);
  assert.equal(isClosingAcknowledgment("Actually my name is Jordan"), false);
});
