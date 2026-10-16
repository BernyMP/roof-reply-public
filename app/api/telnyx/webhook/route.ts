import { NextRequest, NextResponse } from "next/server";
import {
  extractTelnyxHeaders,
  validateTelnyxSignature,
} from "@/lib/webhook-security";
import { parseTelnyxEvent } from "@/lib/automation-policy";
import { sendToConvexService } from "@/lib/convex-service";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  if (Number(request.headers.get("content-length")) > 65536)
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  const body = await request.text();
  if (Buffer.byteLength(body) > 65536)
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  const { signature, timestamp } = extractTelnyxHeaders(request.headers);
  if (
    !signature ||
    !timestamp ||
    !validateTelnyxSignature(body, signature, timestamp).valid
  )
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  let input;
  try {
    input = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const type = input?.data?.event_type;
  if (
    typeof type === "string" &&
    ![
      "call.initiated",
      "message.received",
      "message.sent",
      "message.finalized",
    ].includes(type)
  )
    return NextResponse.json({ status: "ignored" });
  try {
    parseTelnyxEvent(input);
  } catch {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }
  try {
    const result = await sendToConvexService("/ingest/telnyx", body);
    if (!result.ok)
      return NextResponse.json(
        { error: "Event could not be persisted" },
        { status: 503 },
      );
    return NextResponse.json({ status: "accepted" });
  } catch {
    return NextResponse.json(
      { error: "Event could not be persisted" },
      { status: 503 },
    );
  }
}
export async function GET() {
  return NextResponse.json({
    service: "RoofReply Telnyx webhook",
    configured: Boolean(
      process.env.ROOFREPLY_SERVICE_SECRET &&
      process.env.CONVEX_SITE_URL &&
      process.env.TELNYX_PUBLIC_KEY,
    ),
  });
}
