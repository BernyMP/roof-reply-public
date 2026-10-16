export * from "./creative-plan.ts";
import {
  SOCIAL_LIBRARY,
  LIBRARY_REVIEWED_SOURCE_VERSION,
} from "./social-library.ts";
import { socialSourceVersion } from "./social-content.ts";
import { z } from "zod";
import { RESEARCH_MODEL } from "./social-model.ts";
import { validateEditorialDesign } from "./social-editorial.ts";
export { socialModelPolicy } from "./social-model.ts";
export {
  editorialBrief,
  EDITORIAL_VERSION,
  EXPERIMENT_BUDGET_USD,
  EXPERIMENT_DAYS,
} from "./social-editorial.ts";
import {
  contentSchema,
  dueAtForDate,
  phoenixDate,
  SOCIAL_TOPICS,
  validateContent,
  type SocialContent,
} from "./social-content.ts";

export const AGENT_LIMITS = Object.freeze({
  modelMonthlyUsd: 10,
  searchMonthlyUsd: 2,
  modelCallReserveUsd: RESEARCH_MODEL.reserveUsd,
  searchCallUsd: 0.02,
  // Five skills plus image inspection must fit within each of three reviews.
  // Dollar reservations and the overall session deadline still bound spending.
  maxModelCalls: 60,
  maxDrafts: 3,
  searchesPerDay: 3,
  fetchesPerDay: 5,
});
export const slotSchema = z.enum(["morning", "afternoon"]);
export type SocialSlot = z.infer<typeof slotSchema>;
export function assertRevisionReviewTarget(requestId: string, version: number) {
  const prior = /^revise-.+-(\d+)$/.exec(requestId);
  if (prior && version <= Number(prior[1]))
    throw new Error(
      "Save the requested new revision before reviewing it; the copied approval is historical.",
    );
}
export function dueAtForSlot(date: string, slot: SocialSlot = "morning") {
  return dueAtForDate(date) + (slot === "afternoon" ? 8.5 * 3600000 : 0);
}
export function slotTracking(date: string, slot?: SocialSlot) {
  return slot ? `${date}-${slot}` : date;
}
export function upcomingSlots(now: number, days = 3) {
  const result: { date: string; slot: SocialSlot; dueAt: number }[] = [];
  for (let day = 0; day <= days; day++) {
    const date = phoenixDate(now + day * 86400000);
    for (const slot of ["morning", "afternoon"] as const) {
      const dueAt = dueAtForSlot(date, slot);
      if (dueAt > now + 900000 && result.length < days * 2)
        result.push({ date, slot, dueAt });
    }
  }
  return result;
}
export function slotTopic(date: string, slot: SocialSlot) {
  return SOCIAL_TOPICS[
    (Math.floor(dueAtForDate(date) / 86400000) * 2 +
      (slot === "afternoon" ? 1 : 0)) %
      SOCIAL_TOPICS.length
  ];
}
export function styleIssues(content: SocialContent): string[] {
  const text = [
    content.facebook,
    content.instagram,
    content.hook,
    content.graphic.headline,
    content.graphic.body,
    ...content.graphic.items,
  ].join(" ");
  return /\b(delve|leverage|game.chang(?:er|ing)|unlock your|revolutioniz\w*)\b/i.test(
    text,
  )
    ? ["Replace vague promotional wording with plain, specific language."]
    : [];
}
export function validateAgentDraft(input: unknown, previous: string[] = []) {
  const content = validateContent(contentSchema.parse(input), previous);
  validateEditorialDesign(content);
  const prose = [
    content.hook,
    content.facebook,
    content.instagram,
    content.graphic.headline,
    content.graphic.body,
    ...content.graphic.items,
  ].join(" ");
  if (
    /\b(?:drastically|outperform\w*|better results|more (?:leads|jobs|revenue)|revenue flowing)\b|\b(?:increase|boost|maximize|grow|improve)\w*\s+(?:your\s+)?(?:revenue|profit|sales|conversion)\b/i.test(
      prose,
    )
  )
    throw new Error(
      "Describe verified capabilities; remove unsupported performance and revenue claims.",
    );
  const issues = styleIssues(content);
  if (issues.length) throw new Error(issues.join(" "));
  return content;
}
export const evidenceSchema = z
  .object({
    url: z.string().url().max(2000),
    title: z.string().max(200),
    excerpt: z.string().max(4000),
    fetchedAt: z.number(),
  })
  .strict();
export function publicResearchUrl(raw: string): URL {
  const u = new URL(raw);
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    (u.port && u.port !== "443") ||
    /(^|\.)(localhost|local|internal|test)$/.test(u.hostname) ||
    /^[\d.]+$/.test(u.hostname) ||
    u.hostname.includes(":") ||
    !u.hostname.includes(".")
  )
    throw new Error("Research requires a public HTTPS hostname.");
  return u;
}

// The reviewed library remains the only fallback; no uncapped model call.
export function selectSlotLibraryContent(
  date: string,
  slot: SocialSlot,
  previous: string[],
) {
  if (socialSourceVersion() !== LIBRARY_REVIEWED_SOURCE_VERSION)
    throw new Error("Library needs a source review.");
  const candidates = SOCIAL_LIBRARY.filter(
    (c) => c.topic === slotTopic(date, slot),
  );
  const start =
    Math.floor(dueAtForSlot(date, slot) / 86400000) % candidates.length;
  for (let i = 0; i < candidates.length; i++) {
    try {
      return validateContent(
        candidates[(start + i) % candidates.length],
        previous,
      );
    } catch {
      /* Continue to the next approved, non-repeating candidate. */
    }
  }
  throw new Error(
    "Approved library exhausted under the 30-day repeat restriction.",
  );
}
