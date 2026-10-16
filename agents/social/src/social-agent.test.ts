import test from "node:test";
import assert from "node:assert/strict";
import { dueAtForSlot, upcomingSlots, slotTracking, validateAgentDraft, publicResearchUrl } from "./social-agent.ts";
import { SAMPLE_CONTENT } from "./social-content.ts";
import { matchesSecret } from "./social-agent-auth.ts";
import { publicAddress } from "../server/research.ts";
test("two Phoenix slots keep legacy morning timestamps and cross year boundaries",()=>{
  assert.equal(new Date(dueAtForSlot("2026-12-31","afternoon")).toISOString(),"2026-12-31T23:30:00.000Z");
  assert.equal(upcomingSlots(Date.parse("2026-12-31T23:14:59Z"))[0].slot,"afternoon");
  assert.equal(upcomingSlots(Date.parse("2026-12-31T23:15:00Z"))[0].date,"2027-01-01");
  const slots=upcomingSlots(Date.parse("2026-12-31T15:00:00Z"));assert.equal(slots.length,6);assert.equal(slots[0].slot,"afternoon");assert.equal(slots[1].date,"2027-01-01");
  assert.equal(slotTracking("2026-01-01"),"2026-01-01");assert.equal(slotTracking("2026-01-01","afternoon"),"2026-01-01-afternoon");
});
test("agent validates source and style restrictions before a review",()=>{
  assert.throws(()=>validateAgentDraft({...SAMPLE_CONTENT,facebook:"We guarantee a game-changing result for your roofing business."}));
  assert.throws(()=>validateAgentDraft(SAMPLE_CONTENT,[SAMPLE_CONTENT.hook]));
  for (const facebook of [
    "Automating follow-ups can drastically improve your chances of converting leads into projects.",
    "RoofReply can increase your revenue with automatic roofing follow-up.",
    "Transform your process and keep your revenue flowing with automated follow-ups.",
  ]) assert.throws(()=>validateAgentDraft({...SAMPLE_CONTENT,facebook}), /unsupported performance/);
  assert.doesNotThrow(()=>validateAgentDraft(SAMPLE_CONTENT));
});
test("research rejects private addresses and non-HTTPS destinations",()=>{
  for(const url of ["http://example.com","https://127.0.0.1","https://[::1]","https://metadata.internal","https://user:pass@example.com"])assert.throws(()=>publicResearchUrl(url));
  for(const ip of ["127.0.0.1","10.2.0.1","169.254.169.254","172.16.0.1","192.168.1.1","::1","::ffff:127.0.0.1"])assert.equal(publicAddress(ip),false);
  assert.equal(publicAddress("8.8.8.8"),true);
});
test("bridge authentication fails closed and accepts only the exact dedicated secret",async()=>{
  const secret="test-secret-".repeat(4);
  assert.equal(await matchesSecret(`Bearer ${secret}`,secret),true);
  assert.equal(await matchesSecret(`Bearer ${secret}x`,secret),false);
  assert.equal(await matchesSecret(null,secret),false);
  assert.equal(await matchesSecret("Bearer short","short"),false);
});
