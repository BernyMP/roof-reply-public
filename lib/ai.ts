import {
  buildRoofingLeadPrompt,
  roofingHandoffReply,
  type RoofingLeadContext,
} from "../agents/roofing-lead/src/conversation.ts";
import { z } from "zod";
import {
  hasIntakeDetails,
  needsNumericClarification,
  nextIntakeQuestion,
  repeatsKnownQuestion,
} from "./intake-policy.ts";

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

interface LeadInfo {
  name?: string;
  jobType?: string;
  location?: string;
  urgency?: "low" | "medium" | "high";
  summary?: string;
  isQualified?: boolean;
  recommendedHandoff?: string;
  shouldSendBookingLink?: boolean;
  shouldNotifyContractor?: boolean;
  handoffReason?: string;
}

interface AiResponse {
  message: string;
  leadInfo: LeadInfo;
  conversationComplete: boolean;
  requiresHumanReview: boolean;
}

const RESPONSE_SCHEMA = {
  name: "sms_intake_reply",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      requiresHumanReview: {
        type: "boolean",
        description: "True for a request for a person/callback, existing job, appointment, billing/warranty concern, clearly unsupported service, or inability/refusal to continue intake. Stop questions and route to contractor review without requiring complete details.",
      },
      message: {
        type: "string",
        description:
          "The SMS reply to send to the homeowner. Under 160 characters, at most one question, no links, no emojis.",
      },
      name: {
        type: ["string", "null"],
        description: "The homeowner's name if they've shared it.",
      },
      jobType: {
        type: ["string", "null"],
        description:
          "Short description of the roofing work needed, e.g. 'leak repair'.",
      },
      location: {
        type: ["string", "null"],
        description: "Address or town of the property if shared.",
      },
      urgency: {
        anyOf: [
          { type: "string", enum: ["low", "medium", "high"] },
          { type: "null" },
        ],
        description:
          "high = explicit immediate danger, heavy ongoing water intrusion, collapse or urgent request; medium = repair needed soon; low = quotes/planning; no active leak alone does not make a repair low urgency; null = unclear. A leak alone or an ambiguous answer never proves high urgency.",
      },
      summary: {
        type: ["string", "null"],
        description:
          "One-sentence summary of the lead for the contractor, or null if too early.",
      },
      isQualified: {
        type: "boolean",
        description:
          "True if this looks like a legitimate job within or near the service area.",
      },
      conversationComplete: {
        type: "boolean",
        description:
          "True only once name, job type, location, and urgency are all known.",
      },
      recommendedHandoff: {
        anyOf: [
          {
            type: "string",
            enum: [
              "review_first",
              "booking_link",
              "review_and_booking",
              "emergency_escalation",
            ],
          },
          { type: "null" },
        ],
        description:
          "Follow the configured handoff mode; prefer contractor review for high-urgency emergencies.",
      },
      shouldSendBookingLink: { type: "boolean" },
      shouldNotifyContractor: { type: "boolean" },
      handoffReason: { type: ["string", "null"] },
    },
    required: [
      "requiresHumanReview",
      "message",
      "name",
      "jobType",
      "location",
      "urgency",
      "summary",
      "isQualified",
      "conversationComplete",
      "recommendedHandoff",
      "shouldSendBookingLink",
      "shouldNotifyContractor",
      "handoffReason",
    ],
  },
} as const;

