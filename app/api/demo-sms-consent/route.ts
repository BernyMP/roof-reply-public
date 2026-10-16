import { NextRequest, NextResponse } from "next/server";
import {
  DEMO_SMS_CONSENT_TEXT,
  DEMO_SMS_CONSENT_VERSION,
} from "@/lib/demo-sms-consent";

export const runtime = "nodejs";

type DemoSmsBody = {
  requestId?: unknown;
  phone?: unknown;
  name?: unknown;
  company?: unknown;
  website?: unknown;
  smsConsent?: unknown;
  sourceUrl?: unknown;
  consentText?: unknown;
  consentVersion?: unknown;
};

type DemoSmsConsentRecord = {
  id: string;
  type: "roofreply_demo_sms_opt_in";
  phoneNumber: string;
  rawPhone: string;
  name: string | null;
  company: string | null;
  timestamp: string;
  sourceUrl: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  consentText: string;
  consentVersion: string;
};

const MAX_JSON_BODY_BYTES = 4096;
const MAX_PHONE_INPUT_LENGTH = 32;
const MAX_NAME_LENGTH = 80;
const MAX_COMPANY_LENGTH = 120;
const MAX_SOURCE_URL_LENGTH = 2048;
const MAX_USER_AGENT_LENGTH = 500;
const MAX_IP_LENGTH = 64;

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() ?? "";
}

function getRequestOrigin(request: NextRequest) {
  const host =
    firstHeaderValue(request.headers.get("x-forwarded-host")) ||
    firstHeaderValue(request.headers.get("host"));

  if (!host) {
    return request.nextUrl.origin.toLowerCase();
  }

  const protocol =
    firstHeaderValue(request.headers.get("x-forwarded-proto")) ||
    request.nextUrl.protocol.replace(":", "") ||
    "https";

  return `${protocol}://${host}`.toLowerCase();
}

function getUrlOrigin(value: string) {
  try {
    return new URL(value).origin.toLowerCase();
  } catch {
    return "";
  }
}

function isSameOriginUrl(value: string, origin: string) {
  return getUrlOrigin(value) === origin;
}

function isTrustedRequestSource(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  const expectedOrigin = getRequestOrigin(request);
  const origin = request.headers.get("origin");

  if (origin) {
    return getUrlOrigin(origin) === expectedOrigin;
  }

  const referer = request.headers.get("referer");

  if (referer) {
    return isSameOriginUrl(referer, expectedOrigin);
  }

  return false;
}

async function readJsonBody(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().includes("application/json")) {
    return {
      response: NextResponse.json(
        { error: "Expected an application/json request." },
        { status: 415 }
      ),
    };
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");

  if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BODY_BYTES) {
    return {
      response: NextResponse.json(
        { error: "Request body is too large." },
        { status: 413 }
      ),
    };
  }

  const text = await request.text();

  if (Buffer.byteLength(text, "utf8") > MAX_JSON_BODY_BYTES) {
    return {
      response: NextResponse.json(
        { error: "Request body is too large." },
        { status: 413 }
      ),
    };
  }

  try {
    return { body: JSON.parse(text) as DemoSmsBody };
  } catch {
    return {
      response: NextResponse.json(
        { error: "Invalid JSON payload." },
        { status: 400 }
      ),
    };
  }
}

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim().slice(0, MAX_IP_LENGTH) ?? "";
  }

  return request.headers.get("x-real-ip")?.slice(0, MAX_IP_LENGTH) ?? "";
}

function normalizePhone(phone: string) {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  if (digits.length === 10) {
    return `+1${digits}`;
  }


  return "";
}

