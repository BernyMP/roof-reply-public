import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { LOCAL_EXECUTION, type WorkerClaim } from "../agents/social/src/local-worker";

export const workerClaim = v.optional(v.object({ workerId: v.string(), token: v.string() }));

export async function claimHash(token: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function requireRunClaim(run: Doc<"socialAgentRuns">, claim?: WorkerClaim) {
  if (run.executionMode !== LOCAL_EXECUTION) {
    if (claim) throw new Error("Assignment belongs to the hosted runtime.");
    return;
  }
  if (!claim || run.workerId !== claim.workerId || !run.claimHash ||
      run.claimHash !== await claimHash(claim.token) ||
      !run.dispatchUntil || run.dispatchUntil <= Date.now() ||
      ["cancelled", "failed"].includes(run.status))
    throw new Error("Local assignment claim is missing, expired, or closed.");
}