export async function generateAiResponse(
  conversationHistory: Message[],
  context: RoofingLeadContext & { eventDemo?: boolean },
): Promise<AiResponse> {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) throw new Error("OpenAI is not configured");

  const latestUser =
    [...conversationHistory].reverse().find((m) => m.role === "user")
      ?.content || "";
  const latestQuestion =
    [...conversationHistory].reverse().find((m) => m.role === "assistant")
      ?.content || "";
  if (needsNumericClarification(latestUser, latestQuestion))
    return {
      message: "Do you mean one leak inside, or something else?",
      leadInfo: { ...context.knownLead, isQualified: false },
      conversationComplete: false,
      requiresHumanReview: false,
    };

  const messages: Message[] = [
    { role: "system", content: buildRoofingLeadPrompt(context) },
    ...conversationHistory,
  ];

  if (context.eventDemo && new TextEncoder().encode(JSON.stringify({ messages, schema: RESPONSE_SCHEMA })).length > 24000)
    throw new Error("Demo AI input limit exceeded");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    signal: AbortSignal.timeout(20000),
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 500,
      temperature: 0.4,
      response_format: {
        type: "json_schema",
        json_schema: RESPONSE_SCHEMA,
      },
    }),
  });

  if (!response.ok) throw new Error("OpenAI request failed");

  const data = await response.json();
  const content = data.choices[0]?.message?.content || "";

  try {
    const parsed = z
      .object({
        requiresHumanReview: z.boolean(),
        message: z
          .string()
          .trim()
          .min(1)
          .max(240)
          .refine(
            (value) => (value.match(/\?/g) || []).length <= 1,
            "Ask one question at a time",
          )
          .refine((value) => !/https?:\/\//i.test(value)),
        name: z.string().max(200).nullable(),
        jobType: z.string().max(200).nullable(),
        location: z.string().max(500).nullable(),
        urgency: z.enum(["low", "medium", "high"]).nullable(),
        summary: z.string().max(1500).nullable(),
        isQualified: z.boolean(),
        conversationComplete: z.boolean(),
        recommendedHandoff: z.string().nullable(),
        shouldSendBookingLink: z.boolean(),
        shouldNotifyContractor: z.boolean(),
        handoffReason: z.string().nullable(),
      })
      .parse(JSON.parse(content));
    const lastUser =
      [...conversationHistory].reverse().find((m) => m.role === "user")
        ?.content || "";
    const lastQuestion =
      [...conversationHistory].reverse().find((m) => m.role === "assistant")
        ?.content || "";
    const ambiguous = needsNumericClarification(lastUser, lastQuestion);
    const details = {
      name: parsed.name || context.knownLead?.name,
      jobType: ambiguous
        ? context.knownLead?.jobType
        : parsed.jobType || context.knownLead?.jobType,
      location: parsed.location || context.knownLead?.location,
      urgency: ambiguous
        ? context.knownLead?.urgency
        : parsed.urgency || context.knownLead?.urgency,
    };
    const complete = !ambiguous && hasIntakeDetails(details);
    const requiresHumanReview = parsed.requiresHumanReview;
    return {
      message: ambiguous
        ? "Do you mean one leak inside, or something else?"
        : requiresHumanReview || complete || details.urgency === "high"
          ? roofingHandoffReply({ urgency: details.urgency, requiresHumanReview })
          : repeatsKnownQuestion(parsed.message, details)
            ? nextIntakeQuestion(details)
            : parsed.message,
      leadInfo: {
        ...details,
        summary: ambiguous ? undefined : parsed.summary || undefined,
        isQualified: complete && !requiresHumanReview && parsed.isQualified,
        recommendedHandoff: parsed.recommendedHandoff || undefined,
        shouldSendBookingLink: parsed.shouldSendBookingLink || false,
        shouldNotifyContractor: parsed.shouldNotifyContractor || false,
        handoffReason: parsed.handoffReason || undefined,
      },
      conversationComplete: complete,
      requiresHumanReview,
    };
  } catch {
    throw new Error("Invalid AI response; contractor follow-up required");
  }
}

// Generate a lead summary for the business owner
export function generateLeadSummary(lead: {
  name?: string;
  phoneNumber: string;
  jobType?: string;
  location?: string;
  urgency?: string;
  summary?: string;
}): string {
  const parts = ["New Lead Alert!"];

  if (lead.name) parts.push(`Name: ${lead.name}`);
  parts.push(`Phone: ${lead.phoneNumber}`);
  if (lead.jobType) parts.push(`Job: ${lead.jobType}`);
  if (lead.location) parts.push(`Location: ${lead.location}`);
  if (lead.urgency) parts.push(`Urgency: ${lead.urgency}`);
  if (lead.summary) parts.push(`Notes: ${lead.summary}`);

  return parts.join("\n");
}
