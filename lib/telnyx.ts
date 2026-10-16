import { ROOFREPLY_DEMO_10DLC } from "./ten-dlc-demo-campaign.ts";

interface SendSmsOptions {
  to: string;
  text: string;
  from: string;
  messagingProfileId?: string;
}
export class SmsSubmissionError extends Error {
  rejected: boolean;
  constructor(rejected: boolean) { super(rejected ? "SMS rejected by provider" : "SMS submission outcome unknown"); this.rejected = rejected; }
}

interface TelnyxMessageResponse {
  data: {
    id: string;
    type: string;
    to: { phone_number: string }[];
    text: string;
  };
}

export function maskPhoneNumberForLogs(phone?: string | null): string {
  if (!phone) return "not_set";

  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return "****";

  return `***${digits.slice(-4)}`;
}

// 10DLC Compliance: Opt-out language required on all messages
const OPT_OUT_LANGUAGE = "\n\nReply STOP to opt out.";

// Check if message is an opt-out request
export function isOptOutMessage(text: string): boolean {
  const normalized = text.trim().toUpperCase();
  const optOutKeywords = ["STOP", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"];
  return optOutKeywords.includes(normalized);
}

// Check if message is an opt-in request (to re-subscribe)
export function isOptInMessage(text: string): boolean {
  const normalized = text.trim().toUpperCase();
  const optInKeywords = ["START", "UNSTOP", "SUBSCRIBE"];
  return optInKeywords.includes(normalized);
}

// Check if message is a help request
export function isHelpMessage(text: string): boolean {
  return text.trim().toUpperCase() === "HELP";
}

interface SendSmsComplianceOptions extends SendSmsOptions {
  includeOptOut?: boolean; // Whether to append opt-out language (default: true for first message)
  isFirstMessage?: boolean;
}

export async function sendSms({to,text,from,messagingProfileId}: SendSmsOptions): Promise<TelnyxMessageResponse> {
  const key = process.env.TELNYX_API_KEY;
  if (!key || !from || !to || !text) throw new SmsSubmissionError(true);
  let response: Response;
  try {
    response = await fetch("https://api.telnyx.com/v2/messages", {
      method:"POST", headers:{"Content-Type":"application/json",Authorization:`Bearer ${key}`},
      body:JSON.stringify({from,to,text,messaging_profile_id:messagingProfileId}),
      signal:AbortSignal.timeout(10000),
    });
  } catch { throw new SmsSubmissionError(false); }
  if (!response.ok) throw new SmsSubmissionError(response.status >= 400 && response.status < 500 && response.status !== 408);
  try {
    const result = await response.json() as TelnyxMessageResponse;
    if (!result.data?.id) throw new Error("Missing message ID");
    return result;
  } catch { throw new SmsSubmissionError(false); }
}

// Compliance-aware SMS sending - adds opt-out language
export async function sendComplianceSms({
  to,
  text,
  from,
  includeOptOut = true,
  isFirstMessage = false,
}: SendSmsComplianceOptions): Promise<TelnyxMessageResponse> {
  // Add opt-out language to first message in conversation
  let finalText = text;
  if (includeOptOut && isFirstMessage) {
    finalText = text + OPT_OUT_LANGUAGE;
  }

  return sendSms({ to, text: finalText, from });
}

// Standard opt-out confirmation response (carrier required)
export const OPT_OUT_CONFIRMATION =
  "RoofReply: You have been unsubscribed and will not receive further messages. Reply START to resubscribe.";

// Standard opt-in confirmation response
export const OPT_IN_CONFIRMATION =
  "You have been resubscribed to RoofReply service messages. Message frequency varies, typically up to 10 automated responses per roofing inquiry conversation. Message and data rates may apply. Reply HELP for help. Reply STOP to opt out.";

// Standard help response
export const HELP_RESPONSE =
  "RoofReply service messages help with roofing inquiry conversations. Message frequency varies, typically up to 10 automated responses per roofing inquiry conversation. Message and data rates may apply. Reply STOP to opt out. Support: hello@example.com.";

export function getSmsKeywordResponsesForNumber(toNumber: string) {
  const demoNumber = process.env.DEMO_SMS_TELNYX_PHONE_NUMBER;
  const isDemoNumber =
    Boolean(demoNumber) &&
    normalizePhoneNumber(toNumber) === normalizePhoneNumber(demoNumber || "");

  if (isDemoNumber) {
    return {
      optOut: ROOFREPLY_DEMO_10DLC.responses.optOut,
      optIn: ROOFREPLY_DEMO_10DLC.responses.optIn,
      help: ROOFREPLY_DEMO_10DLC.responses.help,
    };
  }

  return {
    optOut: OPT_OUT_CONFIRMATION,
    optIn: OPT_IN_CONFIRMATION,
    help: HELP_RESPONSE,
  };
}

// Format phone number to E.164 format
export function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "");

  // If it's 10 digits, assume US and add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // If it's 11 digits starting with 1, add +
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  // Otherwise return with + prefix if not already there
  return phone.startsWith("+") ? phone : `+${digits}`;
}
