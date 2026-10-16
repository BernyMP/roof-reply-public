import { auth } from "@clerk/nextjs/server";
import { ConvexError } from "convex/values";
import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { z } from "zod";
const input = z.object({
  businessName: z.string().trim().min(1).max(60),
  recipient: z.string().regex(/^\+[1-9]\d{7,14}$/),
  bookingEnabled: z.boolean().optional(),
});
export async function POST(request: Request) {
  const session = await auth();
  if (!session.userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Enter a business name and a phone number with country code." },
      { status: 400 },
    );
  const token = await session.getToken({ template: "convex" });
  if (!token)
    return NextResponse.json(
      { error: "Authentication unavailable" },
      { status: 401 },
    );
  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  client.setAuth(token);
  try {
    return NextResponse.json(
      await client.mutation(api.demoSessions.start, {
        clerkId: session.userId,
        ...parsed.data,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof ConvexError && typeof error.data === "string"
            ? error.data
            : "The test could not start. Check demo activation and SMS consent.",
      },
      { status: 409 },
    );
  }
}
