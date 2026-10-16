import test from "node:test";
import assert from "node:assert/strict";
import { editorialBrief } from "./social-editorial.ts";
import { slotTopic } from "./social-agent.ts";
import { SOCIAL_TOPICS } from "./social-content.ts";

for (const cadence of [1, 2] as const) {
  test(`editorial angles rotate across four topic occurrences at ${cadence} post(s) per day`, () => {
    const seen = new Map<string, string[]>();
    for (let offset = 0; offset < 40; offset++) {
      const date = new Date(Date.UTC(2026, 8, 17 + offset))
        .toISOString()
        .slice(0, 10);
      const slots =
        cadence === 1
          ? (["morning"] as const)
          : (["morning", "afternoon"] as const);
      for (const slot of slots) {
        const topic = slotTopic(date, slot);
        const angles = seen.get(topic) ?? [];
        angles.push(editorialBrief(date, slot, topic, cadence).angle);
        seen.set(topic, angles);
      }
    }
    for (const topic of SOCIAL_TOPICS) {
      const angles = seen.get(topic)!;
      assert.ok(angles.length >= 4);
      for (let i = 0; i <= angles.length - 4; i++)
        assert.equal(
          new Set(angles.slice(i, i + 4)).size,
          4,
          `${topic}: repeated angle in a four-post cycle`,
        );
    }
  });
}
