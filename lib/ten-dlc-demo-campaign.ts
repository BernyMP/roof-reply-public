import { ACCOUNT_SMS_CONSENT_TEXT } from "./account-sms-consent.ts";

export const ROOFREPLY_DEMO_10DLC = {
  brand: {
    legalName: "WEB SHINOBI, LLC",
    brandId: "4b20019a-fc4b-c003-3ae2-8a12dfb8af9d",
    tcrId: "BO1G57H",
    status: "Verified",
  },
  urls: {
    website: "https://www.roofreply.com",
    optIn: "https://www.roofreply.com/demo-sms",
    privacy: "https://www.roofreply.com/privacy",
    terms: "https://www.roofreply.com/terms",
    smsDisclosure: "https://www.roofreply.com/sms-disclosure",
    calendlyBookingProof:
      "https://calendly.com/example/roofing-demo",
  },
  campaign: {
    id: "4b30019e-42b6-309f-d626-612d2de7ba07",
    tcrId: "CGOEFA3",
    name: "RoofReply Live SMS Demo",
    useCase: "Low Volume Mixed",
    subUseCase: "Customer Care",
    fallbackUseCase: "Customer Care",
    expectedTraffic:
      "Low-volume demo/testing traffic only, typically fewer than 10 messages per demo conversation.",
    prohibitedUseCases: [
      "Security Alert",
      "Marketing",
      "Platform Free Trial",
      "Account Notification",
    ],
  },
  description:
    "WEB SHINOBI, LLC operates RoofReply, an AI missed-call recovery product for roofing contractors. This low-volume campaign is used only for live RoofReply product demos requested through the RoofReply SMS demo opt-in form. Messages demonstrate how RoofReply replies to a roofing inquiry, asks qualifying questions, gathers job details, and shows a contractor handoff. Messages are customer-care/demo related only and do not include marketing or promotional content.",
  messageFlow: `Users opt in on RoofReply's SMS demo page at https://www.roofreply.com/demo-sms. The mobile phone field is optional on the page; visitors who want the live SMS demo enter their mobile phone number and select the SMS consent checkbox. The public checkbox states: "I agree to receive SMS messages from RoofReply, a product operated by Web Shinobi LLC, for a live product demo at the mobile number provided. Message frequency varies, typically up to 10 messages per demo conversation. Message and data rates may apply. Reply STOP to opt out. Reply HELP for help. Consent is not a condition of purchase." Authenticated RoofReply account owners can also approve setup, test, and demo SMS while entering the lead-alert phone in onboarding or account settings. The account checkbox states: "${ACCOUNT_SMS_CONSENT_TEXT}" After that saved opt-in, account owners can start the same demo from /dashboard/demo by selecting Start Demo SMS. The dashboard uses the configured lead-alert phone already saved on the account and records the current consent text and version. The public page links to the Privacy Policy and Terms of Service and states that mobile information and text messaging opt-in data will not be sold, rented, or shared with third parties or affiliates for marketing or promotional purposes. After opt-in, RoofReply sends only live demo/customer-care SMS messages related to the requested RoofReply demo.`,
  sampleMessages: [
    "RoofReply: Thanks for requesting a live SMS demo. I'll show how RoofReply qualifies a roofing lead by text. Reply STOP to opt out.",
    "RoofReply demo: Example homeowner says water is near the kitchen ceiling after rain. Is this an active leak? Reply STOP to opt out.",
    "RoofReply demo: Next, RoofReply would ask for city or ZIP, urgency, and job details so the contractor gets a clean handoff. Reply STOP to opt out.",
    "RoofReply demo: Sample handoff: leak repair, kitchen ceiling, storm related, homeowner wants an inspection today. Reply STOP to opt out.",
    "RoofReply demo: Qualified leads can book the next step here: https://calendly.com/example/roofing-demo Reply STOP to opt out.",
    "RoofReply demo complete. For help reply HELP or contact hello@example.com. Reply STOP to opt out.",
  ],
  keywords: {
    optIn: ["START", "UNSTOP", "SUBSCRIBE"],
    optOut: ["STOP", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"],
    help: "HELP",
  },
  responses: {
    optIn:
      "RoofReply: You have been resubscribed to RoofReply demo messages. Message frequency varies. Message and data rates may apply. Reply HELP for help. Reply STOP to opt out.",
    optOut:
      "RoofReply: You have been unsubscribed and will not receive further messages. Reply START to resubscribe.",
    help: "RoofReply help: This number sends RoofReply live demo messages. Message frequency varies. Message and data rates may apply. Reply STOP to opt out. Support: hello@example.com.",
  },
  attributes: {
    subscriberOptIn: true,
    subscriberOptOut: true,
    subscriberHelp: true,
    embeddedLinks: true,
    embeddedPhoneNumbers: false,
    affiliateMarketing: false,
    ageGatedContent: false,
    directLending: false,
  },
  guardrails: [
    "Only send demo messages to numbers captured through /demo-sms consent records, current onboarding/settings account SMS consent for the lead-alert phone, or an equivalent consent webhook from those flows.",
    "Do not send marketing, sales blasts, contractor customer traffic, or third-party contractor messages on this campaign.",
    "Keep outbound demo messages branded as RoofReply; use Web Shinobi LLC in legal/operator context only.",
    "If Telnyx asks for a screenshot, provide a screenshot of https://www.roofreply.com/demo-sms showing the phone field, checkbox, consent text, and privacy/terms links.",
    "After approval, assign only the RoofReply demo number/messaging profile to this campaign and run a test opt-in using the public form.",
  ],
} as const;

export const DEMO_SMS_CONSENT_VERSION = "roofreply-demo-sms-v1-2026-05-15";

export const DEMO_SMS_CONSENT_TEXT =
  "I agree to receive SMS messages from RoofReply, a product operated by Web Shinobi LLC, for a live product demo at the mobile number provided. Message frequency varies, typically up to 10 messages per demo conversation. Message and data rates may apply. Reply STOP to opt out. Reply HELP for help. Consent is not a condition of purchase.";
