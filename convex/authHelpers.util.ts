export async function requireAuthenticatedClerkId(
  ctx: { auth: { getUserIdentity(): Promise<{ subject: string } | null> } },
  expectedClerkId?: string
) {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    throw new Error("Unauthorized");
  }

  if (expectedClerkId && identity.subject !== expectedClerkId) {
    throw new Error("Forbidden");
  }

  return identity.subject;
}

function getOpsAdminClerkIds() {
  return (process.env.OPS_ADMIN_CLERK_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export async function hasOpsAdminAccess(ctx: {
  auth: { getUserIdentity(): Promise<{ subject: string } | null> };
}) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return false;

  return getOpsAdminClerkIds().includes(identity.subject);
}

export async function requireOpsAdmin(ctx: {
  auth: { getUserIdentity(): Promise<{ subject: string } | null> };
}) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthorized");
  }

  if (!getOpsAdminClerkIds().includes(identity.subject)) {
    throw new Error("Forbidden");
  }

  return identity.subject;
}
