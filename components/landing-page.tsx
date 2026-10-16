import { ArrowUpRight, PhoneMissed } from "lucide-react";
import { MarketingHeader, MarketingFooter } from "./marketing-shell";
import { JourneyLink } from "./journey-link";
import { AUDIT_CTA_URL } from "@/lib/pricing-copy";
import styles from "./landing-page.module.css";

function PrimaryDemoLink() {
  return (
    <JourneyLink className={styles.primaryAction} href="/demo-sms">
      Try the live demo<ArrowUpRight size={18} aria-hidden="true" />
    </JourneyLink>
  );
}

function AuditLink() {
  return (
    <JourneyLink className={styles.secondaryAction} href={AUDIT_CTA_URL}>
      Book a 20-minute missed-call audit<ArrowUpRight size={16} aria-hidden="true" />
    </JourneyLink>
  );
}

function RecoveryExample() {
  return (
    <figure className={styles.example} aria-labelledby="example-caption">
      <figcaption id="example-caption">
        <span>From a missed call to a homeowner worth calling back.</span>
        <span>Illustrative example</span>
      </figcaption>
      <div className={styles.exampleBody}>
        <div className={styles.conversation}>
          <p className={styles.callEvent}><PhoneMissed size={17} aria-hidden="true" /> Missed homeowner call</p>
          <div className={styles.businessMessage}>
            <span>RoofReply, for your roofing business</span>
            Sorry we missed your call. What can we help with?
          </div>
          <div className={styles.homeownerMessage}>
            <span>Homeowner</span>
            I’m Jordan in Mesa. There’s a leak near the chimney. No water coming in now, but could someone look this week?
          </div>
        </div>
        <div className={styles.handoff}>
          <p className={styles.smallLabel}>Now your team has a next step</p>
          <h2>A roofing need.<br />A homeowner to call.</h2>
          <dl>
            <div><dt>Issue</dt><dd>Leak near the chimney</dd></div>
            <div><dt>Location</dt><dd>Mesa</dd></div>
            <div><dt>Timing</dt><dd>Requested a visit this week</dd></div>
          </dl>
          <p className={styles.status}>Awaiting contractor follow-up</p>
        </div>
      </div>
      <p className={styles.exampleNote}>Fictional conversation. Your team reviews the details and confirms any inspection.</p>
    </figure>
  );
}

export function LandingPage() {
  return (
    <div className={styles.home}>
      <a className={styles.skipLink} href="#main-content">Skip to content</a>
      <MarketingHeader variant="home" />
      <main id="main-content">
        <section className={`${styles.wrap} ${styles.hero}`} aria-labelledby="hero-heading">
          <p className={styles.eyebrow}>Missed-call recovery for residential roofers</p>
          <h1 id="hero-heading">Missed calls shouldn’t<br /><span>cost you roofing jobs.</span></h1>
          <p className={styles.intro}>RoofReply follows up with missed callers by text, finds out what they need, and gives your team the details to turn the next conversation into an inspection.</p>
          <div className={styles.actions}>
            <PrimaryDemoLink />
            <AuditLink />
          </div>
          <p className={styles.serviceNote}>We set it up and manage the follow-up. You handle inspections and sales.</p>
        </section>

        <section id="how-it-works" className={`${styles.wrap} ${styles.mechanism}`} aria-label="How RoofReply helps recover the conversation">
          <RecoveryExample />
        </section>

        <section className={`${styles.wrap} ${styles.nextSteps}`} aria-label="Choose your next step">
          <div className={styles.offer}>
            <p className={styles.smallLabel}>Give your office a practical first step</p>
            <h2>A clear owner.<br />A next action.</h2>
            <p>Get an office follow-up plan, callback scripts, a tracking sheet, and a seven-day review. Free to use with your existing tools. No email required.</p>
            <JourneyLink className={styles.primaryAction} href="/rescue-kit">Get the free Rescue Kit<ArrowUpRight size={18} aria-hidden="true" /></JourneyLink>
          </div>
          <div className={styles.assessment}>
            <p className={styles.smallLabel}>Already know you need help?</p>
            <h2>Let’s talk about<br />your missed calls.</h2>
            <p>Review your current follow-up, see how RoofReply works, and decide whether managed recovery fits your business. No assessment required.</p>
            <AuditLink />
          </div>
        </section>
      </main>
      <MarketingFooter variant="home" />
    </div>
  );
}
