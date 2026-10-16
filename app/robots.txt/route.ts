import { indexingEnabled, isCanonicalHost, robotsContent } from "@/lib/seo";
export function GET(request: Request) {
  return new Response(robotsContent(indexingEnabled() && isCanonicalHost(request.headers.get("host"))), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
}
