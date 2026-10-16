import { z } from "zod";
import { hasCurrentAccountSmsConsent } from "./account-sms-consent.ts";
import { ROOFREPLY_DEMO_10DLC } from "./ten-dlc-demo-campaign.ts";

export const phoneSchema = z.string().regex(/^\+[1-9]\d{7,14}$/);
const address = z.object({ phone_number: phoneSchema });
export const telnyxEventSchema = z.object({
  data: z.object({
    id: z.string().min(1).max(200),
    event_type: z.enum([
      "call.initiated",
      "message.received",
      "message.sent",
      "message.finalized",
    ]),
    occurred_at: z.string().datetime({ offset: true }),
    payload: z.unknown(),
  }),
});
const smsSchema = z.object({
  id: z.string().min(1).max(200),
  direction: z.enum(["inbound", "outbound"]),
  from: address,
  to: z
    .array(address.extend({ status: z.string().optional() }))
    .min(1)
    .max(10),
  text: z.string().max(10000).nullish(),
  type: z.enum(["SMS", "MMS"]),
});
const callSchema = z.object({
  call_control_id: z.string().min(1),
  call_session_id: z.string().min(1),
  from: phoneSchema,
  to: phoneSchema,
  direction: z.enum(["incoming", "outgoing"]),
});
export function parseTelnyxEvent(input: unknown) {
  const { data } = telnyxEventSchema.parse(input);
  if (data.event_type === "call.initiated") {
    const p = callSchema.parse(data.payload);
    return {
      id: data.id,
      type: data.event_type,
      occurredAt: Date.parse(data.occurred_at),
      sender: p.to,
      recipient: p.from,
      providerId: p.call_session_id,
      text: "",
      incoming: p.direction === "incoming",
      delivery: "",
    };
  }
  const p = smsSchema.parse(data.payload);
  const inbound = data.event_type === "message.received";
  return {
    id: data.id,
    type: data.event_type,
    occurredAt: Date.parse(data.occurred_at),
    sender: inbound ? p.to[0].phone_number : p.from.phone_number,
    recipient: inbound ? p.from.phone_number : p.to[0].phone_number,
    providerId: p.id,
    text:
      p.text?.trim() ||
      (p.type === "MMS"
        ? "[Attachment received; image contents unavailable]"
        : ""),
    incoming: p.direction === (inbound ? "inbound" : "outbound"),
    delivery: p.to[0].status || "",
  };
}
export type ParsedTelnyxEvent = ReturnType<typeof parseTelnyxEvent>;
export type DeliveryState =
  | "queued"
  | "sending"
  | "accepted"
  | "delivered"
  | "failed"
  | "uncertain"
  | "suppressed";
export function nextDeliveryState(
  current: DeliveryState,
  incoming: string,
): DeliveryState {
  if (current === "delivered") return current;
  if (incoming === "delivered") return "delivered";
  if (current === "failed" || current === "suppressed") return current;
  if (["delivery_failed", "sending_failed"].includes(incoming)) return "failed";
  if (["sent", "queued"].includes(incoming) && current !== "uncertain")
    return "accepted";
  return current;
}
export interface ReadyAccount {
  isDemoAccount?: boolean;
  activationMode?: "paused" | "rehearsal" | "live";
  provisioningStatus?: string;
  telnyxPhoneNumber?: string;
  messagingProfileId?: string;
  voiceApplicationId?: string;
  campaignId?: string;
  campaignStatus?: string;
  verificationStatus?: string;
  providerEvidence?: string;
  forwardingEvidence?: string;
  rehearsalEvidence?: string;
  keywordHandling?: "telnyx" | "application";
  bookingDeliveryPhone?: string;
  accountSmsConsentGranted?: boolean;
  accountSmsConsentPhone?: string;
  accountSmsConsentText?: string;
  accountSmsConsentVersion?: string;
}
export function hasOwnerConsent(a: ReadyAccount) {
  return hasCurrentAccountSmsConsent({
    phoneNumber: a.bookingDeliveryPhone,
    consentGranted: a.accountSmsConsentGranted,
    consentPhone: a.accountSmsConsentPhone,
    consentText: a.accountSmsConsentText,
    consentVersion: a.accountSmsConsentVersion,
  });
}
export function readinessBlockers(a: ReadyAccount, live = true): string[] {
  const missing: string[] = [];
  if (
    !a.isDemoAccount &&
    (a.campaignId === ROOFREPLY_DEMO_10DLC.campaign.id ||
      a.campaignId === ROOFREPLY_DEMO_10DLC.campaign.tcrId)
  )
    missing.push("The RoofReply demo campaign cannot activate a pilot business");
  if (
    a.provisioningStatus !== "ready" ||
    !a.telnyxPhoneNumber ||
    !a.messagingProfileId ||
    !a.voiceApplicationId
  )
    missing.push("Number routing has not been verified");
  if (
    a.campaignStatus !== "approved" ||
    a.verificationStatus !== "approved" ||
    !a.campaignId ||
    !a.providerEvidence?.trim()
  )
    missing.push("Provider approval evidence is missing");
  if (!a.keywordHandling)
    missing.push("STOP/START/HELP response handling has not been verified");
  if (!hasOwnerConsent(a))
    missing.push("Owner SMS permission is missing or out of date");
  if (live && !a.forwardingEvidence?.trim())
    missing.push("Conditional missed-call forwarding has not been verified");
  if (live && !a.rehearsalEvidence?.trim())
    missing.push("Live rehearsal evidence is missing");
  return missing;
}
export function canMessage(a: ReadyAccount, recipient: string) {
  if (!a.activationMode || a.activationMode === "paused") return false;
  if (readinessBlockers(a, a.activationMode === "live").length) return false;
  return a.activationMode === "live" || recipient === a.accountSmsConsentPhone;
}
