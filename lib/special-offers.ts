import {
  AUDIT_CTA_LABEL,
  AUDIT_CTA_URL,
  CORE_PRICE_COPY,
  FREE_OFFER_HEADLINE,
  INCLUDED_FOLLOWUPS_COPY,
  ENTERPRISE_SCOPE_COPY,
} from "./pricing-copy.ts";
import { marketingFaqs } from "./marketing-copy.ts";

export const SPECIAL_OFFER_CTA_URL = AUDIT_CTA_URL;
export type SpecialOffer = {
  slug: string;
  indexable: boolean;
  metadata: {
    title: string;
    description: string;
    openGraphTitle: string;
    openGraphDescription: string;
  };
  headline: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  price: { terms: string[] };
  faq: { question: string; answer: string }[];
};
export const SPECIAL_OFFERS: Record<string, SpecialOffer> = {
  pilot: {
    slug: "pilot", // Retain existing campaign links and attribution.
    indexable: false,
    metadata: {
      title: "RoofReply Founding Offer",
      description: `${CORE_PRICE_COPY} Founder-managed missed-call recovery for residential roofing companies.`,
      openGraphTitle: "RoofReply Founding Offer",
      openGraphDescription:
        "Free setup for our first five qualifying roofing companies. Up to 30 days or $100 in usage per company, whichever comes first. No automatic charges.",
    },
    headline: FREE_OFFER_HEADLINE,
    primaryCtaLabel: AUDIT_CTA_LABEL,
    primaryCtaHref: AUDIT_CTA_URL,
    price: {
      terms: [
        CORE_PRICE_COPY,
  FREE_OFFER_HEADLINE,
        INCLUDED_FOLLOWUPS_COPY,
        ENTERPRISE_SCOPE_COPY,
        "For the first five accepted qualifying companies. Setup, direct founder support, weekly feedback and a closing review are included. Onboarding is staged individually.",
        "Your team remains responsible for sales follow-up, inspection confirmation and closing jobs. Applicable provider costs and any expansion are agreed in writing before activation.",
      ],
    },
    faq: marketingFaqs,
  },
};
export function getSpecialOffer(slug: string) {
  return SPECIAL_OFFERS[slug];
}
export function getSpecialOfferSlugs() {
  return Object.keys(SPECIAL_OFFERS);
}
