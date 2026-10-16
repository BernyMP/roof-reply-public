// Deploy a code change to activate or pause. Credentials belong in deployment env.
export const SOCIAL_CONFIG = {
  enabled: false,
  sampleApproved: false,
  instagramBioConfirmed: false,
  organizationId: "000000000000000000000001",
  facebookChannelId: "000000000000000000000002",
  instagramChannelId: "000000000000000000000003",
  renderOrigin: "https://example.invalid",
  deploymentUrl: "https://example.convex.cloud",
  contentMode: "library" as "library" | "openai",
  model: "gpt-4o-mini",
  revision: "social-v2",
  daysAhead: 3,
  maxGenerationAttempts: 2,
  maxSubmissionAttempts: 3,
};

export function socialConfigurationErrors(config = SOCIAL_CONFIG): string[] {
  const errors: string[] = [];
  if (
    process.env.CONVEX_CLOUD_URL &&
    process.env.CONVEX_CLOUD_URL !== config.deploymentUrl
  )
    errors.push("Social agent belongs to a different Convex deployment.");
  if (!config.sampleApproved)
    errors.push("Approve the first sample in social-config.ts.");
  if (!config.instagramBioConfirmed)
    errors.push("Confirm the Instagram bio audit link.");
  for (const key of [
    "organizationId",
    "facebookChannelId",
    "instagramChannelId",
  ] as const) {
    if (!/^[a-f0-9]{24}$/i.test(config[key]))
      errors.push(`Set a verified ${key}.`);
  }
  if (config.facebookChannelId === config.instagramChannelId)
    errors.push("Select two distinct channels.");
  return errors;
}

export function socialConfigRevision() {
  return `${SOCIAL_CONFIG.revision}:${SOCIAL_CONFIG.contentMode}`;
}
