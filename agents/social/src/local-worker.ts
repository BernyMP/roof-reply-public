export const LOCAL_EXECUTION = "local-chatgpt" as const;
export const SUBSCRIPTION_MODEL = "gpt-6-astra";
export const SUBSCRIPTION_REASONING = "medium" as const;
export const WORKER_POLL_MS = 30_000;
export const WORKER_OFFLINE_MS = 90_000;
export const GENERATION_DEADLINE_MS = 20 * 60_000;

export type WorkerClaim = { workerId: string; token: string };
export type WorkerJournal = {
  workerId: string;
  token: string;
  runId?: string;
  sessionId?: string;
  phase: "claiming" | "claimed" | "dispatching" | "running";
};

export function subscriptionFailure(error: unknown): string | undefined {
  const record = error && typeof error === "object" ? error as { statusCode?: number; responseBody?: string } : {};
  const message = `${error instanceof Error ? error.message : String(error)} ${record.statusCode ?? ""} ${record.responseBody ?? ""}`;
  if (/429|rate.?limit|usage.?limit|quota|insufficient_quota/i.test(message))
    return "ChatGPT subscription limit reached. Wait for your allowance to reset, then run the worker resume command.";
  if (/401|403|sign.?in|login|auth|token.*expir|model.*(?:not.*available|not.*support)|unsupported.*model/i.test(message))
    return "ChatGPT sign-in or model access needs attention. Sign in locally and run the subscription preflight before resuming.";
  return undefined;
}

export function generationMessage(version: number, needsReview: boolean) {
  return needsReview
    ? `Review the current saved operator draft, version ${version}. Read get_context, load the shared editorial-guidelines skill, and call review_draft for this exact version. Wait for the persisted decision. Do not research, rewrite, or save another draft before the reviewer decides. Never publish directly.`
    : "Process your authenticated RoofReply assignment. Read get_context, research within its limits, load the shared editorial-guidelines skill, call plan_content for three different candidate rewards and a selected plan when creative-v2, then save a draft, and call review_draft to obtain an independent persisted reviewer decision. Revise after rejection within the version limit. Never publish directly.";
}
