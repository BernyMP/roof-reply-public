import test from "node:test";
import assert from "node:assert/strict";
import { SOCIAL_CONFIG, socialConfigurationErrors } from "./social-config.ts";

test("another hosted deployment cannot activate the same social account schedule", () => {
  const original = process.env.CONVEX_CLOUD_URL;
  const config = {
    ...SOCIAL_CONFIG,
    sampleApproved: true,
    instagramBioConfirmed: true,
    organizationId: "111111111111111111111111",
    facebookChannelId: "222222222222222222222222",
    instagramChannelId: "333333333333333333333333",
  };
  try {
    process.env.CONVEX_CLOUD_URL = config.deploymentUrl;
    assert.deepEqual(socialConfigurationErrors(config), []);
    process.env.CONVEX_CLOUD_URL = "https://other-deployment.convex.cloud";
    assert.match(
      socialConfigurationErrors(config).join(" "),
      /different Convex deployment/,
    );
  } finally {
    if (original === undefined) delete process.env.CONVEX_CLOUD_URL;
    else process.env.CONVEX_CLOUD_URL = original;
  }
});
