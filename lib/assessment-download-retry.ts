import { z } from "zod";
import { assessmentAnswersSchema } from "./missed-call-assessment.ts";
export const DOWNLOAD_RETRY_KEY = "roofreply-assessment-download-retry-v1";
const jobValue = z
  .string()
  .refine(
    (value) =>
      value === "" ||
      (Number.isFinite(Number(value)) &&
        Number(value) >= 0 &&
        Number(value) <= 1_000_000),
  );
export const downloadRetrySchema = z.object({
  answers: assessmentAnswersSchema,
  company: z.string().max(100),
  name: z.string().max(100),
  email: z.string().max(254),
  jobs: z.record(
    z.enum(["repairs", "replacements", "mixed", "unknown"]),
    z.object({ value: jobValue, unknown: z.boolean() }),
  ),
  speed: z.enum(["", "fast", "same-day", "next-day", "unknown"]),
  owner: z.enum(["", "yes", "sometimes", "no", "unknown"]),
  saved: z.boolean(),
  createdAt: z.number().finite(),
});
export function readDownloadRetry(raw: string | null, now = Date.now()) {
  try {
    if (!raw) return null;
    const draft = downloadRetrySchema.parse(JSON.parse(raw));
    return now - draft.createdAt >= 0 && now - draft.createdAt <= 10 * 60 * 1000
      ? draft
      : null;
  } catch {
    return null;
  }
}

export function encodeDownloadRetry(
  draft: Omit<z.infer<typeof downloadRetrySchema>, "createdAt">,
  now = Date.now(),
) {
  return JSON.stringify(
    downloadRetrySchema.parse({ ...draft, createdAt: now }),
  );
}
