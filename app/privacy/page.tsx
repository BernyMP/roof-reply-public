import { pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = pageMetadata("/privacy", "Privacy Policy", "How Web Shinobi LLC collects, uses and protects information when you use RoofReply.", true);

export default function PrivacyPage() {
  return (
    <main className="rr-public-page">
      <article className="rr-public-article">
        <Link href="/" className="rr-public-page-link">
          ← Back to Home
        </Link>

        <h1 className="rr-public-heading">Privacy Policy</h1>
        <p className="rr-public-updated">
          RoofReply, operated by Web Shinobi LLC — Last Updated: September 9,
          2026
        </p>

        <div className="rr-public-document rr-public-content">
          <p>
            RoofReply is operated by Web Shinobi LLC. RoofReply ("we", "our",
            "us") is the product and service name for managed missed-call
            recovery for residential roofing companies. This Privacy Policy
            explains how Web Shinobi LLC collects, uses, and protects your
            information when you use RoofReply.
          </p>

          <section>
            <h2 className="text-xl font-semibold text-foreground">
              Information We Collect
            </h2>
            <p>We may collect:</p>
            <ul className="list-disc list-inside">
              <li>Name</li>
              <li>Email address</li>
              <li>Phone number</li>
              <li>Business information</li>
              <li>Form submissions</li>
              <li>
                Booking information supplied through booking providers or by
                your contractor; this does not imply automatic calendar
                synchronization
              </li>
              <li>SMS conversation content and history</li>
              <li>Basic analytics data (page views, device type, region)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">
              How We Use Your Information
            </h2>
            <p>We use your information to:</p>
            <ul className="list-disc list-inside">
              <li>Contact you about your inquiry</li>
              <li>Schedule calls</li>
              <li>Provide services</li>
              <li>Improve website performance</li>
              <li>Run analytics</li>
            </ul>
            <p className="text-muted-foreground">
              We do not sell or rent your information. We may use service
              providers only as needed to operate RoofReply, maintain records,
              deliver messages, prevent abuse, provide support, or comply with
              carrier or legal requirements.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">
              SMS Messaging
            </h2>
            <p className="text-muted-foreground">
              RoofReply provides automated SMS customer-care and service
              messages on behalf of participating roofing businesses. When you
              call or text a RoofReply-powered phone number about a roofing
              service inquiry:
            </p>
            <ul className="list-disc list-inside">
              <li>
                Your phone number and message content are collected to
                facilitate communication
              </li>
              <li>
                Information you provide, such as name, location, and roofing
                needs, may be shared with the specific contractor you contacted
              </li>
              <li>
                Message frequency varies, typically up to 10 automated responses
                per roofing inquiry conversation.
              </li>
              <li>Message and data rates may apply.</li>
              <li>
                SMS is customer-care and service related, not marketing or
                promotional messaging
              </li>
            </ul>
            <p className="text-muted-foreground">
              No mobile information will be shared with third parties or
              affiliates for marketing or promotional purposes. Text messaging
              originator opt-in data and consent will not be sold, rented, or
              shared with third parties or affiliates for marketing or
              promotional purposes. We may use service providers only as needed
              to operate the messaging program, maintain consent records,
              deliver messages, prevent abuse, provide support, or comply with
              carrier or legal requirements.
            </p>
            <p className="text-muted-foreground">
              <strong>Opt-out and help:</strong> Reply STOP to opt out. Reply
              HELP for help. Reply START to resubscribe. Carriers are not liable
              for delayed or undelivered messages. For full SMS terms, see our{" "}
              <Link
                href="/sms-disclosure"
                className="text-primary hover:text-primary/80 transition-colors"
              >
                SMS Terms & Disclosure
              </Link>
              .
            </p>
            <p className="text-muted-foreground">
              For the RoofReply live SMS demo, we collect the mobile phone
              number, optional name and company, timestamp, source URL, IP
              address, user agent when available, and the exact SMS consent text
              and version shown at opt-in. We use those records to verify that a
              person expressly consented to receive RoofReply demo SMS messages.
              The demo opt-in form is available at{" "}
              <Link
                href="/demo-sms"
                className="text-primary hover:text-primary/80 transition-colors"
              >
                /demo-sms
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">
              Cookies & Tracking
            </h2>
            <p className="text-muted-foreground">
              We use basic cookies and analytics. You may disable cookies in
              your browser.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">
              Data Protection
            </h2>
            <p className="text-muted-foreground">
              We use standard security measures to protect stored information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">
              Your Rights
            </h2>
            <p className="text-muted-foreground">
              You may request to access, correct, or delete your personal data
              at any time.
            </p>
            <p className="text-muted-foreground">
              Contact:{" "}
              <a
                href="mailto:hello@example.com"
                className="text-primary hover:text-primary/80 transition-colors"
              >
                hello@example.com
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">
              Contact Information
            </h2>
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
