"use node";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireOpsAdmin } from "./authHelpers.util";

async function read(path: string) {
  const key = process.env.TELNYX_API_KEY;
  if (!key) throw new Error("TELNYX_API_KEY is missing in Convex");
  const response = await fetch(`https://api.telnyx.com/v2/${path}`, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new Error(`Provider verification failed (${response.status})`);
  return (await response.json()).data;
}
export const verifyAssignment = action({
  args: {
    clerkId: v.string(),
    phoneNumber: v.string(),
    phoneNumberId: v.string(),
    profileId: v.string(),
    voiceId: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    await requireOpsAdmin(ctx);
    for (const id of [args.phoneNumberId, args.profileId, args.voiceId])
      if (!/^[a-zA-Z0-9-]+$/.test(id))
        throw new Error("Invalid provider identifier");
    const base = process.env.PUBLIC_APP_URL;
    if (!base) throw new Error("PUBLIC_APP_URL is missing in Convex");
    const expected = new URL("/api/telnyx/webhook", base).href;
    if (!expected.startsWith("https://"))
      throw new Error("Use a public HTTPS deployment");
    const token = crypto.randomUUID();
    await ctx.runMutation(internal.pilot.reserveAssignment, { ...args, token });
    try {
      const [number, messaging, profile, voice] = await Promise.all([
        read(`phone_numbers/${args.phoneNumberId}`),
        read(`phone_numbers/${args.phoneNumberId}/messaging`),
        read(`messaging_profiles/${args.profileId}`),
        read(`call_control_applications/${args.voiceId}`),
      ]);
      if (
        number.phone_number !== args.phoneNumber ||
        number.status !== "active"
      )
        throw new Error(
          "Number ownership or active status could not be verified",
        );
      if (messaging.messaging_profile_id !== args.profileId)
        throw new Error(
          "Messaging profile mismatch. Configure the provider explicitly before retrying.",
        );
      if (number.connection_id !== args.voiceId)
        throw new Error("Voice application mismatch");
      if (
        profile.enabled !== true ||
        String(profile.webhook_api_version) !== "2" ||
        profile.webhook_url !== expected
      )
        throw new Error(
          "Messaging profile webhook is not ready for this deployment",
        );
      if (
        voice.active !== true ||
        String(voice.webhook_api_version) !== "2" ||
        voice.webhook_event_url !== expected
      )
        throw new Error("Voice webhook is not ready for this deployment");
      await ctx.runMutation(internal.pilot.finishAssignment, {
        clerkId: args.clerkId,
        token,
        success: true,
      });
      return { success: true };
    } catch (error) {
      await ctx.runMutation(internal.pilot.finishAssignment, {
        clerkId: args.clerkId,
        token,
        success: false,
      });
      throw error;
    }
  },
});

export const reconcileMessage = action({
  args: { id: v.id("outboundMessages"), providerId: v.string() },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    await requireOpsAdmin(ctx);
    if (!/^[a-zA-Z0-9-]+$/.test(args.providerId))
      throw new Error("Invalid provider message ID");
    const message = await read(`messages/${args.providerId}`);
    if (
      !message.from?.phone_number ||
      message.to?.length !== 1 ||
      !message.to[0].status
    )
      throw new Error("Provider delivery evidence is incomplete");
    await ctx.runMutation(internal.automation.reconcile, {
      id: args.id,
      providerId: args.providerId,
      sender: message.from.phone_number,
      recipient: message.to[0].phone_number,
      status: message.to[0].status,
    });
    return { success: true };
  },
});
