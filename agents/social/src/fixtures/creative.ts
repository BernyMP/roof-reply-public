import type { CreativePlan } from "../creative-plan.ts";
import type { SocialContent } from "../social-content.ts";
export function samplePlan(): CreativePlan {
  return {
    candidates: [
      {
        audience: "Residential roofing company owner",
        situation: "The office gives a salesperson a vague callback note",
        lesson:
          "A complete callback note includes the actual homeowner question",
        reward: "Compare vague and specific notes and copy the better note",
        stage: "attraction",
        evidence: [
          {
            kind: "hypothetical",
            reference: "illustration",
            supports: "Constructed notes illustrate the useful difference",
            limitation:
              "Not a customer record or evidence of a business outcome",
          },
        ],
      },
      {
        audience: "Roofing office manager returning missed calls",
        situation: "A homeowner answers without knowing who is calling",
        lesson: "Name your company and explain the reason for returning a call",
        reward: "A usable spoken opening for a homeowner callback",
        stage: "attraction",
        evidence: [
          {
            kind: "hypothetical",
            reference: "illustration",
            supports: "A suggested script the reader can adapt",
            limitation:
              "Not an actual customer conversation or a product promise",
          },
        ],
      },
      {
        audience: "Roofing owner considering an unfamiliar address",
        situation: "A job may sit outside the usual service area",
        lesson:
          "Clarify the town before deciding whether to review an exception",
        reward: "Apply a sample service-area rule to a borderline inquiry",
        stage: "attraction",
        evidence: [
          {
            kind: "hypothetical",
            reference: "illustration",
            supports: "A suggested office decision rule",
            limitation: "Not a promise of automatic product exclusion",
          },
        ],
      },
    ],
    selected: 0,
    selectionReason: "A comparison demonstrates the exact information gap.",
    hook: "Would this note help you call the homeowner back?",
    retention: "Read the vague note then the complete version alongside it.",
    businessRelevance:
      "Roofing inquiries need useful details for the next conversation.",
    format: "comparison",
    visualPurpose:
      "Make the missing information visible in a pair of example notes.",
    action: "none",
    cta: "",
    originality:
      "A concrete paired example and reusable note add to abstract prior advice.",
    reinforces: [],
    newApplication: "",
  };
}
export function sampleCreativeContent(): SocialContent {
  const editorial = samplePlan();
  return {
    topic: "follow_up",
    hook: editorial.hook,
    facebook:
      "Compare these fictional callback notes. Write the homeowner's actual roofing question alongside the property and how to reach them.",
    instagram:
      "A callback note should tell you what the homeowner wants to discuss. These fictional examples show the difference.",
    graphic: {
      template: "editorial",
      design: "comparison",
      headline: "Which note could you actually use?",
      body: "Illustrative callback notes. Keep the homeowner's question in the note.",
      items: [
        "Roof question. Please call back.",
        "Homeowner asks whether you inspect a leaking garage roof. Full address and callback details attached.",
      ],
      labels: ["Vague note", "Useful note"],
      evidenceLabel: "ILLUSTRATIVE EXAMPLE",
    },
    sources: ["capabilities"],
    action: "none",
    editorial,
  };
}
