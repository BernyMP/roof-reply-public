import Link from "next/link";
import { MarketingArticle } from "@/components/marketing-article";
import { FoundingPricePanel } from "@/components/marketing-shell";
import { pageMetadata, jsonLd } from "@/lib/seo";
import { serviceSchema } from "@/lib/seo-schema";
import { CORE_PRICE_COPY, FREE_USAGE_COPY, FREE_EXIT_COPY, EXISTING_AGREEMENTS_COPY, QUALIFICATION_ASSURANCE_COPY } from "@/lib/pricing-copy";

export const metadata = pageMetadata("/pricing", "Free Founding-Client Offer", "Free setup for the first five qualifying roofing companies. Up to 30 days or $100 usage per company, whichever comes first. No automatic charges.");
export default function PricingPage() {
  return <MarketingArticle path="/pricing" title="Free setup. A clear limit." intro="A founding-client offer for residential roofers with existing inbound inquiries and a team member responsible for homeowner follow-up.">
    <section className="rr-seo-price-grid"><div><h2>What does RoofReply cost?</h2><p>{CORE_PRICE_COPY}</p><p>Five places means five accepted qualifying companies. We review fit, agree the scope and stage onboarding individually.</p>
      <dl className="rr-seo-schedule">
        <div><dt>Setup and service fee</dt><dd>$0 during the free period</dd></div>
        <div><dt>Duration</dt><dd>Up to 30 days from verified activation</dd></div>
        <div><dt>Usage allowance</dt><dd>Up to $100 per company; the free period ends sooner if reached</dd></div>
        <div><dt>Paid continuation</dt><dd>Only with a separate written agreement</dd></div>
      </dl></div><FoundingPricePanel /></section>
    <section><h2>What counts toward the allowance?</h2><p>{FREE_USAGE_COPY}</p><p>The allowance is measured in provider costs, not a promised number of messages, leads or inspections.</p></section>
    <section><h2>What happens at the end?</h2><p>{FREE_EXIT_COPY}</p><p>{EXISTING_AGREEMENTS_COPY}</p></section>
    <section><h2>What is included?</h2><ul><li>Setup of one agreed missed-call workflow.</li><li>Managed service-related follow-up, roofing intake and contractor handoffs.</li><li>Direct founder support, weekly feedback and a closing value review.</li></ul><p>Your team follows up on handoffs, confirms inspections and closes jobs. <Link href="/how-it-works">See the workflow.</Link></p></section>
    <section><h2>Are results guaranteed?</h2><p>{QUALIFICATION_ASSURANCE_COPY}</p></section>
    <section><h2>Before activation</h2><p>We confirm your service area, follow-up owner, applicable costs and exit arrangements. Customer messaging requires your own approved registration, permissions, routing verification and a successful live rehearsal. A guided demo is not customer activation.</p><p><Link href="/terms">Review the service terms.</Link></p></section>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(serviceSchema) }} />
  </MarketingArticle>;
}
