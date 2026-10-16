import "server-only";

export async function sendToConvexService(path: string, body: string) {
  const url = process.env.CONVEX_SITE_URL;
  const secret = process.env.ROOFREPLY_SERVICE_SECRET;
  if (!url || !secret) throw new Error("Convex ingestion is not configured");
  return fetch(new URL(path, url), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body,
    signal: AbortSignal.timeout(1500),
  });
}
