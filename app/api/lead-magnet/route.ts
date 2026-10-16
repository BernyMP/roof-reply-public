import { NextRequest, NextResponse } from "next/server";
import { sendToConvexService } from "@/lib/convex-service";
import { parseLeadMagnetSubmission } from "@/lib/lead-magnet-submission";
import { getClientIp } from "@/lib/webhook-security";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const raw = await request.text();
    if (raw.length > 16384)
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    let lead;
    try {
      lead = parseLeadMagnetSubmission(JSON.parse(raw));
    } catch {
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }
    const result = await sendToConvexService(
      "/ingest/lead-magnet",
      JSON.stringify({ lead, ip: getClientIp(request.headers) }),
    );
    const receipt = result.ok ? await result.json() : null;
    return NextResponse.json(
      result.ok && receipt?.captured === true
        ? { success: true, captured: true, eventId: receipt.eventId }
        : { error: "Submission could not be saved. Please try again." },
      { status: result.ok ? 200 : result.status },
    );
  } catch {
    return NextResponse.json(
      { error: "Submission could not be saved. Please try again." },
      { status: 503 },
    );
  }
}
