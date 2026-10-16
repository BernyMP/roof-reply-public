"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import {
  DEMO_SMS_CONSENT_TEXT,
  DEMO_SMS_CONSENT_VERSION,
} from "@/lib/demo-sms-consent";

type Status =
  | { type: "idle"; message: "" }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

export function DemoSmsForm() {
  const requestId = useRef<string | null>(null);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [website, setWebsite] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<Status>({ type: "idle", message: "" });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!smsConsent) {
      setStatus({
        type: "error",
        message: "Select the SMS consent checkbox to request the demo.",
      });
      return;
    }

    setIsSubmitting(true);
    setStatus({ type: "idle", message: "" });

    try {
      requestId.current ??= crypto.randomUUID();
      const response = await fetch("/api/demo-sms-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: requestId.current,
          phone,
          name,
          company,
          website,
          smsConsent,
          sourceUrl: window.location.href,
          consentText: DEMO_SMS_CONSENT_TEXT,
          consentVersion: DEMO_SMS_CONSENT_VERSION,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          payload?.error ??
            "We could not capture that opt-in. Please try again."
        );
      }

      requestId.current = null;
      setPhone("");
      setName("");
      setCompany("");
      setWebsite("");
      setSmsConsent(false);
      setStatus({
        type: "success",
        message:
          payload?.message ??
          "Your first demo text is queued. Reply to it as a homeowner.",
      });
    } catch (error) {
      setStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "We could not capture that opt-in. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rr-public-form"
    >
      <div className="rr-public-form-grid">
        <label className="rr-public-field rr-public-field-wide">
          <span className="rr-public-label">
            US mobile phone number
          </span>
          <input
            required
            type="tel"
            name="phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            autoComplete="tel"
            placeholder="+1 555 123 4567"
            className="rr-public-input"
          />
          <span className="rr-public-help">
            Enter a number only if you want RoofReply to send the live SMS demo.
          </span>
        </label>
        <label className="rr-public-field">
          <span className="rr-public-label">
            Name <span className="rr-public-muted-inline">(optional)</span>
          </span>
          <input
            type="text"
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            className="rr-public-input"
          />
        </label>
        <label className="rr-public-field">
          <span className="rr-public-label">
            Company <span className="rr-public-muted-inline">(optional)</span>
          </span>
          <input
            type="text"
            name="company"
            value={company}
            onChange={(event) => setCompany(event.target.value)}
            autoComplete="organization"
            className="rr-public-input"
          />
        </label>
      </div>

      <label className="rr-public-consent">
        <input
          required
          type="checkbox"
          checked={smsConsent}
          onChange={(event) => setSmsConsent(event.target.checked)}
          className="rr-public-checkbox"
        />
        <span className="rr-public-consent-text">
          {DEMO_SMS_CONSENT_TEXT}
        </span>
      </label>

      <input
        type="text"
        name="website"
        value={website}
        onChange={(event) => setWebsite(event.target.value)}
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
      />

      <p className="rr-public-disclaimer">
        Review our{" "}
        <Link href="/privacy">
          Privacy Policy
        </Link>{" "}
        and{" "}
        <Link href="/terms">
          Terms of Service
        </Link>
        . No mobile information will be shared with third parties or affiliates
        for marketing or promotional purposes. Text messaging originator opt-in
        data and consent will not be sold, rented, or shared with third parties
        or affiliates for marketing or promotional purposes.
      </p>

      {status.message ? (
        <div
          className={`rr-public-status ${
            status.type === "success"
              ? "rr-public-status-success"
              : "rr-public-status-error"
          }`}
        >
          <div className="rr-public-status-row">
            {status.type === "success" ? (
              <CheckCircle2 />
            ) : null}
            <span>{status.message}</span>
          </div>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting || !smsConsent}
        className="rr-public-submit"
      >
        {isSubmitting ? (
          <Loader2 className="animate-spin" />
        ) : (
          <ArrowRight />
        )}
        Try a RoofReply SMS demo
      </button>
    </form>
  );
}
