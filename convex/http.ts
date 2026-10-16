import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { bridge as socialAgentBridge } from "./socialAgentHttp";
const http = httpRouter();
http.route({ path: "/social-agent/bridge", method: "POST", handler: socialAgentBridge });
http.route({
  path: "/ingest/telnyx",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.ROOFREPLY_SERVICE_SECRET;
    if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
      return new Response("Unauthorized", { status: 401 });
    const body = await request.text();
    if (new TextEncoder().encode(body).length > 65536)
      return new Response("Payload too large", { status: 413 });
    try {
      await ctx.runMutation(internal.automation.ingest, { body });
      return Response.json({ accepted: true });
    } catch {
      return new Response("Unable to persist event", { status: 503 });
    }
  }),
});
http.route({
  path: "/ingest/event-demo", method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.EVENT_DEMO_SERVICE_SECRET;
    if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
      return new Response("Unauthorized", { status: 401 });
    const body = await request.text();
    if (new TextEncoder().encode(body).length > 8192) return new Response("Payload too large", { status: 413 });
    try {
      const result = await ctx.runMutation(internal.eventDemo.enroll, JSON.parse(body));
      return Response.json(result, { status: result.ok ? 200 : result.status === "invalid" ? 400 : ["daily_limit", "cooldown", "rate_limited"].includes(result.status) ? 429 : 503 });
    } catch {
      return Response.json({ ok: false, status: "unavailable", message: "The demo could not start. Please retry your request." }, { status: 503 });
    }
  }),
});
for (const kind of ["lead-magnet", "demo-consent"] as const)
  http.route({
    path: `/ingest/${kind}`,
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      const secret = process.env.ROOFREPLY_SERVICE_SECRET;
      if (
        !secret ||
        request.headers.get("authorization") !== `Bearer ${secret}`
      )
        return new Response("Unauthorized", { status: 401 });
      const body = await request.text();
      if (body.length > 16384)
        return new Response("Payload too large", { status: 413 });
      try {
        const input = JSON.parse(body);
        if (kind === "demo-consent")
          return Response.json(
            await ctx.runMutation(internal.demoSmsConsent.capture, input),
          );
        const limit = await ctx.runMutation(
          internal.usageControl.checkRateLimit,
          { key: `lead-magnet:${input.ip}`, limit: 5, windowMs: 3600000 },
        );
        if (!limit.allowed)
          return new Response("Rate limited", { status: 429 });
        const id = await ctx.runMutation(internal.leadMagnet.createLead, {
          ...input.lead,
          captureEventId: crypto.randomUUID(),
        });
        const receipt = await ctx.runQuery(internal.leadMagnet.captureReceipt, { id });
        return Response.json({ success: true, captured: true, eventId: receipt.eventId });
      } catch {
        return new Response("Unable to capture submission", { status: 503 });
      }
    }),
  });
export default http;
