import { SITE_URL, absoluteUrl } from "./seo.ts";
import { CORE_PRICE_COPY, INCLUDED_FOLLOWUPS_COPY, ENTERPRISE_SCOPE_COPY } from "./pricing-copy.ts";
import { SERVICE_DESCRIPTION } from "./marketing-copy.ts";

export const organizationSchema = {
  "@context": "https://schema.org", "@type": "Organization", "@id": `${SITE_URL}/#organization`,
  name: "RoofReply", legalName: "Web Shinobi LLC",
  brand: { "@type": "Brand", "@id": `${SITE_URL}/#brand`, name: "RoofReply" },
  url: SITE_URL, logo: `${SITE_URL}/icon-svg.svg`, email: "hello@example.com",
};
export const websiteSchema = {
  "@context": "https://schema.org", "@type": "WebSite", "@id": `${SITE_URL}/#website`,
  name: "RoofReply", url: SITE_URL, publisher: { "@id": `${SITE_URL}/#organization` }, inLanguage: "en-US",
};
export const serviceSchema = {
  "@context": "https://schema.org", "@type": "Service", "@id": `${SITE_URL}/#service`,
  name: "RoofReply managed missed-call recovery", serviceType: "Managed missed-call recovery for residential roofing companies",
  description: SERVICE_DESCRIPTION, url: SITE_URL, provider: { "@id": `${SITE_URL}/#organization` },
  areaServed: { "@type": "Country", name: "United States" },
  offers: {
    "@type": "Offer", "@id": `${SITE_URL}/pricing#offer`, name: "Free founding-client offer: up to 30 days or $100 usage",
    price: "0", priceCurrency: "USD",
    description: `${CORE_PRICE_COPY} ${INCLUDED_FOLLOWUPS_COPY}. ${ENTERPRISE_SCOPE_COPY}`, url: `${SITE_URL}/pricing`,
  },
};
export function breadcrumbSchema(path: string, name: string) {
  return {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name, item: absoluteUrl(path) },
    ],
  };
}
