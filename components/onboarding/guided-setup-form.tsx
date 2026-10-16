"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { formatPhoneInput } from "@/lib/format-phone";
import {
  ACCOUNT_SMS_CONSENT_TEXT,
  hasCurrentAccountSmsConsent,
  normalizeConsentPhone,
} from "@/lib/account-sms-consent";
import {
  addServiceAreas,
  businessDetails,
  businessFormErrors,
  validSetupPhone,
  type BusinessDetails,
  type BusinessForm,
  type ServiceArea,
} from "@/lib/guided-onboarding";
import {
  CONTACT_LABELS,
  CONTACT_PREFERENCES,
  type ContactPreference,
} from "@/lib/concierge";
import { trackOnboarding } from "@/lib/onboarding-analytics";
import { BusinessExample } from "./business-example";

export type SetupAccount = Partial<BusinessDetails> & {
  bookingDeliveryPhone?: string;
  accountSmsConsentGranted?: boolean;
  accountSmsConsentPhone?: string;
  accountSmsConsentText?: string;
  accountSmsConsentVersion?: string;
  aiTone?: string;
  leadHandoffMode?: string;
};

export function GuidedSetupForm({
  initial,
  email = "",
  firstName,
  onSaveBusiness,
  onSubmit,
}: {
  initial: SetupAccount;
  email?: string;
  firstName?: string;
  onSaveBusiness: (data: BusinessDetails) => Promise<void>;
  onSubmit: (phone: string, preference: ContactPreference) => Promise<void>;
}) {
  const [business, setBusiness] = useState<BusinessForm>(() => ({
    legalBusinessName: initial.legalBusinessName || "",
    businessPhone: formatPhoneInput(initial.businessPhone || ""),
    website: initial.website || "",
    areas: initial.serviceAreas?.map((area) => area.value).join(", ") || "",
  }));
  const [areas, setAreas] = useState<ServiceArea[]>(initial.serviceAreas || []);
  const [areaInput, setAreaInput] = useState("");
  const [step, setStep] = useState(() =>
    Object.keys(businessFormErrors(business)).length ? 0 : 1,
  );
  const [phone, setPhone] = useState(
    formatPhoneInput(initial.bookingDeliveryPhone || ""),
  );
  const [preference, setPreference] = useState<ContactPreference>("email");
  const [consent, setConsent] = useState(() =>
    hasCurrentAccountSmsConsent({
      phoneNumber: initial.bookingDeliveryPhone,
      consentGranted: initial.accountSmsConsentGranted,
      consentPhone: initial.accountSmsConsentPhone,
      consentText: initial.accountSmsConsentText,
      consentVersion: initial.accountSmsConsentVersion,
    }),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(step === 1);
  const [startedAt] = useState(() => Date.now());
  const started = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!started.current) {
      started.current = true;
      trackOnboarding("onboarding_started", step + 1, startedAt);
    }
  }, [startedAt, step]);
  function moveTo(next: number) {
    setStep(next);
    setErrors({});
    setError("");
    requestAnimationFrame(() => {
      heading.current?.focus();
      heading.current?.scrollIntoView({ block: "nearest" });
    });
  }
  function commitAreas() {
    const next = addServiceAreas(areas, areaInput);
    setAreas(next);
    setAreaInput("");
    setSaved(false);
    return next;
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const coverage = addServiceAreas(areas, areaInput);
    const form = {
      ...business,
      areas: coverage.map((area) => area.value).join(", "),
    };
    const nextErrors: Record<string, string> =
      step === 0
        ? businessFormErrors(form)
        : {
            ...(!validSetupPhone(phone)
              ? {
                  alertPhone:
                    "Enter a valid mobile number, including the area code.",
                }
              : {}),
            ...(!consent
              ? {
                  smsConsent:
                    "Confirm SMS permission for this number to continue.",
                }
              : {}),
            ...(preference !== "sms" &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
              ? {
                  email:
                    "Add a primary email through your account menu, or choose Text for setup.",
                }
              : {}),
          };
    setErrors(nextErrors);
    setError("");
    if (Object.keys(nextErrors).length) {
      const field = Object.keys(nextErrors)[0];
      trackOnboarding(
        "onboarding_validation_failed",
        step + 1,
        startedAt,
        field,
      );
      document.getElementById(field)?.focus();
      return;
    }
    setBusy(true);
    try {
      if (step === 0) {
        const details = {
          ...businessDetails(form, initial.serviceAreas),
          serviceAreas: coverage,
        };
        await onSaveBusiness(details);
        setBusiness({ ...form, website: details.website });
        setAreas(coverage);
        setAreaInput("");
        setSaved(true);
        trackOnboarding("onboarding_step_saved", 1, startedAt);
        moveTo(1);
      } else {
        await onSubmit(normalizeConsentPhone(phone), preference);
        trackOnboarding("onboarding_completed", 2, startedAt);
      }
    } catch {
      setError(
        "We couldn’t save your details. Your entries are still here. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  function field(
    key: "legalBusinessName" | "businessPhone" | "website",
    label: string,
    placeholder: string,
    hint: string,
  ) {
    return (
      <div className="rr-enrollment-field">
        <Label htmlFor={key}>{label}</Label>
        <Input
          id={key}
          name={key}
          type={key === "businessPhone" ? "tel" : "text"}
          inputMode={key === "website" ? "url" : undefined}
          value={business[key]}
          placeholder={placeholder}
          maxLength={200}
          autoComplete={
            key === "legalBusinessName"
              ? "organization"
              : key === "businessPhone"
                ? "section-business tel"
                : "url"
          }
          aria-invalid={Boolean(errors[key])}
          aria-describedby={`${key}-hint${errors[key] ? ` ${key}-error` : ""}`}
          onChange={(event) => {
            const input = event.target;
            const raw = input.value;
            const value = key === "businessPhone" ? formatPhoneInput(raw) : raw;
            setBusiness({ ...business, [key]: value });
            setSaved(false);
            if (key === "businessPhone" && value !== raw) {
              const cursor = input.selectionStart ?? raw.length;
              const digitsBefore = raw
                .slice(0, cursor)
                .replace(/\D/g, "").length;
              let position = cursor === raw.length ? value.length : 0;
              if (cursor !== raw.length && digitsBefore) {
                let seen = 0;
                for (let index = 0; index < value.length; index++) {
                  if (/\d/.test(value[index])) seen++;
                  if (seen === digitsBefore) {
                    position = index + 1;
                    break;
                  }
                }
              }
              requestAnimationFrame(() =>
                input.setSelectionRange(position, position),
              );
            }
          }}
        />
        <p id={`${key}-hint`} className="rr-field-hint">
          {hint}
        </p>
        {errors[key] && (
          <p id={`${key}-error`} className="rr-field-error">
            {errors[key]}
          </p>
        )}
      </div>
    );
  }
  const preview = (
    <BusinessExample
      businessName={business.legalBusinessName}
      area={areas[0]?.value || areaInput.split(",")[0]}
    />
  );
  return (
    <div className="rr-concierge-layout">
      <section className="rr-concierge-main" aria-labelledby="setup-title">
        <p className="rr-eyebrow">
          {firstName ? `Welcome, ${firstName}` : "Welcome to RoofReply"}{" "}
          <span aria-hidden="true">/</span> Your personal setup
        </p>
        <h1 className="rr-concierge-heading">
          Good work deserves
          <br />
          <span>a conversation.</span>
        </h1>
        <p className="rr-concierge-intro">
          You’ve worked hard to get the phone ringing. Let’s help keep missed
          callers moving toward an inspection.
        </p>
        <ol className="rr-concierge-steps" aria-label="Setup progress">
          {["Your business", "Your contact details"].map((label, index) => (
            <li
              key={label}
              aria-current={step === index ? "step" : undefined}
              data-complete={step > index}
            >
              <span>
                {step > index ? (
                  <Check size={14} aria-hidden="true" />
                ) : (
                  `0${index + 1}`
                )}
              </span>
              {label}
            </li>
          ))}
        </ol>
        <div className="rr-concierge-form">
          <div className="rr-concierge-form-heading">
            <p className="rr-form-step">Step {step + 1} of 2</p>
            <h2 id="setup-title" ref={heading} tabIndex={-1}>
              {step === 0
                ? "Let’s make RoofReply yours"
                : "Keep the right opportunities close"}
            </h2>
            <p>
              {step === 0
                ? "A few details now. We’ll handle the rest together."
                : "Choose where your lead summaries go and how I can help you get started."}
            </p>
          </div>
          <form onSubmit={submit} noValidate>
            <fieldset disabled={busy} className="rr-concierge-fields">
              <legend className="sr-only">
                {step === 0
                  ? "Business details"
                  : "Lead alerts and setup contact"}
              </legend>
              {step === 0 ? (
                <>
                  {field(
                    "legalBusinessName",
                    "Business name",
                    "Summit Roofing",
                    "So we can tailor the experience to your business.",
                  )}
                  {field(
                    "businessPhone",
                    "Business phone",
                    "(602) 555-0100",
                    "Keep your current number. We’ll help connect missed-call follow-up.",
                  )}
                  <div className="rr-enrollment-field">
                    <Label htmlFor="areas">Cities or ZIP codes you serve</Label>
                    {areas.length > 0 && (
                      <ul
                        className="rr-area-chips"
                        aria-label="Your service areas"
                      >
                        {areas.map((area, index) => (
                          <li key={`${area.type}-${area.value}-${index}`}>
                            <span>{area.value}</span>
                            <button
                              type="button"
                              aria-label={`Remove ${area.value}`}
                              onClick={() => {
                                setAreas(areas.filter((_, i) => i !== index));
                                setSaved(false);
                              }}
                            >
                              <X size={13} aria-hidden="true" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <Input
                      id="areas"
                      value={areaInput}
                      placeholder={
                        areas.length
                          ? "Add another city or ZIP code"
                          : "Phoenix, Mesa, 85251"
                      }
                      maxLength={1000}
                      autoComplete="off"
                      aria-invalid={Boolean(errors.areas)}
                      aria-describedby={`areas-hint${errors.areas ? " areas-error" : ""}`}
                      onChange={(event) => {
                        setAreaInput(event.target.value);
                        setSaved(false);
                      }}
                      onBlur={commitAreas}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && areaInput.trim()) {
                          event.preventDefault();
                          commitAreas();
                        }
                      }}
                    />
                    <p id="areas-hint" className="rr-field-hint">
                      Separate locations with a comma. We’ll confirm your
                      coverage together.
                    </p>
                    {errors.areas && (
                      <p id="areas-error" className="rr-field-error">
                        {errors.areas}
                      </p>
                    )}
                  </div>
                  {field(
                    "website",
                    "Website (optional)",
                    "yourroofingcompany.com",
                    "Have a website? Share it so we can get to know your business.",
                  )}
                </>
              ) : (
                <>
                  <div className="rr-business-recap">
                    <div>
                      <strong>{business.legalBusinessName}</strong>
                      <p>{areas.map((area) => area.value).join(" · ")}</p>
                    </div>
                    <button
                      type="button"
                      className="rr-text-link"
                      onClick={() => moveTo(0)}
                    >
                      Edit
                    </button>
                  </div>
                  <div className="rr-enrollment-field">
                    <Label htmlFor="alertPhone">
                      Mobile number for lead alerts
                    </Label>
                    <Input
                      id="alertPhone"
                      type="tel"
                      autoComplete="section-alert tel"
                      value={phone}
                      placeholder="(602) 555-0123"
                      maxLength={30}
                      aria-invalid={Boolean(errors.alertPhone)}
                      aria-describedby={`alertPhone-hint${errors.alertPhone ? " alertPhone-error" : ""}`}
                      onChange={(event) => {
                        const value = event.target.value;
                        if (
                          normalizeConsentPhone(value) !==
                          normalizeConsentPhone(phone)
                        )
                          setConsent(false);
                        setPhone(value);
                      }}
                    />
                    <p id="alertPhone-hint" className="rr-field-hint">
                      Use the mobile you check for new opportunities. Lead
                      alerts start once your service is live.
                    </p>
                    {errors.alertPhone && (
                      <p id="alertPhone-error" className="rr-field-error">
                        {errors.alertPhone}
                      </p>
                    )}
                  </div>
                  <fieldset className="rr-contact-choice">
                    <legend>
                      How would you like Berny to contact you about setup?
                    </legend>
                    <div className="rr-contact-options">
                      {CONTACT_PREFERENCES.map((value) => (
                        <label key={value} data-selected={preference === value}>
                          <input
                            type="radio"
                            name="contactPreference"
                            value={value}
                            checked={preference === value}
                            onChange={() => setPreference(value)}
                          />
                          {CONTACT_LABELS[value]}
                        </label>
                      ))}
                    </div>
                    <p id="email" tabIndex={-1} className="rr-field-hint">
                      Email:{" "}
                      <span className="break-all">
                        {email || "Add a primary email in your account menu"}
                      </span>
                    </p>
                    <p className="rr-field-hint">
                      This is for setup conversations. Lead alerts use your
                      approved mobile number.
                    </p>
                    {errors.email && (
                      <p className="rr-field-error" role="alert">
                        {errors.email}
                      </p>
                    )}
                  </fieldset>
                  <div className="rr-consent">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="smsConsent"
                        checked={consent}
                        onCheckedChange={(value) => setConsent(value === true)}
                        aria-invalid={Boolean(errors.smsConsent)}
                        aria-describedby={`sms-disclosure${errors.smsConsent ? " smsConsent-error" : ""}`}
                      />
                      <Label htmlFor="smsConsent">
                        Allow setup texts and lead alerts
                      </Label>
                    </div>
                    <p id="sms-disclosure">{ACCOUNT_SMS_CONSENT_TEXT}</p>
                    {errors.smsConsent && (
                      <p
                        id="smsConsent-error"
                        className="rr-field-error"
                        role="alert"
                      >
                        {errors.smsConsent}
                      </p>
                    )}
                  </div>
                  <p className="rr-setup-promise">
                    {(!initial.aiTone || initial.aiTone === "friendly") &&
                    (!initial.leadHandoffMode ||
                      initial.leadHandoffMode === "review_first")
                      ? "We’ll start with friendly replies and send opportunities to your team for review."
                      : "Your saved reply style and handoff preferences will stay in place."}{" "}
                    We’ll confirm your preferences together before launch.
                  </p>
                </>
              )}
            </fieldset>
            {error && (
              <p role="alert" className="rr-save-error">
                {error}
              </p>
            )}
            <div className="rr-concierge-actions">
              <Button
                type="submit"
                disabled={busy}
                className="rr-concierge-primary"
              >
                {busy ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden="true" />
                    Saving your details…
                  </>
                ) : (
                  <>
                    {step === 0
                      ? "Continue to your contact details"
                      : "Send my details to Berny"}
                    <ArrowRight size={17} aria-hidden="true" />
                  </>
                )}
              </Button>
              <div className="rr-concierge-action-note">
                {step === 1 ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => moveTo(0)}
                  >
                    <ArrowLeft size={14} aria-hidden="true" />
                    Back
                  </button>
                ) : (
                  <span>
                    {saved
                      ? "Business details saved"
                      : "Your progress saves when you continue."}
                  </span>
                )}
                <span>
                  {step === 1
                    ? "Messaging stays paused until we’re ready."
                    : "Two short steps. Personal help throughout."}
                </span>
              </div>
            </div>
          </form>
        </div>
        <p className="rr-concierge-signoff">
          <span className="rr-founder-mark" aria-hidden="true">
            B
          </span>
          <span>
            Personally guided by Berny
            <br />
            <a href="mailto:hello@example.com">
              Contact Berny <ArrowRight size={13} aria-hidden="true" />
            </a>
          </span>
        </p>
      </section>
      <aside
        className="rr-concierge-preview"
        aria-label="An example of missed-call follow-up"
      >
        <div className="rr-example-desktop">{preview}</div>
        <details className="rr-example-mobile">
          <summary>See an example for your business</summary>
          {preview}
        </details>
        <p className="rr-preview-assurance">
          Your number. Your roofing business.
          <br />
          <strong>A thoughtful follow-up when you can’t answer.</strong>
        </p>
      </aside>
    </div>
  );
}
