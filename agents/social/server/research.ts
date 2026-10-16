import { get } from "node:https";
import { lookup } from "node:dns";
import { isIP } from "node:net";
import { publicResearchUrl } from "../src/social-agent.ts";
export function publicAddress(address: string): boolean {
  if (isIP(address) === 6)
    return (
      /^[23][0-9a-f]{3}:/i.test(address) &&
      !address.toLowerCase().startsWith("2001:db8:")
    );
  const [a, b] = address.split(".").map(Number);
  return (
    isIP(address) === 4 &&
    a !== 0 &&
    a !== 10 &&
    a !== 127 &&
    a < 224 &&
    !(a === 169 && b === 254) &&
    !(a === 172 && b >= 16 && b <= 31) &&
    !(a === 192 && [0, 168].includes(b)) &&
    !(a === 100 && b >= 64 && b <= 127) &&
    !(a === 198 && [18, 19, 51].includes(b)) &&
    !(a === 203 && b === 0)
  );
}
export async function fetchResearch(
  raw: string,
  redirects = 0,
): Promise<{ url: string; title: string; excerpt: string; fetchedAt: number }> {
  const url = publicResearchUrl(raw);
  const result = await new Promise<{ text: string; redirect?: string }>(
    (resolve, reject) => {
      const request = get(
        url,
        {
          headers: {
            "User-Agent": "RoofReplyResearch/1.0",
            Accept: "text/html,text/plain,text/markdown",
          },
          lookup: (hostname, options, callback) => {
            lookup(hostname, { all: true }, (error, addresses) => {
              if (
                error ||
                !addresses.length ||
                addresses.some((a) => !publicAddress(a.address))
              ) {
                callback(
                  error || new Error("Non-public research destination."),
                  [],
                );
                return;
              }
              if (options.all) callback(null, addresses);
              else callback(null, addresses[0].address, addresses[0].family);
            });
          },
        },
        (response) => {
          if (
            response.statusCode &&
            response.statusCode >= 300 &&
            response.statusCode < 400
          ) {
            response.resume();
            resolve({ text: "", redirect: response.headers.location });
            return;
          }
          if (
            response.statusCode !== 200 ||
            !/text\/(html|plain|markdown)/.test(
              response.headers["content-type"] || "",
            )
          ) {
            response.resume();
            reject(new Error("Research page unavailable."));
            return;
          }
          let text = "",
            size = 0;
          response.on("data", (chunk) => {
            size += chunk.length;
            if (size > 256000)
              request.destroy(new Error("Research page too large."));
            else text += chunk.toString();
          });
          response.on("end", () => resolve({ text }));
          response.on("error", reject);
        },
      );
      request.setTimeout(10000, () =>
        request.destroy(new Error("Research timeout.")),
      );
      request.on("error", reject);
    },
  );
  if (result.redirect) {
    if (redirects >= 3) throw new Error("Too many redirects.");
    return fetchResearch(
      new URL(result.redirect, url).toString(),
      redirects + 1,
    );
  }
  const title =
    result.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? url.hostname;
  const excerpt = result.text
    .replace(/<(script|style|nav|footer)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
  return {
    url: url.toString(),
    title: title.slice(0, 200),
    excerpt,
    fetchedAt: Date.now(),
  };
}
