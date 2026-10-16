import test from "node:test";
import assert from "node:assert/strict";
import { formatPhoneNumber } from "./format-phone.ts";

test("formatPhoneNumber formats 10-digit numbers", () => {
  assert.equal(formatPhoneNumber("6025550147"), "(602) 555-0147");
});

test("formatPhoneNumber strips leading country code", () => {
  assert.equal(formatPhoneNumber("+1 (602) 555-0147"), "(602) 555-0147");
});

test("formatPhoneNumber returns original string for non-us-like values", () => {
  assert.equal(formatPhoneNumber("short-code"), "short-code");
});

test("formatPhoneNumber returns fallback when missing", () => {
  assert.equal(formatPhoneNumber(undefined), "Not set");
});
