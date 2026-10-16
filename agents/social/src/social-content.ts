import { creativePlanSchema, evidenceLabel } from "./creative-plan.ts";
import { z } from "zod";
import {
  CORE_PROMISE,
  SERVICE_DESCRIPTION,
  marketingFaqs,
} from "@roofreply/brand/marketing";
import { AUDIT_CTA_URL, CORE_PRICE_COPY } from "@roofreply/brand/pricing";

export const SOCIAL_TOPICS = [
  "missed_calls",
  "follow_up",
  "product",
  "example",
  "audit",
] as const;
export const SOCIAL_SOURCES = {
  promise: CORE_PROMISE,
  description: SERVICE_DESCRIPTION,
  capabilities: marketingFaqs.filter(
    (item) => !/cost|assurance/i.test(item.question),
  ),
  pricing: CORE_PRICE_COPY,
};

export function socialSourceVersion() {
  let hash = 2166136261;
  for (const char of JSON.stringify(SOCIAL_SOURCES))
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `sources-${(hash >>> 0).toString(16)}`;
}

export const graphicSchema = z
  .object({
    template: z.enum(["headline", "checklist", "conversation", "editorial"]),
    headline: z.string().trim().min(8).max(72),
    body: z.string().trim().min(10).max(180),
    items: z.array(z.string().trim().min(5).max(180)).max(4),
    labels: z.array(z.string().trim().min(1).max(36)).max(4).optional(),
    evidenceLabel: z
      .enum([
        "ILLUSTRATIVE EXAMPLE",
        "A TEST YOU CAN RUN",
        "SOURCE-GROUNDED EXAMPLE",
      ])
      .optional(),
    design: z
      .enum([
        "cover",
        "split",
        "statement",
        "field-guide",
        "flow",
        "dialogue",
        "comparison",
        "script",
        "decision",
        "annotated",
        "story",
        "calculation",
      ])
      .optional(),
  })
  .strict()
  .superRefine((g, ctx) => {
    const expected = g.template === "headline" ? 0 : 3;
    if (g.template !== "editorial" && g.items.length !== expected)
      ctx.addIssue({
        code: "custom",
        message: `Use ${expected} items for ${g.template}.`,
      });
    if (
      (g.headline.match(/\n/g) || []).length > 1 ||
      /[\r\n]/.test(g.body) ||
      g.items.some((item) => /[\r\n]/.test(item))
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Use at most one headline line break and no body/item line breaks.",
      });
    if (
      [g.headline, g.body, ...g.items].some((text) =>
        text.split(/\s+/).some((word) => word.length > 25),
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "Graphic words must fit the template width.",
      });
  });
export const contentSchema = z
  .object({
    topic: z.enum(SOCIAL_TOPICS),
    hook: z.string().trim().min(8).max(100),
    facebook: z.string().trim().min(50).max(1100),
    instagram: z.string().trim().min(50).max(1100),
    graphic: graphicSchema,
    sources: z
      .array(z.enum(["promise", "description", "capabilities", "pricing"]))
      .min(1)
      .max(4),
    action: z.enum(["none", "save", "reflect", "audit"]).optional(),
    editorial: creativePlanSchema.optional(),
  })
  .strict();
export type SocialContent = z.infer<typeof contentSchema>;
export type SocialGraphic = z.infer<typeof graphicSchema>;
export type SocialPlatform = "facebook" | "instagram";

