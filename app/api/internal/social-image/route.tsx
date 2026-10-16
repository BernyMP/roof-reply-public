import { timingSafeEqual } from "node:crypto";
import { ImageResponse } from "next/og";
import { graphicSchema } from "@roofreply/social-agent/content";
import { SocialGraphicImage } from "@roofreply/social-agent/graphic";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const secret = process.env.ROOFREPLY_SERVICE_SECRET;
  const actual = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret || ""}`);
  if (
    !secret ||
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected)
  )
    return new Response("Unauthorized", { status: 401 });
  // Stream with a bound instead of trusting Content-Length.
  const reader = request.body?.getReader();
  if (!reader) return new Response("Missing body", { status: 400 });
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 8192) {
      await reader.cancel();
      return new Response("Payload too large", { status: 413 });
    }
    chunks.push(value);
  }
  try {
    const graphic = graphicSchema.parse(
      JSON.parse(Buffer.concat(chunks).toString("utf8")),
    );
    return new ImageResponse(<SocialGraphicImage graphic={graphic} />, {
      width: 1080,
      height: 1350,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return new Response("Invalid graphic", { status: 400 });
  }
}
