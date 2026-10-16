"use client";
import { useEffect, useState } from "react";
import { ArrowUpRight, Check, CalendarDays } from "lucide-react";
import Link from "next/link";
import {
  conciergeContactCopy,
  formatConciergeDate,
  type CustomerConcierge,
} from "@/lib/concierge";
import { customerSetupPresentation } from "@/lib/account-presentation";
import type { ReadyAccount } from "@/lib/automation-policy";

export function ConciergeSetupCard({
  concierge,
  account,
  clerkId,
}: {
  concierge: CustomerConcierge;
  account: ReadyAccount;
  clerkId: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [welcome, setWelcome] = useState(false);
  useEffect(() => {
    try {
      if (sessionStorage.getItem("roofreply-enrollment-welcome") === clerkId) {
        setWelcome(true);
        sessionStorage.removeItem("roofreply-enrollment-welcome");
      }
    } catch {
      /* The progress card still works when browser storage is unavailable. */
    }
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, [clerkId]);
  const state = customerSetupPresentation(account);
  const waitingOn = concierge.waitingOn || [];
  const milestones = [
    { label: "Details received", complete: true },
    { label: "Setup with Berny", complete: concierge.setupComplete },
    { label: "Test together", complete: concierge.testComplete },
    { label: "Service live", complete: state.live },
  ];
  const current = milestones.findIndex((item) => !item.complete);
  return (
    <section
      id="setup"
      className="rr-concierge-status scroll-mt-6"
      aria-labelledby="concierge-heading"
    >
      <div className="rr-concierge-status-top">
        <p className="rr-eyebrow">Your personal setup</p>
        <span className="rr-concierge-status-badge">{state.label}</span>
      </div>
      <h2 id="concierge-heading">
        {state.live
          ? "Ready for your next opportunity"
          : welcome
            ? "You’re in good hands."
            : "Getting RoofReply ready for you"}
      </h2>
      <p className="rr-concierge-status-message">
        {state.live
          ? "Missed-call recovery is enabled. Your team can review new opportunities and follow up with homeowners."
          : conciergeContactCopy(concierge, now, welcome)}
      </p>
      <ol className="rr-concierge-progress" aria-label="Service setup progress">
        {milestones.map((item, index) => (
          <li
            key={item.label}
            data-complete={item.complete}
            aria-current={index === current ? "step" : undefined}
          >
            <span>
              {item.complete ? (
                <Check size={15} aria-hidden="true" />
              ) : (
                `0${index + 1}`
              )}
            </span>
            <strong>{item.label}</strong>
            <small>
              {item.complete
                ? "Complete"
                : index === current
                  ? "Up next"
                  : "Coming up"}
            </small>
          </li>
        ))}
      </ol>
      {concierge.kickoffAt && !state.live && (
        <p className="rr-kickoff">
          <CalendarDays size={18} aria-hidden="true" />
          <span>
            {concierge.kickoffAt > now ? "Your kickoff" : "Kickoff recorded"}:{" "}
            <strong>{formatConciergeDate(concierge.kickoffAt)}</strong>
          </span>
        </p>
      )}
      {!state.live && waitingOn.length > 0 && (
        <div className="rr-concierge-waiting">
          <p>Still to confirm with you</p>
          <ul>
            {waitingOn.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="rr-concierge-next">
        <div>
          <p>
            {state.live
              ? "Your next step"
              : state.needsConsent || waitingOn.length > 0
                ? "Your next step"
                : `Next step · ${concierge.nextActionOwner === "berny" ? "Berny" : "You"}`}
          </p>
          <strong>
            {state.live
              ? "Review your roofing opportunities"
              : state.needsConsent
                ? "Confirm your alert mobile and SMS permission"
                : waitingOn.length > 0
                  ? "Share these remaining details with Berny"
                  : concierge.nextAction}
          </strong>
        </div>
        <Link
          href={
            state.live
              ? "/dashboard/leads"
              : state.needsConsent
                ? "/dashboard/config#handoff"
                : "mailto:hello@example.com"
          }
        >
          {state.live
            ? "Review leads"
            : state.needsConsent
              ? "Review details"
              : "Contact Berny"}
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </div>
      {!state.live && (
        <p className="rr-concierge-status-footnote">
          We’ll confirm the details and test together before enabling live
          messaging.
        </p>
      )}
    </section>
  );
}
