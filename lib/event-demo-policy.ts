import { parsePhoneNumberFromString } from "libphonenumber-js/min";

export function isUsDemoPhone(phone: string) {
  const number = parsePhoneNumberFromString(phone);
  return Boolean(number && number.country === "US" && number.isValid() && number.number === phone);
}

export const EVENT_DEMO = {
  participants: 50,
  attempts: 3,
  messages: 20,
  outbound: 10,
  aiCalls: 9,
  budgetCents: 1000,
  smsCents: 3,
  aiCents: 1,
  idleMs: 30 * 60 * 1000,
  cooldownMs: 60 * 1000,
} as const;

export function eventDemoDay(now = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

// GSM extension characters occupy two septets; other characters use UCS-2.
const GSM = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const EXT = "\f^{}\\[~]|€";
export function isSingleSms(text: string) {
  let septets = 0;
  for (const char of text) {
    if (GSM.includes(char)) septets++;
    else if (EXT.includes(char)) septets += 2;
    else return text.length <= 70;
  }
  return septets <= 160;
}
export function eventDemoSms(text: string) {
  return isSingleSms(text) ? text : "RoofReply demo: Please describe the roofing issue briefly. Reply STOP to opt out.";
}
export const EVENT_DEMO_OPENING = "RoofReply demo: Imagine you're a homeowner. Sorry we missed your call! What's going on with your roof? Reply STOP to opt out.";
export const EVENT_DEMO_CLOSING = "RoofReply demo complete. Your details are ready for review in the demo dashboard. Thanks for trying it!";
