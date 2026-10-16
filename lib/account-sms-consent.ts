export const ACCOUNT_SMS_CONSENT_VERSION =
  "roofreply-account-sms-v2-2026-09-08";

export const ACCOUNT_SMS_CONSENT_TEXT =
  "I agree to receive setup, test, live demo, and roofing lead alert SMS messages from RoofReply, a product operated by Web Shinobi LLC, at the mobile number provided. Message frequency varies, typically up to 10 messages per demo or setup conversation. Message and data rates may apply. Reply STOP to opt out. Reply HELP for help. Consent is not a condition of purchase.";

type AccountSmsConsentInput = {
  phoneNumber?: string | null;
  consentGranted?: boolean | null;
  consentPhone?: string | null;
  consentText?: string | null;
  consentVersion?: string | null;
};

export function normalizeConsentPhone(phone?: string | null) {
  const value = phone?.trim() ?? "";
  const digits = value.replace(/\D/g, "");

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  if (value.startsWith("+") && digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }

  return digits ? `+${digits}` : "";
}

export function hasCurrentAccountSmsConsent({
  phoneNumber,
  consentGranted,
  consentPhone,
  consentText,
  consentVersion,
}: AccountSmsConsentInput) {
  const currentPhone = normalizeConsentPhone(phoneNumber);
  const capturedPhone = normalizeConsentPhone(consentPhone);

  return Boolean(
    consentGranted &&
      currentPhone &&
      currentPhone === capturedPhone &&
      consentText === ACCOUNT_SMS_CONSENT_TEXT &&
      consentVersion === ACCOUNT_SMS_CONSENT_VERSION
  );
}
