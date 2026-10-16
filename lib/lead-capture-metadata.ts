import { z } from "zod";
import { campaignQuery } from "./journey-attribution.ts";
import { FOLLOW_UP_REQUESTS } from "./acquisition-campaign.ts";

export const captureMetadataSchema = z.object({
  attribution: z.record(z.unknown()).optional().transform((input) => {
    if (!input) return undefined;
    const strings = Object.entries(input).filter((entry): entry is [string, string] => typeof entry[1] === "string");
    return Object.fromEntries(new URLSearchParams(campaignQuery(new URLSearchParams(strings).toString())));
  }),
  followUpRequest: z.object({
    version: z.enum(["assessment_follow_up_v1", "kit_follow_up_v1"]),
    accepted: z.literal(true),
  }).optional(),
});

export function followUpReceipt(version: keyof typeof FOLLOW_UP_REQUESTS, requestedAt: number) {
  return { version, wording: FOLLOW_UP_REQUESTS[version], requestedAt };
}