const DAY = 86_400_000;
export function phoenixDate(now: number): string {
  return new Date(now - 7 * 3_600_000).toISOString().slice(0, 10);
}
export function dueAtForDate(date: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new Error("Invalid publishing date.");
  const due = Date.parse(`${date}T15:00:00.000Z`);
  if (
    !Number.isFinite(due) ||
    new Date(due).toISOString().slice(0, 10) !== date
  )
    throw new Error("Invalid publishing date.");
  return due;
}
export function upcomingDates(now: number, count = 3): string[] {
  let first = dueAtForDate(phoenixDate(now));
  if (now >= first - 15 * 60_000) first += DAY;
  return Array.from({ length: count }, (_, i) => phoenixDate(first + i * DAY));
}
export function topicForDate(date: string) {
  return SOCIAL_TOPICS[
    Math.floor(dueAtForDate(date) / DAY) % SOCIAL_TOPICS.length
  ];
}
export function normalizedHook(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
export function repeatsHook(hook: string, previous: string[]) {
  const words = new Set(normalizedHook(hook).split(" "));
  return previous.some((old) => {
    const other = new Set(normalizedHook(old).split(" "));
    const overlap = [...words].filter((w) => other.has(w)).length;
    return (
      normalizedHook(hook) === normalizedHook(old) ||
      overlap / new Set([...words, ...other]).size >= 0.75
    );
  });
}
export function validateContent(
  input: unknown,
  previous: string[] = [],
): SocialContent {
  const content = contentSchema.parse(input);
  if (
    repeatsHook(content.hook, previous) ||
    repeatsHook(content.graphic.headline, previous)
  )
    throw new Error("Hook repeats recent content.");
  const text = [
    content.hook,
    content.facebook,
    content.instagram,
    content.graphic.headline,
    content.graphic.body,
    ...content.graphic.items,
  ].join("\n");
  if (/https?:\/\/|www\.|@[a-z\d_]|\b[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(text))
    throw new Error(
      "Links and contact details are added by the publisher only.",
    );
  // V1 deliberately keeps generated prices, statistics and performance claims out.
  if (
    /(?:\$|\d\s*%|\bguarantee[sd]?\b|\btestimonial\b|\bour clients?\b|\bwe recovered\b|\bwe booked\b|\bI (?:built|started|founded)\b)/i.test(
      text,
    )
  )
    throw new Error("Unsupported outcome, price, or personal claim.");
  const withoutAudit = text.replace(/20[ -]minute/gi, "");
  if (
    /\d/.test(withoutAudit) &&
    !content.editorial?.candidates[content.editorial.selected].evidence.some(
      (e) => e.kind === "hypothetical" || e.kind === "experiment",
    )
  )
    throw new Error("Only the sourced 20-minute audit may include a number.");
  if (
    !content.editorial &&
    content.topic === "example" &&
    content.graphic.template !== "conversation"
  )
    throw new Error("Example topics need the labeled conversation template.");
  return content;
}
export function auditLink(platform: SocialPlatform, date = "bio") {
  const url = new URL(AUDIT_CTA_URL);
  url.searchParams.set("utm_source", platform);
  url.searchParams.set("utm_medium", "organic_social");
  url.searchParams.set("utm_campaign", "roofreply_audit");
  url.searchParams.set("utm_content", date);
  return url.toString();
}
export function captionFor(
  content: SocialContent,
  platform: SocialPlatform,
  date: string,
) {
  const label = content.editorial
    ? `${evidenceLabel(content.editorial)}\n\n`
    : content.graphic.template === "conversation"
      ? "Illustrative example, not a customer conversation.\n\n"
      : "";
  const cta =
    content.action === "none"
      ? ""
      : content.editorial && content.action !== "audit"
        ? content.editorial.cta
        : content.action === "save"
          ? "Save this for your next team check-in."
          : content.action === "reflect"
            ? "What does this step look like in your roofing business?"
            : platform === "facebook"
              ? `Book a 20-minute missed-call audit: ${auditLink(platform, date)}`
              : "Book a 20-minute missed-call audit through the link in our bio.\n\n#RoofingBusiness #RoofingContractor #RoofReply";
  return `${label}${content[platform]}${cta ? `\n\n${cta}` : ""}`;
}

export const SAMPLE_CONTENT: SocialContent = {
  topic: "missed_calls",
  hook: "On the roof. Away from the phone.",
  facebook:
    "You can be doing great work on a roof while a new inquiry goes to voicemail. Give missed callers a clear next step. RoofReply manages missed-call text follow-up, gathers roofing details, and hands the conversation to your team for inspection follow-up.",
  instagram:
    "On the roof. Away from the phone.\n\nA missed call can still become a conversation. RoofReply follows up by text, gathers the roofing details, and helps your team take the next step toward an inspection.",
  graphic: {
    template: "headline",
    headline: "On the roof.\nAway from the phone.",
    body: "Give missed roofing callers a clear next step with managed text follow-up.",
    items: [],
  },
  sources: ["promise", "capabilities"],
};
