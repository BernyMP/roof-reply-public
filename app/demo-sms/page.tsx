import { pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { DemoSmsForm } from "./demo-sms-form";

export const metadata: Metadata = pageMetadata("/demo-sms", "SMS Demo Opt-In", "Try a live roofing intake demo by text. Limited to 50 participants daily, three tries per number.", false);

export default function DemoSmsPage() {
  return (
    <main className="rr-public-page">
      <div className="rr-public-topbar">
        <Link href="/" className="rr-public-brand">
          <Image
            src="/icon-svg.svg"
            alt="RoofReply logo"
            width={40}
            height={40}
            className="rr-public-logo"
            priority
          />
          <span>RoofReply</span>
        </Link>
        <Link href="/" className="rr-public-back">
          Back to home
        </Link>
      </div>

      <section className="rr-public-demo-grid">
        <div>
          <p className="rr-public-eyebrow">Live event demo</p>
          <h1 className="rr-public-title">Try a RoofReply SMS demo</h1>
          <p className="rr-public-lead">
            Enter your US mobile number and consent to receive an immediate demo
            text. Reply as a homeowner with a roofing problem and watch RoofReply
            collect the details. Limited to 50 phone numbers daily, three tries per
            number, and 20 total messages per conversation. Limits reset at midnight
            Pacific time. The demo may close earlier when its daily budget is used.
            You can browse the site and download the free Rescue Kit without SMS consent.
          </p>

          <div className="rr-public-note-card">
            <div className="rr-public-note-row">
              <ShieldCheck />
              <div>
                <p className="rr-public-note-title">
                  Consent and mobile information
                </p>
                <p className="rr-public-note-copy">
                  At most 10 texts from RoofReply per demo conversation. Message and data rates may apply. Reply STOP to
                  opt out. Reply HELP for help. Consent is not a condition of
                  purchase.
                </p>
              </div>
            </div>
          </div>

          <p className="rr-public-footnote">Already opted in? For the missed-call demonstration, call 202-555-0101 and let it ring unanswered. Texts come from 202-555-0102. Website and call demos share the same limits.</p>

          <Link href="/sms-disclosure" className="rr-public-review-link">
            Review SMS terms
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        <div>
          <DemoSmsForm />
          <p className="rr-public-footnote">
            RoofReply is a product operated by Web Shinobi LLC. See our{" "}
            <Link href="/privacy">Privacy Policy</Link> and{" "}
            <Link href="/terms">Terms of Service</Link>.
          </p>
        </div>
      </section>
    </main>
  );
}