export async function POST(request: NextRequest) {
  if (!isTrustedRequestSource(request)) {
    return NextResponse.json(
      { error: "This form must be submitted from the RoofReply site." },
      { status: 403 }
    );
  }

  const parsedBody = await readJsonBody(request);

  if (parsedBody.response) {
    return parsedBody.response;
  }

  const body = parsedBody.body;

  if (clean(body.website)) {
    return NextResponse.json({ ok: true });
  }

  const rawPhone = clean(body.phone);
  const name = clean(body.name);
  const company = clean(body.company);
  const sourceUrl = clean(body.sourceUrl);

  if (rawPhone.length > MAX_PHONE_INPUT_LENGTH) {
    return NextResponse.json(
      { error: "Enter a valid US mobile phone number." },
      { status: 400 }
    );
  }

  if (name.length > MAX_NAME_LENGTH || company.length > MAX_COMPANY_LENGTH) {
    return NextResponse.json(
      { error: "Name or company is too long." },
      { status: 400 }
    );
  }

  if (sourceUrl.length > MAX_SOURCE_URL_LENGTH) {
    return NextResponse.json(
      { error: "Source URL is too long." },
      { status: 400 }
    );
  }

  if (body.smsConsent !== true) {
    return NextResponse.json(
      { error: "SMS consent is required for this demo." },
      { status: 400 }
    );
  }

  if (!rawPhone) {
    return NextResponse.json({
      ok: true,
      status: "no_phone",
      message:
        "No SMS opt-in was captured because no mobile phone number was provided.",
    });
  }

  const phoneNumber = normalizePhone(rawPhone);

  if (!phoneNumber) {
    return NextResponse.json(
      { error: "Enter a valid US mobile phone number." },
      { status: 400 }
    );
  }

  if (
    clean(body.consentText) !== DEMO_SMS_CONSENT_TEXT ||
    clean(body.consentVersion) !== DEMO_SMS_CONSENT_VERSION
  ) {
    return NextResponse.json(
      { error: "Consent text or version did not match the current opt-in." },
      { status: 400 }
    );
  }

  const requestId = clean(body.requestId) || crypto.randomUUID();
  if (!/^[a-zA-Z0-9-]{16,100}$/.test(requestId)) return NextResponse.json({ error: "Invalid request. Please reload and try again." }, { status: 400 });
  const timestamp = new Date().toISOString();
  const requestOrigin = getRequestOrigin(request);
  const referer = request.headers.get("referer") ?? "";
  const trustedSourceUrl = isSameOriginUrl(sourceUrl, requestOrigin)
    ? sourceUrl
    : isSameOriginUrl(referer, requestOrigin)
      ? referer
      : null;
  const record: DemoSmsConsentRecord = {
    id: requestId,
    type: "roofreply_demo_sms_opt_in",
    phoneNumber,
    rawPhone,
    name: name || null,
    company: company || null,
    timestamp,
    sourceUrl: trustedSourceUrl,
    ipAddress: getClientIp(request) || null,
    userAgent:
      request.headers.get("user-agent")?.slice(0, MAX_USER_AGENT_LENGTH) ||
      null,
    consentText: DEMO_SMS_CONSENT_TEXT,
    consentVersion: DEMO_SMS_CONSENT_VERSION,
  };

  const siteUrl = process.env.EVENT_DEMO_CONVEX_SITE_URL;
  const secret = process.env.EVENT_DEMO_SERVICE_SECRET;
  if (!siteUrl || !secret) return NextResponse.json({ error: "The live demo is temporarily unavailable." }, { status: 503 });
  try {
    const response = await fetch(new URL("/ingest/event-demo", siteUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ record }), signal: AbortSignal.timeout(10000),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) return NextResponse.json({ error: result.message || "The demo could not start. Please retry.", status: result.status }, { status: response.status >= 400 ? response.status : 503 });
    return NextResponse.json({ ok: true, status: result.status, message: result.status === "queued"
      ? "Your first demo text is queued. Reply to it as a homeowner with a roofing problem."
      : "Your demo is already started. Check your phone for the text and reply there." });
  } catch {
    return NextResponse.json({ error: "We couldn't confirm that the demo started. Retry this request; it won't send a duplicate text." }, { status: 503 });
  }
}
