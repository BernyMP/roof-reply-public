import { JourneyLink } from "./journey-link";
import { MarketingSignIn } from "./marketing-sign-in";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  AUDIT_CTA_LABEL,
  AUDIT_CTA_URL,
  IMPLEMENTATION_COPY,
  MONTHLY_MANAGEMENT_COPY,
  INITIAL_COMMITMENT_COPY,
  PAYMENT_SCHEDULE_COPY,
  INCLUDED_FOLLOWUPS_COPY,
  FREE_USAGE_COPY,
  QUALIFICATION_ASSURANCE_COPY,
} from "@/lib/pricing-copy";
import { REPORTING_MEASURES } from "@/lib/marketing-copy";

export function DemoBookingLink({
  label = AUDIT_CTA_LABEL,
}: {
  label?: string;
}) {
  return (
    <JourneyLink className="rr-button" href={AUDIT_CTA_URL}>
      {label}
      <ArrowUpRight size={16} aria-hidden="true" />
    </JourneyLink>
  );
}
export function AssessmentLink({ label = "Get my free missed-call assessment" }: { label?: string }) {
  return (
    <JourneyLink className="rr-button" href="/calculator">
      {label}<ArrowUpRight size={16} aria-hidden="true" />
    </JourneyLink>
  );
}
export function MarketingHeader({ variant = "default" }: { variant?: "default" | "home" }) {
  const isHome = variant === "home";
  return (
    <header className="rr-site-header">
      <div className="rr-site-wrap rr-site-nav">
        <Link href="/" className="rr-site-brand">
          <Image src="/icon-svg.svg" alt="" width={30} height={30} priority />
          RoofReply
        </Link>
        <nav aria-label="Main navigation" className="rr-site-links">
          <Link href={isHome ? "#how-it-works" : "/how-it-works"}>How it works</Link>
          {isHome ? (
            <JourneyLink href={AUDIT_CTA_URL}>Book an audit</JourneyLink>
          ) : <Link href="/pricing">Pricing</Link>}
          {!isHome && <Link href="/about">About</Link>}
        </nav>
        <div className="rr-site-actions">
          <MarketingSignIn />
          {isHome ? <JourneyLink className="rr-button" href="/rescue-kit">Get the free Rescue Kit<ArrowUpRight size={16} aria-hidden="true" /></JourneyLink> : <AssessmentLink label="Free assessment" />}
        </div>
      </div>
    </header>
  );
}
export function MarketingFooter({ variant = "default" }: { variant?: "default" | "home" }) {
  const isHome = variant === "home";
  return (
    <footer className="rr-site-footer rr-site-wrap">
      <div>
        <Link className="rr-site-brand" href="/">
          RoofReply
        </Link>
        {isHome ? (
          <p>Questions or need a hand?<br /><a href="mailto:hello@example.com">hello@example.com</a></p>
        ) : <p>Managed recovery for missed roofing opportunities.</p>}
      </div>
      <nav aria-label="Footer">
        {!isHome && <>
          <Link href="/how-it-works">How it works</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/about">About</Link>
          <Link href="/calculator">Revenue recovery assessment</Link>
          <Link href="/specials/pilot">Founding offer</Link>
        </>}
        <Link href="/demo-sms">SMS consent</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/sms-disclosure">SMS terms</Link>
      </nav>
    </footer>
  );
}
export function ProductPreview() {
  return (
    <div
      className="rr-product-preview"
      aria-label="Sample homeowner conversation and lead summary"
    >
      <div className="rr-preview-top">
        <span>Missed call → customer conversation</span>
        <span className="rr-label">Sample</span>
      </div>
      <div className="rr-preview-grid">
        <div className="rr-preview-thread">
          <div className="rr-preview-bubble rr-preview-business">
            Hi, this is Summit Roofing. Sorry we missed your call. What can we
            help with?
          </div>
          <div className="rr-preview-bubble">
            I’m Jordan in Mesa. There’s a leak near the chimney after last
            night’s rain.
          </div>
          <div className="rr-preview-bubble rr-preview-business">
            Is water coming in now?
          </div>
          <div className="rr-preview-bubble">
            Not right now, but I’d like someone to check it this week.
          </div>
          <div className="rr-preview-bubble rr-preview-business">
            Thanks, Jordan. The roofing team will review your details and follow
            up.
          </div>
        </div>
        <aside className="rr-preview-summary">
          <p className="rr-eyebrow">Roofing opportunity</p>
          <h3>Jordan · Mesa</h3>
          <p>
            Leak near the chimney after rain. No active leak. Requests a visit
            this week.
          </p>
          <dl>
            <div>
              <dt>Roofing issue</dt>
              <dd>Leak repair</dd>
            </div>
            <div>
              <dt>Timing</dt>
              <dd>This week</dd>
            </div>
            <div>
              <dt>Next step</dt>
              <dd>Awaiting contractor follow-up</dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}

export function FoundingPricePanel() {
  return (
    <div className="rr-price-panel">
      <p className="rr-eyebrow">Founding engagement</p>
      <div className="rr-founding-price">
        <strong>{MONTHLY_MANAGEMENT_COPY}</strong>
        <p>{IMPLEMENTATION_COPY}</p>
      </div>
      <p className="rr-commitment">
        <strong>{INITIAL_COMMITMENT_COPY}</strong>
        <br />
        For our first five qualifying roofing companies.
      </p>
      <p>{INCLUDED_FOLLOWUPS_COPY}.</p>
      <p>{FREE_USAGE_COPY}</p>
      <p>{PAYMENT_SCHEDULE_COPY}</p>
      <div className="rr-price-pilot">
        <h3>What to expect</h3>
        <p>{QUALIFICATION_ASSURANCE_COPY}</p>
      </div>
      <DemoBookingLink />
    </div>
  );
}
export function MonthlyReporting({ detailed = false }: { detailed?: boolean }) {
  return (
    <div className="rr-reporting">
      <h3>Know what the workflow is recovering.</h3>
      <p>
        Monthly reports are prepared by the founder from available records and
        your team’s feedback. Inspections are contractor-confirmed. Sample and
        demo activity is excluded.
      </p>
      {detailed ? (
        <dl className="rr-report-definitions">
          {REPORTING_MEASURES.map(([name, description]) => (
            <div key={name}>
              <dt>{name}</dt>
              <dd>{description}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <ul className="rr-report-measures">
          {REPORTING_MEASURES.map(([name]) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
