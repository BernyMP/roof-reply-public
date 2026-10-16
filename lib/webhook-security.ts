import crypto from "crypto";

/**
 * Telnyx Webhook Signature Validation
 *
 * Telnyx signs webhooks using a signature in the headers:
 * - telnyx-signature-ed25519: The signature
 * - telnyx-timestamp: Unix timestamp when signed
 *
 * The webhook public key can be retrieved from Telnyx dashboard or API.
 */

// Telnyx public key (from dashboard -> Account -> API Keys -> Public Key)
export function resolveTelnyxPublicKey(
  env: Record<string, string | undefined> = process.env
) {
  return env.TELNYX_PUBLIC_KEY;
}


// Signature tolerance in seconds (reject webhooks older than this)
const SIGNATURE_TOLERANCE_SECONDS = 300; // 5 minutes
const ED25519_RAW_PUBLIC_KEY_LENGTH = 32;
const ED25519_SPKI_DER_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

interface TelnyxSignatureHeaders {
  signature: string | null;
  timestamp: string | null;
}

export function shouldRejectMissingSignature(args: {
  signature: string | null;
  timestamp: string | null;
  nodeEnv?: string;
}): boolean {
  return !args.signature || !args.timestamp;
}

/**
 * Extract Telnyx signature headers from request
 */
export function extractTelnyxHeaders(
  headers: Headers
): TelnyxSignatureHeaders {
  return {
    signature: headers.get("telnyx-signature-ed25519"),
    timestamp: headers.get("telnyx-timestamp"),
  };
}

export function createTelnyxPublicKey(publicKey: string) {
  const decodedKey = Buffer.from(publicKey, "base64");
  const derKey =
    decodedKey.length === ED25519_RAW_PUBLIC_KEY_LENGTH
      ? Buffer.concat([ED25519_SPKI_DER_PREFIX, decodedKey])
      : decodedKey;

  return crypto.createPublicKey({
    key: derKey,
    format: "der",
    type: "spki",
  });
}

/**
 * Validate Telnyx webhook signature
 *
 * @param payload - Raw request body as string
 * @param signature - The telnyx-signature-ed25519 header value
 * @param timestamp - The telnyx-timestamp header value
 * @returns Object with valid boolean and optional error message
 */
export function validateTelnyxSignature(
  payload: string,
  signature: string,
  timestamp: string
): { valid: boolean; error?: string } {
  const TELNYX_PUBLIC_KEY = resolveTelnyxPublicKey();
  if (!TELNYX_PUBLIC_KEY) return { valid: false, error: "Webhook public key not configured" };

  // Check timestamp to prevent replay attacks
  const timestampSeconds = parseInt(timestamp, 10);
  if (!/^\d+$/.test(timestamp) || !Number.isSafeInteger(timestampSeconds)) {
    return { valid: false, error: "Invalid timestamp format" };
  }

  const currentTime = Math.floor(Date.now() / 1000);
  const timeDifference = Math.abs(currentTime - timestampSeconds);

  if (timeDifference > SIGNATURE_TOLERANCE_SECONDS) {
    return {
      valid: false,
      error: `Timestamp too old: ${timeDifference} seconds (max: ${SIGNATURE_TOLERANCE_SECONDS})`,
    };
  }

  try {
    // Create the signed payload string
    const signedPayload = `${timestamp}|${payload}`;

    // Verify the signature using ed25519
    const isValid = crypto.verify(
      null, // Algorithm (null for ed25519)
      Buffer.from(signedPayload),
      createTelnyxPublicKey(TELNYX_PUBLIC_KEY),
      Buffer.from(signature, "base64")
    );

    if (!isValid) {
      return { valid: false, error: "Signature verification failed" };
    }

    return { valid: true };
  } catch (error) {
    console.error("Signature validation error:", error);
    return {
      valid: false,
      error: `Signature validation error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Simple HMAC-based webhook validation for generic webhooks
 * Can be used as a fallback or for custom webhook endpoints
 */
export function validateHmacSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * Rate limit key generators for different scenarios
 */
export const rateLimitKeys = {
  // Per phone number for missed calls
  missedCall: (phoneNumber: string) =>
    `missed_call:${phoneNumber}`,

  // Per phone number for SMS
  smsToNumber: (phoneNumber: string) =>
    `sms_to:${phoneNumber}`,

  // Per user for webhook calls
  webhookUser: (clerkId: string) =>
    `webhook:${clerkId}`,

  // Global webhook rate limit
  webhookGlobal: () => "webhook:global",

  // Per IP address
  webhookIp: (ip: string) =>
    `webhook_ip:${ip}`,
};

/**
 * Get client IP from request headers
 * Handles various proxy headers
 */
export function getClientIp(headers: Headers): string {
  // Check various headers that might contain the real IP
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    // Take the first IP in the chain
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  const cfConnectingIp = headers.get("cf-connecting-ip");
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  // Default fallback
  return "unknown";
}

/**
 * Security event logging for monitoring and alerting
 */
export interface SecurityEvent {
  type:
    | "signature_invalid"
    | "rate_limit_exceeded"
    | "quota_exceeded"
    | "suspicious_activity";
  timestamp: number;
  details: Record<string, unknown>;
}

export function logSecurityEvent(event: SecurityEvent): void {
  // In production, you might want to send this to a monitoring service
  // like Datadog, Sentry, or your own logging infrastructure
  console.warn("[SECURITY EVENT]", JSON.stringify(event));

  // TODO: Integrate with your monitoring/alerting system
  // Examples:
  // - Send to Sentry
  // - Send to Datadog
  // - Trigger PagerDuty alert for critical events
  // - Log to a security-specific database table
}
