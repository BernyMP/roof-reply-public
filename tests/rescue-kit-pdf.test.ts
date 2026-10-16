import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generateRescueKit } from "../lib/pdf/generate-rescue-kit";
import { trackingCsv } from "../lib/rescue-kit";

test("committed downloads match their generator and use embedded readable fonts", () => {
  const pdf = generateRescueKit();
  assert.ok(pdf.getNumberOfPages() >= 4 && pdf.getNumberOfPages() <= 12);
  assert.ok(pdf.getFontList().PublicSans.includes("bold"));
  assert.ok(pdf.getFontList().SourceSerif.includes("normal"));
  assert.deepEqual(Buffer.from(pdf.output("arraybuffer")), readFileSync("public/downloads/roofreply-missed-call-rescue-kit.pdf"));
  assert.equal(trackingCsv(), readFileSync("public/downloads/roofreply-missed-call-tracking-sheet.csv", "utf8"));
});
