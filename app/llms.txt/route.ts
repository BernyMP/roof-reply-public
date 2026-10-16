import { CORE_PRICE_COPY, INCLUDED_FOLLOWUPS_COPY, ENTERPRISE_SCOPE_COPY, QUALIFICATION_ASSURANCE_COPY } from "@/lib/pricing-copy";
import { SERVICE_DESCRIPTION } from "@/lib/marketing-copy";
import { PUBLIC_PAGES, absoluteUrl } from "@/lib/seo";
export function GET() {
  const text = ["# RoofReply", "", `> ${SERVICE_DESCRIPTION}`, "", "Operated by Web Shinobi LLC. Direct founder support: Berny Peralta, hello@example.com. US residential roofers; initial outreach focuses on Phoenix and Tucson, Arizona.", "", "## Service and pricing", CORE_PRICE_COPY, INCLUDED_FOLLOWUPS_COPY + ". The free period ends after 30 days or $100 usage, whichever comes first.", ENTERPRISE_SCOPE_COPY, QUALIFICATION_ASSURANCE_COPY, "", "Customer activation requires its own approved messaging registration, permissions, routing verification and live acceptance. A guided demo does not establish customer activation. Contractors confirm inspections; sending a booking link does not confirm one. Samples and calculator estimates are illustrative, not performance evidence.", "", "## Official pages", ...PUBLIC_PAGES.map(({ path, name }) => `- [${name}](${absoluteUrl(path)})`), ""].join("\n");
  return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
