import { z } from "zod";
import type { SocialContent } from "./social-content.ts";

export const CREATIVE_VERSION = "creative-v2";
const short = z.string().trim().min(12).max(500);
export const creativeFormats = [
  "comparison",
  "script",
  "decision",
  "annotated",
  "story",
  "calculation",
] as const;
export const stageSchema = z.enum([
  "attraction",
  "trust",
  "evaluation",
  "onboarding",
]);
export const evidenceSchemaV2 = z
  .object({
    kind: z.enum(["approved-fact", "hypothetical", "experiment", "research"]),
    reference: z.string().min(1).max(2000),
    supports: short,
    limitation: short,
  })
  .strict();
export const candidateSchema = z
  .object({
    audience: short,
    situation: short,
    lesson: short,
    reward: short,
    stage: stageSchema,
    evidence: z.array(evidenceSchemaV2).min(1).max(4),
  })
  .strict();
export const creativePlanSchema = z
  .object({
    candidates: z.array(candidateSchema).length(3),
    selected: z.number().int().min(0).max(2),
    selectionReason: short,
    hook: z.string().trim().min(8).max(100),
    retention: short,
    businessRelevance: short,
    format: z.enum(creativeFormats),
    visualPurpose: short,
    action: z.enum(["none", "save", "reflect", "audit"]),
    cta: z.string().trim().max(140),
    originality: short,
    reinforces: z.array(z.string().min(1).max(100)).max(5),
    newApplication: z.string().trim().max(500),
    calculation: z
      .object({
        count: z.number().int().min(1).max(1000),
        minutesEach: z.number().min(0.1).max(120),
        totalMinutes: z.number().min(0.1).max(120000),
        assumptions: short,
      })
      .strict()
      .nullable()
      .optional(),
  })
  .strict();
export type CreativePlan = z.infer<typeof creativePlanSchema>;
export const reviewChecksSchema = z.object(
  Object.fromEntries(
    [
      "relevance",
      "hook",
      "payoff",
      "plainLanguage",
      "originality",
      "evidence",
      "visualFit",
      "cta",
    ].map((k) => [
      k,
      z
        .object({
          pass: z.boolean(),
          reason: z.string().trim().min(8).max(240),
        })
        .strict(),
    ]),
  ) as Record<
    | "relevance"
    | "hook"
    | "payoff"
    | "plainLanguage"
    | "originality"
    | "evidence"
    | "visualFit"
    | "cta",
    z.ZodObject<{ pass: z.ZodBoolean; reason: z.ZodString }>
  >,
);

