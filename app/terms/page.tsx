import { pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import {
  CORE_PRICE_COPY,
  INCLUDED_FOLLOWUPS_COPY,
  FREE_USAGE_COPY,
  FREE_EXIT_COPY,
  EXISTING_AGREEMENTS_COPY,
  QUALIFICATION_ASSURANCE_COPY,
} from "@/lib/pricing-copy";

export const metadata: Metadata = pageMetadata("/terms", "Terms of Service", "RoofReply managed missed-call recovery terms, free founding-client offer, usage allowance and service responsibilities.", true);

export default function TermsPage() {
  return (
    <main className="rr-public-page">
      <article className="rr-public-article">
        <Link href="/" className="rr-public-page-link">
          ← Back to Home
        </Link>

        <h1 className="rr-public-heading">Terms of Service</h1>
        <p className="rr-public-updated">
          RoofReply, operated by Web Shinobi LLC — Last Updated: October 13,
          2026
        </p>

        <div className="rr-public-document rr-public-content">
          <p>
            Welcome to RoofReply. RoofReply is operated by Web Shinobi LLC. By
            using this website and our services, you agree to these terms.
          </p>

          <section>
            <h2 className="text-xl font-semibold text-foreground">Services</h2>
            <p className="text-muted-foreground">
              RoofReply is a managed missed-call recovery service provided by
              Web Shinobi LLC for residential roofing companies. We install and
              manage follow-up, gather roofing details, qualify opportunities
              and support inspection handoff. Your roofing team remains
              responsible for sales follow-up, confirming inspections and
              closing jobs. Service details are provided in written proposals or
              agreements.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">Free founding-client offer</h2>
            <p className="text-muted-foreground">
              {CORE_PRICE_COPY} {INCLUDED_FOLLOWUPS_COPY}. This offer is for our
              first five qualifying companies. {FREE_USAGE_COPY} {FREE_EXIT_COPY}
              {" "}{EXISTING_AGREEMENTS_COPY}
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground">
              Results and expectations
            </h2>
            <p className="text-muted-foreground">
              {QUALIFICATION_ASSURANCE_COPY}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">
              Use of Website
            </h2>
            <p className="text-muted-foreground">
              You may not misuse or attempt unauthorized access to this site.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">
              SMS Communications
            </h2>
            <p className="text-muted-foreground">
              RoofReply includes automated SMS messaging to communicate with
              potential customers on behalf of participating roofing businesses.
              Homeowners may initiate communication by calling or texting a
              RoofReply-powered number about a roofing service inquiry,
              including missed-call follow-up. By calling or texting a
              RoofReply-powered number:
            </p>
            <ul className="list-disc list-inside">
              <li>
                You consent to receive automated SMS responses for customer-care
                and service purposes
              </li>
              <li>
                Message frequency varies, typically up to 10 automated responses
                per roofing inquiry conversation.
              </li>
              <li>Message and data rates may apply.</li>
              <li>
                Reply STOP to opt out. Reply HELP for help. Reply START to
                resubscribe.
              </li>
              <li>
                Carriers are not liable for delayed or undelivered messages.
              </li>
              <li>
                SMS is customer-care and service related, not marketing or
                promotional messaging
              </li>
            </ul>
            <p className="text-muted-foreground">
              Roofing inquiry details may be shared with the specific contractor
              you contacted so they can respond to your service request. No
              mobile information will be shared with third parties or affiliates
              for marketing or promotional purposes. Text messaging originator
              opt-in data and consent will not be sold, rented, or shared with
              third parties or affiliates for marketing or promotional purposes.
              We may use service providers only as needed to operate the
              messaging program, maintain consent records, deliver messages,
              prevent abuse, provide support, or comply with carrier or legal
              requirements.
            </p>
            <p className="text-muted-foreground">
              For contractors: You are responsible for ensuring your use of our
              SMS service complies with applicable laws and regulations. See our
              full{" "}
              <Link
                href="/sms-disclosure"
                className="text-primary hover:text-primary/80 transition-colors"
              >
                SMS Terms & Disclosure
              </Link>
              .
            </p>
            <p className="text-muted-foreground">
              The RoofReply live SMS demo is voluntary and is available after
              you provide a mobile phone number in the optional phone field and
              select the SMS consent checkbox at{" "}
              <Link
                href="/demo-sms"
                className="text-primary hover:text-primary/80 transition-colors"
              >
                /demo-sms
              </Link>
              . By opting in, you agree to receive SMS messages from RoofReply,
              a product operated by Web Shinobi LLC, for the live product demo.
              Message frequency varies, typically up to 10 messages per demo
              conversation. Message and data rates may apply. Reply STOP to opt
              out. Reply HELP for help or contact hello@example.com.
              Consent is not a condition of purchase.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">Liability</h2>
            <p className="text-muted-foreground">
              We are not responsible for losses caused by hosting downtime,
              third-party platforms, or technical failures beyond our control.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">Contact</h2>
            <address className="rr-public-contact not-italic space-y-1">
              <p className="font-medium text-foreground">Web Shinobi LLC</p>
              <p>Operator of RoofReply</p>
              <p>Tucson, Arizona</p>
              <p>
                Phone:{" "}
                <a
                  href="tel:202-555-0101"
                  className="hover:text-foreground transition-colors"
                >
                  202-555-0101
                </a>
              </p>
              <p>
                Email:{" "}
                <a
                  href="mailto:hello@example.com"
                  className="text-primary hover:text-primary/80 transition-colors"
                >
                  hello@example.com
                </a>
              </p>
            </address>
          </section>
        </div>
      </article>
    </main>
  );
}
