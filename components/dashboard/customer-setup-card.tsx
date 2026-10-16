import Link from "next/link";
import { Check, ArrowUpRight, MessageSquareText } from "lucide-react";
import { customerSetupPresentation } from "@/lib/account-presentation";
import type { ReadyAccount } from "@/lib/automation-policy";
import { formatPhoneNumber } from "@/lib/format-phone";

export function CustomerSetupCard({ account }: { account: ReadyAccount }) {
  const state = customerSetupPresentation(account);
  return (
    <section
      id="setup"
      className="rr-service-card scroll-mt-6"
      aria-labelledby="service-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-widest">
          {state.nextStep}
        </p>
        <span className="rr-service-badge">
          <span
            aria-hidden="true"
            className={state.live ? "bg-emerald-300" : "bg-orange-200"}
          />
          {state.label}
        </span>
      </div>
      <h2
        id="service-heading"
        className="mt-5 text-2xl font-semibold tracking-tight sm:text-3xl"
      >
        {state.title}
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[#d3dedf]">
        {state.detail}
      </p>
      {!state.live && (
        <ol className="rr-service-progress" aria-label="Service setup progress">
          {[
            { label: "Details received", complete: true },
            {
              label: "Configuration checked",
              complete: state.configurationReady,
            },
            { label: "Service live", complete: state.live },
          ].map((item, index) => (
            <li key={item.label}>
              <span>
                {item.complete ? (
                  <Check size={14} aria-hidden="true" />
                ) : (
                  index + 1
                )}
              </span>
              <div>
                {item.label}
                <small>
                  {item.complete
                    ? "Complete"
                    : "RoofReply will handle this with you"}
                </small>
              </div>
            </li>
          ))}
        </ol>
      )}
      <div className="mt-6 flex flex-wrap items-center gap-5">
        <Link className="rr-service-action" href={state.actionHref}>
          {state.actionLabel}
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
        {!state.live && !state.needsConsent && (
          <span className="text-xs text-[#d3dedf]">
            Next: review your preferences and arrange a test with Berny.
          </span>
        )}
        {state.live && account.bookingDeliveryPhone && (
          <p className="flex items-center gap-2 text-sm text-[#d3dedf]">
            <MessageSquareText size={16} aria-hidden="true" />
            Lead alerts: {formatPhoneNumber(account.bookingDeliveryPhone)}
          </p>
        )}
      </div>
    </section>
  );
}
