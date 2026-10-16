import { creativeFormats } from "./creative-plan.ts";
import { SOCIAL_TOPICS, type SocialContent } from "./social-content.ts";

export const EDITORIAL_VERSION = "editorial-v1";
export const EXPERIMENT_BUDGET_USD = 25;
export const EXPERIMENT_DAYS = 14;

const angles: Record<SocialContent["topic"], string[]> = {
  missed_calls: [
    "Walk through what a homeowner encounters when the office is closed. Give the owner a specific routing check to make.",
    "The field-to-office gap: explain who should own a roofing inquiry when the owner is on a site visit.",
    "Distinguish unanswered calls from unanswered inquiries. Give a useful handoff question for the team.",
    "Show how to audit voicemail responsibility without claiming every missed call is a lost sale.",
  ],
  follow_up: [
    "A good handoff contains the roofing request, location, urgency, and a named owner. Explain why the next action matters.",
    "Show the difference between sending a booking link and confirming an inspection, with a practical verification step.",
    "An out-of-area inquiry needs an exception route. Offer an office checklist without promising automated exclusion.",
    "Review your follow-up process using delivery, reply, and confirmed inspection as separate observations.",
  ],
  product: [
    "Explain the division of work: automated text intake gathers context; the roofing team confirms inspections and closes jobs.",
    "Explain conditional missed-call forwarding in plain language. Answered calls remain with the business; routing depends on the phone system.",
    "Make a diagram of missed call, text intake, and team handoff. Explain what the team receives without inventing a screenshot.",
    "A live rehearsal is part of setup. Show what to verify before activating missed-call follow-up.",
  ],
  example: [
    "Create a clearly fictional brief exchange about a roof leak that gathers useful context. Do not diagnose or give roofing repair advice.",
    "Create a clearly fictional exchange about replacing an aging roof. Demonstrate intake, not an invented booked job.",
    "Create a clearly fictional exchange that asks for the property location before handing the inquiry to the team.",
    "Create a clearly fictional after-hours roofing inquiry. Demonstrate a question and human handoff, without promising response times.",
  ],
  audit: [
    "Give the owner a useful self-audit: trace the route, identify who owns the callback, and verify what is recorded.",
    "Explain what to bring to a missed-call audit: current call route, follow-up ownership, and inspection confirmation process.",
    "Help the owner choose a controlled starting point: an existing number, branch, or after-hours window, subject to routing capability.",
    "Explain useful reporting questions. Separate delivered texts, replies, and team-confirmed inspections without making revenue claims.",
  ],
};

export function editorialBrief(
  date: string,
  slot: "morning" | "afternoon",
  topic: SocialContent["topic"],
  postsPerDay: 1 | 2 = 2,
) {
  const day = Math.floor(Date.parse(`${date}T15:00:00Z`) / 86400000);
  // Advance once per occurrence of a topic, not independently by day and slot.
  // The former formula assigned the same angle to adjacent topic occurrences.
  const ordinal =
    postsPerDay === 1 ? day : day * 2 + (slot === "afternoon" ? 1 : 0);
  const turn = Math.floor(ordinal / SOCIAL_TOPICS.length);
  const angle = angles[topic][turn % angles[topic].length];
  const design =
    topic === "example"
      ? "dialogue"
      : topic === "follow_up"
        ? turn % 2
          ? "flow"
          : "field-guide"
        : topic === "audit"
          ? "field-guide"
          : ["cover", "split", "statement"][turn % 3];
  return {
    version: EDITORIAL_VERSION,
    audience:
      "Owner-led residential roofing businesses with existing inbound inquiries and someone responsible for sales follow-up.",
    objective:
      "Earn attention by helping the owner inspect or improve one concrete part of their follow-up process.",
    angle,
    design,
    action:
      topic === "audit"
        ? "audit"
        : topic === "missed_calls"
          ? "reflect"
          : "save",
    requiredTakeaway:
      "A specific check, decision, or explanation the owner can use even without buying RoofReply.",
    sourcePolicy:
      "Use approved facts for product capabilities. Never turn process advice or fictional examples into evidence of business results.",
  };
}

export function validateEditorialDesign(content: SocialContent) {
  const g = content.graphic;
  if (!g.design) return;
  const modern = creativeFormats.includes(
    g.design as (typeof creativeFormats)[number],
  );
  const template = modern
    ? "editorial"
    : g.design === "dialogue"
      ? "conversation"
      : ["field-guide", "flow"].includes(g.design)
        ? "checklist"
        : "headline";
  if (g.template !== template)
    throw new Error("Design does not match its content template.");
  if (
    g.headline.length > 60 ||
    g.body.length > 150 ||
    g.items.some(
      (s) => s.length > (modern ? (g.design === "script" ? 180 : 140) : 72),
    )
  )
    throw new Error("Shorten the graphic copy for readable editorial layouts.");
  if (
    g.design === "calculation" &&
    g.items.some((item, i) => item.length > (i === 1 ? 50 : 110))
  )
    throw new Error(
      "Calculation needs a short equation (50 characters) and concise assumptions and interpretation (110 each).",
    );
  if (g.design === "annotated" && g.body.length > 110)
    throw new Error(
      "Annotated graphics need a body of at most 110 characters.",
    );
  if (modern) {
    const count =
      g.design === "comparison"
        ? 2
        : g.design === "script"
          ? 1
          : g.design === "annotated"
            ? 4
            : 3;
    if (g.items.length !== count || !g.labels || g.labels.length !== count)
      throw new Error(`Use ${count} labeled items for ${g.design}.`);
  }
  if (!content.action) throw new Error("Choose the post's audience action.");
}
