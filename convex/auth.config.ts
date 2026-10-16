import type { AuthConfig } from "convex/server";

function decodePublishableKeyFrontendApi(
  publishableKey: string | undefined
): string | null {
  if (!publishableKey) return null;

  const encoded = publishableKey.split("_")[2];
  if (!encoded) return null;

  try {
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const decoded = atob(padded);

    if (!decoded.endsWith("$")) return null;

    return decoded.slice(0, -1);
  } catch {
    return null;
  }
}

function getClerkIssuerDomain(): string {
  const configured =
    process.env.CLERK_JWT_ISSUER_DOMAIN ?? process.env.NEXT_PUBLIC_CLERK_DOMAIN;

  if (configured) {
    return configured.startsWith("https://") ? configured : `https://${configured}`;
  }

  const frontendApi = decodePublishableKeyFrontendApi(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  );

  if (!frontendApi) {
    throw new Error(
      "Missing Clerk issuer configuration. Set CLERK_JWT_ISSUER_DOMAIN or NEXT_PUBLIC_CLERK_DOMAIN."
    );
  }

  return `https://${frontendApi}`;
}

export default {
  providers: [
    {
      domain: getClerkIssuerDomain(),
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