export const creativeEvidenceCatalog = [
  {
    id: "capabilities",
    kind: "approved-fact",
    source: "packages/brand/src/marketing-copy.ts:marketingFaqs",
    supports:
      "Exact capabilities, eligible prospect definition, reporting, caller routing and buyer questions in approved FAQs.",
    limitation:
      "An FAQ is an approved claim, not a customer quote, demonstrated result or evidence of growth.",
  },
  {
    id: "description",
    kind: "approved-fact",
    source: "packages/brand/src/marketing-copy.ts:SERVICE_DESCRIPTION",
    supports: "Approved audience and service description.",
    limitation:
      "Does not establish customer outcomes or prescribe public topics.",
  },
  {
    id: "promise",
    kind: "approved-fact",
    source: "packages/brand/src/marketing-copy.ts:CORE_PROMISE",
    supports: "Approved service scope, subject to FAQ qualifications.",
    limitation: "No quantitative outcomes or guarantees.",
  },
  {
    id: "guided-demo-procedure",
    kind: "experiment",
    source: "README.md",
    supports:
      "A documented procedure for a consented demonstration and observations to collect.",
    limitation:
      "A procedure is not an executed test result. Do not claim it ran or expose test contacts.",
  },
  {
    id: "illustration",
    kind: "hypothetical",
    source: "Clearly labeled constructed example",
    supports:
      "Scripts, sample decision rules, fictional notes and illustrative arithmetic.",
    limitation:
      "Never a customer conversation, founder observation, testimonial or observed result.",
  },
  {
    id: "owner-experiment",
    kind: "experiment",
    source: "Clearly labeled test the reader can conduct",
    supports:
      "Specific steps and observations using the owner's own consenting test phone.",
    limitation:
      "No claim the experiment has run or predicts performance; no roof inspection or repair instructions.",
  },
] as const;
const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
export type IdeaHistory = {
  id: string;
  at: number;
  topic: string;
  lesson: string | null;
  situation: string | null;
  stage: string | null;
  hook: string;
  reward: string | null;
  evidence: CreativePlan["candidates"][number]["evidence"] | null;
  format: string;
  cta: string | null;
  imageText: string[];
  captions: string[];
};
export function ideaHistory(
  id: string,
  at: number,
  content: SocialContent,
): IdeaHistory {
  const p = content.editorial,
    c = p?.candidates[p.selected];
  return {
    id,
    at,
    topic: content.topic,
    lesson: c?.lesson ?? null,
    situation: c?.situation ?? null,
    stage: c?.stage ?? null,
    hook: content.hook,
    reward: c?.reward ?? null,
    evidence: c?.evidence ?? null,
    format: content.graphic.design ?? content.graphic.template,
    cta: p?.cta ?? content.action ?? null,
    imageText: [
      content.graphic.headline,
      content.graphic.body,
      ...content.graphic.items,
    ],
    captions: [content.facebook, content.instagram],
  };
}
export function validateCreativePlan(
  input: unknown,
  history: IdeaHistory[] = [],
  retainedUrls: string[] = [],
  allowOnboarding = false,
) {
  const p = creativePlanSchema.parse(input),
    c = p.candidates[p.selected];
  for (const field of ["lesson", "reward", "situation"] as const)
    if (new Set(p.candidates.map((c) => normalize(c[field]))).size !== 3)
      throw Error(
        `Candidates need distinct ${field}s, not paraphrased headlines.`,
      );
  for (const candidate of p.candidates) {
    if (candidate.stage === "onboarding" && !allowOnboarding)
      throw Error(
        "Onboarding requires a separate explicit customer-content assignment.",
      );
    for (const ev of candidate.evidence) {
      if (ev.kind === "research") {
        if (!retainedUrls.includes(ev.reference))
          throw Error(
            "Research must cite a retained page, not a search snippet.",
          );
      } else if (
        !creativeEvidenceCatalog.some(
          (s) => s.id === ev.reference && s.kind === ev.kind,
        )
      )
        throw Error("Unknown evidence reference or unsupported evidence kind.");
    }
  }
  if (p.reinforces.some((id) => !history.some((h) => h.id === id)))
    throw Error("Reinforcement must identify a real recent post.");
  if (p.reinforces.length && p.newApplication.length < 30)
    throw Error("Explain the meaningfully new application for reinforcement.");
  const repeats = history.filter(
    (h) => h.lesson && normalize(h.lesson) === normalize(c.lesson),
  );
  if (repeats.some((h) => !p.reinforces.includes(h.id)))
    throw Error(
      "Repeated lesson needs an explicit new application and reference.",
    );
  if (p.action === "none" && p.cta !== "")
    throw Error("No-CTA posts must leave cta empty.");
  if (p.action !== "none" && !p.cta)
    throw Error("State the relevant next step or choose none.");
  if (p.format === "calculation") {
    const n = p.calculation;
    if (!n || Math.abs(n.count * n.minutesEach - n.totalMinutes) > 0.000001)
      throw Error(
        "Illustrative calculation must have explicit assumptions and correct arithmetic.",
      );
    if (!c.evidence.some((e) => e.kind === "hypothetical"))
      throw Error(
        "Calculations need a hypothetical label, never a claimed business result.",
      );
  } else if (p.calculation)
    throw Error("Calculation assumptions require the calculation format.");
  return p;
}
export function creativeBrief(
  date: string,
  slot: "morning" | "afternoon",
  cadence: 1 | 2 = 1,
) {
  const ordinal =
    Math.floor(Date.parse(`${date}T15:00:00Z`) / 86400000) * cadence +
    (cadence === 2 && slot === "afternoon" ? 1 : 0);
  const stage = (
    [
      "attraction",
      "attraction",
      "trust",
      "attraction",
      "evaluation",
      "attraction",
      "trust",
    ] as const
  )[ordinal % 7];
  return {
    version: CREATIVE_VERSION,
    stage,
    audience: "Owner-led residential roofing companies with inbound inquiries.",
    objective:
      "Reward attention with a concrete script, example, diagnostic or decision the reader can use before buying.",
    instruction:
      "Generate three different situations and rewards before selecting a hook. Topic is an internal tag, not a prescribed lesson or layout. Product facts constrain claims, not topics. Prefer the selected plan over any older daily research angle.",
  };
}
export function evidenceLabel(p: CreativePlan) {
  const e = p.candidates[p.selected].evidence;
  return e.some((e) => e.kind === "hypothetical")
    ? "ILLUSTRATIVE EXAMPLE"
    : e.some((e) => e.kind === "experiment")
      ? "A TEST YOU CAN RUN"
      : "SOURCE-GROUNDED EXAMPLE";
}
export function validateCreativeDraft(
  content: SocialContent,
  plan: CreativePlan,
) {
  if (
    JSON.stringify(creativePlanSchema.parse(content.editorial)) !==
    JSON.stringify(creativePlanSchema.parse(plan))
  )
    throw Error("Draft must use its saved editorial plan.");
  if (
    content.hook !== plan.hook ||
    content.graphic.design !== plan.format ||
    content.action !== plan.action
  )
    throw Error(
      "Hook, format and action must match the selected plan; replan before changing the idea.",
    );
  if (plan.format === "calculation" && plan.calculation) {
    const values = (
      content.graphic.items[1]?.match(/\d+(?:\.\d+)?/g) ?? []
    ).map(Number);
    const { count, minutesEach, totalMinutes } = plan.calculation;
    if (
      JSON.stringify(values) !==
      JSON.stringify([count, minutesEach, totalMinutes])
    )
      throw Error(
        "Displayed equation must use the saved assumptions and correct total.",
      );
  }
  if (content.graphic.evidenceLabel !== evidenceLabel(plan))
    throw Error("Use the required visible evidence label.");
  const text = [
    content.facebook,
    content.instagram,
    ...content.graphic.items,
  ].join(" ");
  if (
    /exact (?:property|address)|which property/i.test(
      content.hook + " " + content.graphic.headline,
    )
  ) {
    const request =
      /full (?:street |property )?address.{0,80}(?:city|town)|street (?:address|number).{0,80}(?:city|town)/i.test(
        text,
      );
    const complete =
      /\b\d{1,5} [A-Za-z ]{2,30}(?:Street|St|Lane|Ln|Road|Rd|Avenue|Ave),? [A-Za-z ]{2,30},? [A-Z]{2} \d{5}\b/.test(
        text,
      );
    if (!request && !complete)
      throw Error(
        "Exact-property payoff needs a complete illustrative address or a request for full street address and city/town.",
      );
  }
}

export function validatePreviewBrief(input: unknown) {
  return z
    .object({
      stage: stageSchema,
      startingPoint: z.string().min(20).max(1200),
      preferredFormat: z.enum(creativeFormats),
    })
    .strict()
    .parse(input);
}
