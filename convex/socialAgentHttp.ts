import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { matchesSecret } from "../agents/social/src/social-agent-auth";
import { validateSocialPng } from "@roofreply/social-agent/image";

export const bridge = httpAction(async (ctx, request) => {
  const operator = request.headers.get("x-roofreply-operator");
  const isWorker = !operator && await matchesSecret(request.headers.get("authorization"), process.env.SOCIAL_AGENT_WORKER_SECRET);
  const authorized = isWorker || await matchesSecret(
    request.headers.get("authorization"),
    operator
      ? process.env.SOCIAL_AGENT_OPERATOR_SECRET
      : process.env.SOCIAL_AGENT_SERVICE_SECRET,
  );
  if (!authorized) return new Response("Unauthorized", { status: 401 });
  if (
    operator &&
    !(process.env.SOCIAL_OPERATOR_CLERK_IDS || "")
      .split(",")
      .map((x) => x.trim())
      .includes(operator)
  )
    return new Response("Forbidden", { status: 403 });
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > 11000000)
    return new Response("Payload too large", { status: 413 });
  try {
    const { op, input: supplied = {} } = JSON.parse(raw);
    const { claim: _untrustedClaim, ...input } = supplied;
    void _untrustedClaim;
    if (operator && op === "local-cutover")
      return Response.json(await ctx.runMutation(internal.socialAgentWorker.cutover, { ...input, operator }));
    if (op.startsWith("worker-")) {
      if (!isWorker) return new Response("Forbidden", { status: 403 });
      switch (op) {
        case "worker-heartbeat": return Response.json(await ctx.runMutation(internal.socialAgentWorker.heartbeat, input));
        case "worker-verified": return Response.json(await ctx.runMutation(internal.socialAgentWorker.verified, input));
        case "worker-claim": return Response.json(await ctx.runMutation(internal.socialAgentWorker.claim, input));
        case "worker-receipt": return Response.json(await ctx.runQuery(internal.socialAgentWorker.receipt, input));
      }
    }
    if (!operator) {
      if (isWorker) input.claim = { workerId: request.headers.get("x-roofreply-worker"), token: request.headers.get("x-roofreply-claim") };
      // Prevent the hosted service from reading/writing a local assignment.
      if (input.runId) await ctx.runQuery(internal.socialAgentWorker.authorize, { runId: input.runId, claim: input.claim });
    }
    if (op === "worker-finish") {
      if (!isWorker) return new Response("Forbidden", { status: 403 });
      return Response.json(await ctx.runMutation(internal.socialAgentWorker.finish, input));
    }
    if (operator) {
      if (op === "snapshot")
        return Response.json(
          await ctx.runQuery(internal.socialAgent.snapshot, {}),
        );
      if (op === "context")
        return Response.json(
          await ctx.runQuery(internal.socialAgent.context, { runId: input.runId }),
        );
      if (op !== "image" && op !== "edit")
        return Response.json(
          await ctx.runMutation(internal.socialAgent.control, {
            op,
            input,
            operator,
          }),
        );
    }
    switch (op) {
      case "context":
        return Response.json(
          await ctx.runQuery(internal.socialAgent.context, { runId: input.runId }),
        );
      case "plan":
        return Response.json(
          await ctx.runMutation(internal.socialAgent.plan, input),
        );
      case "reserve":
        return Response.json(
          await ctx.runMutation(internal.socialAgent.reserve, input),
        );
      case "settle":
        return Response.json(
          await ctx.runMutation(internal.socialAgent.settle, input),
        );
      case "bind":
        return Response.json(
          await ctx.runMutation(internal.socialAgent.dispatch, input),
        );
      case "preferences":
        return Response.json(
          await ctx.runMutation(internal.socialAgent.preferences, input),
        );
      case "research":
        return Response.json(
          await ctx.runMutation(internal.socialAgent.research, input),
        );
      case "event":
        return Response.json(
          await ctx.runMutation(internal.socialAgent.event, input),
        );
      case "inspected":
        return Response.json(
          await ctx.runMutation(internal.socialAgent.inspected, input),
        );
      case "review":
        return Response.json(
          await ctx.runMutation(internal.socialAgent.review, input),
        );
      case "edit":
      case "draft": {
        if (op === "edit" && !operator)
          return new Response("Forbidden", { status: 403 });
        const { png, ...args } = input;
        if (typeof png !== "string" || png.length > 10700000)
          throw new Error("Invalid image.");
        const bytes = Uint8Array.from(atob(png), (c) => c.charCodeAt(0));
        validateSocialPng(bytes);
        const hash = Array.from(
          new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
        )
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        const imageId = await ctx.storage.store(
          new Blob([bytes], { type: "image/png" }),
        );
        try {
          if (op === "edit")
            return Response.json(
              await ctx.runMutation(internal.socialAgent.control, {
                op,
                input: { ...args, imageId, imageHash: hash },
                operator: operator!,
              }),
            );
          const draft = await ctx.runMutation(internal.socialAgent.saveDraft, {
            ...args,
            imageId,
            imageHash: hash,
          });
          if (draft?.imageId !== imageId) await ctx.storage.delete(imageId);
          return Response.json(draft);
        } catch (e) {
          await ctx.storage.delete(imageId);
          throw e;
        }
      }
      case "image": {
        const state = await ctx.runQuery(internal.socialAgent.context, {
          runId: input.runId,
        });
        const draft = state.drafts.find((d) => d.version === input.version);
        if (!draft) return new Response("Not found", { status: 404 });
        const blob = await ctx.storage.get(draft.imageId);
        return blob
          ? new Response(blob, {
              headers: {
                "Content-Type": "image/png",
                "Cache-Control": "private, no-store",
              },
            })
          : new Response("Not found", { status: 404 });
      }
      default:
        return new Response("Unknown operation", { status: 400 });
    }
  } catch {
    return Response.json(
      {
        error:
          "Social operation rejected. Check assignment state, input, limits, and authorization.",
      },
      { status: 409 },
    );
  }
});
