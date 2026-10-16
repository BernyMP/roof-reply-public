import { OfferView } from "./offer-view";
import { FREE_OFFER_SUMMARY } from "@/lib/pricing-copy";
import { JourneyLink } from "./journey-link";
import type { SpecialOffer } from "@/lib/special-offers";
import {
  MarketingHeader,
  MarketingFooter,
  ProductPreview,
  FoundingPricePanel,
  MonthlyReporting,
  DemoBookingLink,
} from "./marketing-shell";
export function SpecialOfferPilotPage({ offer }: { offer: SpecialOffer }) {
  return (
    <div className="rr-site rr-site-pilot">
      <MarketingHeader />
      <OfferView />
      <main className="rr-site-wrap">
        <section className="rr-site-section rr-pilot-intro">
          <p className="rr-eyebrow">For our first five founding clients</p>
          <h1>{offer.headline}</h1>
          <p>{FREE_OFFER_SUMMARY}</p>
          <p>
            Built for established, owner-led residential roofing companies with
            inbound leads, a defined service area and someone responsible for
            sales follow-up. Typically 3–25 employees and 20+ plausible missed
            or after-hours prospect calls a month; larger teams can also be a
            fit.
          </p>
          <JourneyLink className="rr-button" href={offer.primaryCtaHref}>
            {offer.primaryCtaLabel}
          </JourneyLink>
        </section>
        <ProductPreview />
        <section className="rr-site-section">
          <div className="rr-section-heading">
            <h2>We manage the recovery. Your team follows through.</h2>
          </div>
          <ol className="rr-steps">
            {[
              [
                "Install around your business",
                "We configure missed-call routing, service area, qualification criteria and handoffs, then verify permissions and rehearse before activation.",
              ],
              [
                "Manage the conversation",
                "We follow up by text, gather roofing details, qualify the opportunity and move the homeowner toward an inspection. We monitor and refine the workflow with direct founder support.",
              ],
              [
                "Keep people in the loop",
                "Your roofing team reviews handoffs, handles sales follow-up, confirms inspections and closes jobs. A scheduling link is available when configured; it is not a confirmed appointment.",
              ],
            ].map(([title, body], i) => (
              <li key={title}>
                <span className="rr-step-number">0{i + 1}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </li>
            ))}
          </ol>
        </section>
        <section className="rr-site-section rr-pricing-layout">
          <div>
            <h2>The founding engagement.</h2>
            <ul className="rr-offer-terms">
              {offer.price.terms.map((term) => (
                <li key={term}>{term}</li>
              ))}
            </ul>
          </div>
          <FoundingPricePanel />
        </section>
        <section className="rr-site-section">
          <MonthlyReporting detailed />
        </section>
        <section className="rr-site-section rr-faq-layout">
          <div>
            <p className="rr-eyebrow">Before we implement</p>
            <h2>Your questions, answered.</h2>
          </div>
          <div className="rr-faq-list">
            {offer.faq.map((faq) => (
              <details key={faq.question}>
                <summary>{faq.question}</summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="rr-site-section rr-pilot-intro">
          <h2>Start with a 20-minute fit call.</h2>
          <p>
            Review your call volume, recoverable opportunities and fit. We’ll
            discuss a controlled starting point on one number, branch or
            after-hours window.
          </p>
          <DemoBookingLink />
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
