import { pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import { BookingConfirmationView } from "@/components/journey-link";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-shell";
export const metadata: Metadata = pageMetadata("/specials/pilot/booked", "Your RoofReply Fit Call", "Check your Calendly confirmation for your RoofReply fit-call time and joining details.", false);
export default function PilotBookedPage() {
  return (
    <div className="rr-site">
      <BookingConfirmationView />
      <MarketingHeader />
      <main className="rr-site-wrap rr-site-section">
        <div className="mx-auto max-w-xl space-y-6">
          <p className="rr-eyebrow">Your RoofReply fit call</p>
          <h1>Prepare for your 20-minute fit call.</h1>
          <p>
            Your Calendly confirmation email confirms your booking. Check it for the scheduled time,
            joining link, and rescheduling options.
          </p>
          <p>
            During the 20-minute call, we’ll review your assessment, check fit
            and outline how we would personally install and manage RoofReply
            around your business. Have your assessment results handy if you
            completed one.
          </p>
          <div className="rr-price-panel">
            <h2>What to bring</h2>
            <ul className="mt-4 list-disc space-y-3 pl-5">
              <li>
                A recent call-volume estimate, including missed and after-hours
                prospect calls.
              </li>
              <li>
                Your service area, roofing job mix and the person responsible
                for sales follow-up.
              </li>
              <li>
                Your current phone provider or phone system, how you follow up
                today and a possible number or after-hours window for installation.
              </li>
            </ul>
          </div>
          <Link className="rr-text-link" href="/specials/pilot">
            Review the founding offer →
          </Link>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
