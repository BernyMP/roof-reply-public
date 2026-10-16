import {
  topicForDate,
  socialSourceVersion,
  dueAtForDate,
  validateContent,
  repeatsHook,
  type SocialContent,
  type SocialGraphic,
} from "./social-content.ts";

// Reviewed against marketing-copy.ts. Bump the config revision when editing this
// library so existing queued posts are cancelled and can be reviewed in Buffer.
function card(
  topic: SocialContent["topic"],
  headline: string,
  body: string,
  detail: string,
  items: string[] = [],
): SocialContent {
  const template: SocialGraphic["template"] =
    topic === "example"
      ? "conversation"
      : items.length
        ? "checklist"
        : "headline";
  return {
    topic,
    hook: headline,
    facebook: `${headline}\n\n${detail}`,
    instagram: `${headline}\n\n${body}\n\n${detail}`,
    graphic: { template, headline, body, items },
    sources: ["promise", "capabilities"],
  };
}

export const SOCIAL_LIBRARY: SocialContent[] = [
  card(
    "missed_calls",
    "On the roof. Away from the phone.",
    "Give missed roofing callers a clear next step.",
    "A roofing inquiry can arrive while you are on a job. RoofReply manages missed-call text follow-up, gathers roofing details, and hands the conversation to your team.",
  ),
  card(
    "missed_calls",
    "Your next inquiry may arrive after closing.",
    "Include after-hours calls in your follow-up plan.",
    "Review what happens when a homeowner calls after your team has finished for the day. A defined after-hours window can be a controlled starting point for missed-call recovery, subject to your phone system.",
  ),
  card(
    "missed_calls",
    "Voicemail is a starting point.",
    "Decide who takes the next step when the phone goes unanswered.",
    "A voicemail still needs an owner. Make it clear who checks missed inquiries, gathers the missing roofing details, and follows up with the homeowner.",
  ),
  card(
    "missed_calls",
    "Busy hands. A ringing phone.",
    "Plan for the calls you cannot take during roofing work.",
    "Site visits and roofing work compete for your attention. A missed-call follow-up process gives your team a way to continue the conversation when answering was not possible.",
  ),
  card(
    "missed_calls",
    "Ad clicks need a follow-up plan.",
    "Look at the handoff after an inbound roofing call.",
    "Before changing your lead generation, look at what happens to the inquiries already coming in. Who follows up when a prospect reaches voicemail? Who owns the next step?",
  ),
  card(
    "missed_calls",
    "The caller has already raised a hand.",
    "Keep the next step clear for an inbound roofing inquiry.",
    "A missed inbound call deserves a defined follow-up process. Review the inquiry, collect relevant roofing details, and give your team a clear handoff.",
  ),
  card(
    "missed_calls",
    "Check the gaps between answered calls.",
    "Missed inquiries belong in your operating review.",
    "Answered calls are only part of the picture. Review missed and after-hours inquiries too, then separate relevant new roofing prospects from unrelated calls.",
  ),
  card(
    "missed_calls",
    "An unanswered ring needs an owner.",
    "Assign responsibility before the next inquiry arrives.",
    "When everyone assumes someone else will call back, the next step is unclear. Decide who reviews roofing inquiries and who confirms the inspection with the homeowner.",
  ),

  card(
    "follow_up",
    "Start with the roofing problem.",
    "Collect useful details before handing off the inquiry.",
    "A focused roofing intake helps your team understand the request. Ask about the work needed, the location, and the urgency before deciding the next step.",
    [
      "Ask what roofing work is needed.",
      "Check the property location.",
      "Clarify the urgency.",
    ],
  ),
  card(
    "follow_up",
    "Put a name beside the next step.",
    "Make ownership part of every handoff.",
    "A conversation can have useful details and still lack a next step. Give the handoff an owner, a clear action, and a way to confirm what happened.",
    [
      "Assign the follow-up owner.",
      "State the next action.",
      "Confirm the outcome.",
    ],
  ),
  card(
    "follow_up",
    "A booking link is not a booked inspection.",
    "Confirm appointments with your roofing team.",
    "Sending a scheduling link does not confirm that an inspection is booked. Have your team verify the appointment before counting it in your reporting.",
    [
      "Share the agreed next step.",
      "Confirm the appointment.",
      "Record the verified outcome.",
    ],
  ),
  card(
    "follow_up",
    "Keep your service area in the conversation.",
    "Check location before promising the next step.",
    "A homeowner's roofing request needs to fit the area you serve. Include location in intake and let your team review inquiries that need a closer look.",
    [
      "Ask for the property location.",
      "Check your service area.",
      "Route exceptions for review.",
    ],
  ),
  card(
    "follow_up",
    "Make the handoff easy to read.",
    "Give your team the context needed to follow up.",
    "Useful handoffs keep the roofing request and next action easy to find. Your team should be able to pick up the conversation without asking the homeowner to start over.",
    [
      "Summarize the roofing request.",
      "Include location and urgency.",
      "Identify the next action.",
    ],
  ),
  card(
    "follow_up",
    "Review the process after closing.",
    "Make after-hours follow-up a deliberate choice.",
    "Walk through what happens when a roofing prospect calls outside your usual hours. Confirm how the inquiry reaches the person responsible for sales follow-up.",
    [
      "Check the missed-call route.",
      "Review the follow-up window.",
      "Confirm the handoff owner.",
    ],
  ),
  card(
    "follow_up",
    "Separate a reply from an outcome.",
    "Track the steps of the conversation clearly.",
    "A delivered text, a homeowner reply, and a confirmed inspection describe different things. Keep them separate so your review reflects what actually happened.",
    [
      "Check delivery evidence.",
      "Record homeowner replies.",
      "Verify booked inspections.",
    ],
  ),
  card(
    "follow_up",
    "Rehearse before switching on.",
    "Test the path from missed call to human handoff.",
    "A live rehearsal helps check routing and follow-up before activation. RoofReply setup includes required permissions, carrier approval, routing checks, and a rehearsal.",
    [
      "Check routing and permissions.",
      "Rehearse the text conversation.",
      "Verify the team handoff.",
    ],
  ),

  card(
    "product",
    "Managed follow-up starts after a missed call.",
    "RoofReply helps continue the conversation by text.",
    "RoofReply installs and manages missed-call follow-up for residential roofing businesses. The workflow gathers roofing details and supports inspection handoff to your team.",
  ),
  card(
    "product",
    "Keep the number homeowners already know.",
    "Conditional forwarding depends on your phone system.",
    "RoofReply helps configure conditional missed-call forwarding from your existing business number. Answered calls stay with your business; RoofReply does not answer live voice calls.",
  ),
  card(
    "product",
    "Your team confirms the inspection.",
    "RoofReply supports the handoff to your roofing team.",
    "RoofReply collects roofing details and moves the homeowner toward an inspection through contractor follow-up or a configured scheduling link. Your team confirms appointments and handles sales follow-up.",
  ),
  card(
    "product",
    "Define a roofing opportunity together.",
    "Agree on qualification criteria during onboarding.",
    "RoofReply configures your service area and qualification criteria with you. Reporting separates relevant new residential roofing inquiries from spam, vendors, existing customers, and unrelated calls through operator review.",
  ),
  card(
    "product",
    "A workflow needs ongoing attention.",
    "RoofReply manages and refines missed-call follow-up.",
    "The service includes workflow setup, text conversation management, roofing detail collection, and team handoff. RoofReply monitors and refines the workflow and prepares a monthly recovery report.",
  ),
  card(
    "product",
    "Reporting should follow the evidence.",
    "Review delivered follow-ups and confirmed outcomes separately.",
    "RoofReply's monthly recovery report covers eligible missed calls, delivered follow-ups, recovered conversations, qualified opportunities, confirmed inspections, and human handoffs. Demo and sample activity are excluded.",
  ),
  card(
    "product",
    "Fit the follow-up around your operation.",
    "Start with a defined scope and a responsible teammate.",
    "RoofReply is built for established, owner-led residential roofing businesses with existing inbound lead generation, a defined service area, and someone responsible for sales follow-up.",
  ),
  card(
    "product",
    "Keep your team in the loop.",
    "Managed text intake supports human follow-up.",
    "RoofReply gathers roofing details and hands inquiries to your team. Your team reviews the handoff, follows up with homeowners, confirms inspections, and closes the job.",
  ),

  card(
    "example",
    "Ask about the leak before the next step.",
    "An illustrative intake exchange about a roof leak.",
    "This fictional exchange shows how a focused question can clarify a roofing request. It is an intake example, not a diagnosis or a confirmed appointment.",
    [
      "I noticed a leak in the ceiling.",
      "Is water coming inside right now?",
      "No, it happened during the rain.",
    ],
  ),
  card(
    "example",
    "Location helps shape the handoff.",
    "An illustrative exchange about the property's location.",
    "This fictional exchange shows location being collected during intake. The roofing team still needs to review the request and confirm the next step.",
    [
      "I'd like someone to check my roof.",
      "What town is the property in?",
      "The house is in Mesa.",
    ],
  ),
  card(
    "example",
    "Clarify the work the homeowner has in mind.",
    "An illustrative exchange about a replacement inquiry.",
    "This fictional conversation gathers the type of roofing work requested. A homeowner inquiry still needs your team's review and follow-up.",
    [
      "I'm thinking about replacing my roof.",
      "Is this for a residential property?",
      "Yes, it's my home.",
    ],
  ),
  card(
    "example",
    "Turn a vague request into useful context.",
    "An illustrative exchange about visible roof damage.",
    "This fictional exchange shows a follow-up question gathering context. It does not diagnose damage or promise that a particular repair is suitable.",
    [
      "Some roof tiles look out of place.",
      "When did you first notice the issue?",
      "I noticed it after the wind yesterday.",
    ],
  ),
  card(
    "example",
    "Understand the timing of the request.",
    "An illustrative intake exchange about project timing.",
    "This fictional exchange shows how timing can be collected for the roofing team. Availability and inspection arrangements still need to be confirmed.",
    [
      "I'd like to discuss a roof replacement.",
      "When are you hoping to begin the project?",
      "I'm planning for later this season.",
    ],
  ),
  card(
    "example",
    "Find out what prompted the call.",
    "An illustrative exchange about a homeowner's concern.",
    "This fictional intake example asks why the homeowner reached out. Gathering context can help your team decide what to ask during its follow-up.",
    [
      "I want to have the roof looked at.",
      "What prompted you to reach out today?",
      "I saw a stain near the upstairs window.",
    ],
  ),
  card(
    "example",
    "Let the homeowner describe the roof.",
    "An illustrative exchange about roofing materials.",
    "This fictional conversation collects a basic property detail for follow-up. The roofing team still needs to assess the request and confirm the work involved.",
    [
      "I'm looking for help with a roof repair.",
      "Do you know what type of roof you have?",
      "It has asphalt shingles.",
    ],
  ),
  card(
    "example",
    "Capture the question for your team.",
    "An illustrative exchange that prepares a human handoff.",
    "This fictional exchange shows the homeowner's request being clarified for the team. It does not represent an actual customer or a booked inspection.",
    [
      "Can someone discuss my roofing options?",
      "Are you considering repair or replacement?",
      "I'd like help understanding both.",
    ],
  ),

  card(
    "audit",
    "Walk through your missed-call path.",
    "Bring your current follow-up process to a 20-minute audit.",
    "Where does a missed roofing inquiry go next? Use a RoofReply missed-call audit to discuss your current call flow and identify a controlled starting point.",
  ),
  card(
    "audit",
    "Start with the calls already coming in.",
    "Discuss inbound roofing inquiries in a 20-minute audit.",
    "RoofReply focuses on missed-call recovery for established residential roofing businesses. Bring your current inbound process and follow-up questions to the audit.",
  ),
  card(
    "audit",
    "Choose a manageable starting point.",
    "Explore a defined missed-call recovery scope.",
    "A starting point might be a business number, branch, or after-hours window, subject to your phone system's routing capabilities. Discuss the right scope in a RoofReply audit.",
  ),
  card(
    "audit",
    "Bring your handoff questions.",
    "Use a 20-minute audit to discuss the next step after intake.",
    "Who reviews the roofing inquiry? Who contacts the homeowner? Who confirms the inspection? Bring those handoff questions to a RoofReply missed-call audit.",
  ),
  card(
    "audit",
    "What happens after your phone stops ringing?",
    "Review the path from missed inquiry to follow-up.",
    "A RoofReply audit is a chance to discuss how missed callers reach your team and where managed text follow-up might fit into your roofing operation.",
  ),
  card(
    "audit",
    "Look at the after-hours window.",
    "Discuss an overlooked part of your call flow.",
    "If after-hours inquiries are part of your roofing business, include them in the audit conversation. Review the current route, the follow-up process, and the person responsible.",
  ),
  card(
    "audit",
    "Define useful reporting before launch.",
    "Bring your follow-up reporting questions to the audit.",
    "Discuss what your team needs to see about eligible missed calls, homeowner replies, handoffs, and confirmed inspections. Clear definitions help make a recovery review useful.",
  ),
  card(
    "audit",
    "Make room to review the phone process.",
    "Set aside 20 minutes for your missed-call audit.",
    "Roofing work keeps owners busy. A focused audit gives you time to discuss missed-call routing, qualification, and inspection handoff with RoofReply.",
  ),
];

// 2026-10-13: reviewed all 40 unchanged cards against the free founding offer.
// No card promises old prices, paid terms or customer results; source checks stay enabled.
export const LIBRARY_REVIEWED_SOURCE_VERSION = "sources-57880af3";

export function selectLibraryContent(date: string, previous: string[] = []) {
  if (socialSourceVersion() !== LIBRARY_REVIEWED_SOURCE_VERSION)
    throw new Error(
      "Marketing sources changed. Review the library before publishing.",
    );
  const candidates = SOCIAL_LIBRARY.filter(
    (c) => c.topic === topicForDate(date),
  );
  const start =
    Math.floor(dueAtForDate(date) / 86_400_000 / 5) % candidates.length;
  for (let offset = 0; offset < candidates.length; offset++) {
    const candidate = candidates[(start + offset) % candidates.length];
    if (
      !repeatsHook(candidate.hook, previous) &&
      !repeatsHook(candidate.graphic.headline, previous)
    )
      return validateContent(candidate, previous);
  }
  // Never silently switch to paid generation when the prepared library runs out.
  throw new Error(
    "No unused library hook available. Expand the prepared library.",
  );
}
