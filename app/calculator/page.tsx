"use client";
import Image from "next/image";
import Link from "next/link";
import {
  startTransition,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Download,
  Plus,
} from "lucide-react";
import { JourneyLink } from "@/components/journey-link";
import { trackCapturedLead } from "@/components/meta-pixel";
import { trackCalculator } from "@/lib/calculator-analytics";
import { FREE_OFFER_SUMMARY } from "@/lib/pricing-copy";
import { FOLLOW_UP_KIT_READY, FOLLOW_UP_COPY, FOLLOW_UP_VERSION, OFFER_PATH } from "@/lib/acquisition-campaign";
import { originalCampaign } from "@/lib/journey-attribution";
import {
  money,
  count,
  OPERATING_COPY,
  HANDOFF_STATUS,
  REFINE_COPY,
} from "@/lib/recovery-brief";
import {
  ASSESSMENT_VERSION,
  DEFAULT_ASSESSMENT,
  JOB_TYPES,
  TIMINGS,
  PROCESSES,
  SPEEDS,
  OWNERS,
  RATE_LABELS,
  rateKeys,
  buildAssessment,
  normalizeAssessment,
  type AssessmentAnswers,
  type Assessment,
  type RateKey,
} from "@/lib/missed-call-assessment";

import {
  DOWNLOAD_RETRY_KEY,
  readDownloadRetry,
  encodeDownloadRetry,
} from "@/lib/assessment-download-retry";
const downloadFailure =
  "The report could not load. Reload and retry to keep your answers and try the download again.";
async function savePdf(
  assessment: AssessmentAnswers,
  company: string,
  name: string,
) {
  const { generateReport } = await import("@/lib/pdf/generate-report");
  generateReport({ assessment, company, name });
}

type Choice = { readonly value: string; readonly label: string };
function Choices({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  options: readonly Choice[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="ma-question">
      <legend>{legend}</legend>
      <div className="ma-choices">
        {options.map((o) => (
          <label
            key={o.value}
            className={
              value === o.value ? "ma-choice is-selected" : "ma-choice"
            }
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              required
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />
            <span>{o.label}</span>
            {value === o.value && (
              <span aria-hidden="true" className="ma-check">
                ✓
              </span>
            )}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
function Quantity({
  id,
  label,
  hint,
  value,
  unknown,
  max,
  currency = false,
  onChange,
  onUnknown,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  unknown: boolean;
  max: number;
  currency?: boolean;
  onChange: (value: string) => void;
  onUnknown: (value: boolean) => void;
}) {
  return (
    <div className="ma-question">
      <label htmlFor={id}>{label}</label>
      <p className="ra-note" id={`${id}-hint`}>
        {hint}
      </p>
      <div className="ma-number">
        {!currency && (
          <button
            type="button"
            aria-label="Decrease missed calls by one"
            disabled={unknown || value === "" || Number(value) <= 0}
            onClick={() => onChange(String(Math.max(0, Number(value) - 1)))}
          >
            −
          </button>
        )}
        {currency && <span aria-hidden="true">$</span>}
        <input
          id={id}
          type="number"
          inputMode={currency ? "decimal" : "numeric"}
          min={0}
          max={max}
          step={currency ? "0.01" : "any"}
          required={!unknown}
          disabled={unknown}
          value={unknown ? "" : value}
          placeholder={unknown ? "Unknown" : "Enter an estimate"}
          aria-describedby={`${id}-hint`}
          onChange={(e) => onChange(e.target.value)}
        />
        {!currency && (
          <button
            type="button"
            aria-label="Increase missed calls by one"
            disabled={unknown || Number(value) >= max}
            onClick={() => onChange(String(Math.min(max, Number(value) + 1)))}
          >
            +
          </button>
        )}
      </div>
      <label className="ma-unknown">
        <input
          type="checkbox"
          checked={unknown}
          onChange={(e) => onUnknown(e.target.checked)}
        />
        I’m not sure
      </label>
    </div>
  );
}
function Result({ assessment: b }: { assessment: Assessment }) {
  return (
    <>
      <section className="ra-results" aria-label="Your calculated results">
        <div className="ra-primary-result">
          <p>ESTIMATED REVENUE POTENTIAL</p>
          {b.estimate ? (
            <>
              <strong data-testid="monthly-revenue">
                {money(b.estimate.monthlyRevenue)}
              </strong>
              <span>per average month</span>
            </>
          ) : (
            <>
              <strong className="ma-unquantified">
                {b.funnel ? "Job value unknown" : "Not yet quantified"}
              </strong>
              <span>
                {b.funnel
                  ? "Potential jobs use the stated assumptions"
                  : "Your coverage findings are still available"}
              </span>
            </>
          )}
        </div>
        <div className="ra-secondary-results">
          {b.estimate && (
            <div>
              <strong data-testid="annual-revenue">
                {money(b.estimate.yearlyRevenue)}
              </strong>
              <span>potential per year · 52 weeks</span>
            </div>
          )}
          <div className="ra-job-summary">
            <strong>{b.jobSummary}</strong>
            <span>Based on the stated assumptions.</span>
          </div>
        </div>
      </section>
      <p className="ra-result-limit">{b.resultExplanation}</p>
    </>
  );
}
const RATE_HINTS: Record<RateKey, string> = {
  realLeadRate:
    "Exclude spam, vendors, duplicates and existing customers. Include new inquiries your team later reached; the separate adjustment deducts those once.",
  engagementRate:
    "Share of remaining inquiries assumed to reply to text follow-up.",
  qualificationRate:
    "Share of conversations that fit your roofing work and service area.",
  closeRate:
    "Share of suitable roofing inquiries that become sold jobs. This is different from quote-to-sale conversion.",
};
export default function CalculatorPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [preliminary, setPreliminary] = useState(false);
  const [calls, setCalls] = useState("");
  const [callsUnknown, setCallsUnknown] = useState(false);
  const [jobType, setJobType] = useState("");
  const [jobValues, setJobValues] = useState<
    Record<string, { value: string; unknown: boolean }>
  >({});
  const [timing, setTiming] = useState("");
  const [process, setProcess] = useState("");
  const [speed, setSpeed] = useState("");
  const [owner, setOwner] = useState("");
  const [rates, setRates] = useState({ ...DEFAULT_ASSESSMENT });
  const [rateDrafts, setRateDrafts] = useState<Record<RateKey, string>>({
    realLeadRate: "40",
    engagementRate: "50",
    qualificationRate: "70",
    closeRate: "30",
  });
  const [company, setCompany] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [captureError, setCaptureError] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const [downloaded, setDownloaded] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const preliminaryHeading = useRef<HTMLHeadingElement>(null);
  const engaged = useRef(false);
  const capturePending = useRef(false);
  const viewedStep = useRef<number | null>(null);
  const job = jobValues[jobType] ?? { value: "", unknown: false };
  const validNumber = (value: string, max: number) =>
    value !== "" &&
    Number.isFinite(Number(value)) &&
    Number(value) >= 0 &&
    Number(value) <= max;
  const invalidRates = rateKeys.filter(
    (key) => !validNumber(rateDrafts[key], 100),
  );
  const answers: AssessmentAnswers = normalizeAssessment({
    ...rates,
    missedCallsPerWeek:
      callsUnknown || !validNumber(calls, 1000) ? null : Number(calls),
    averageJobValue:
      job.unknown || !validNumber(job.value, 1_000_000)
        ? null
        : Number(job.value),
    jobType: (jobType || "unknown") as AssessmentAnswers["jobType"],
    timing: (timing || "unknown") as AssessmentAnswers["timing"],
    process: (process || "unknown") as AssessmentAnswers["process"],
    callbackSpeed: (speed || "unknown") as AssessmentAnswers["callbackSpeed"],
    replyOwner: (owner || "unknown") as AssessmentAnswers["replyOwner"],
  });
  useEffect(() => { originalCampaign(); }, []);
  const b = buildAssessment(answers);
  const known = answers.existingRecoveryRate !== null;
  useEffect(() => {
    if (viewedStep.current === step) return;
    viewedStep.current = step;
    trackCalculator("calculator_step_viewed", known, {
      step,
      flow_version: "assessment_v3",
    });
    heading.current?.focus();
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [step, known]);
  useEffect(() => {
    let draft;
    try {
      draft = readDownloadRetry(sessionStorage.getItem(DOWNLOAD_RETRY_KEY));
      sessionStorage.removeItem(DOWNLOAD_RETRY_KEY);
    } catch {
      return;
    }
    if (!draft) return;
    const restored = draft;
    startTransition(() => {
      setCalls(
        restored.answers.missedCallsPerWeek === null
          ? ""
          : String(restored.answers.missedCallsPerWeek),
      );
      setCallsUnknown(restored.answers.missedCallsPerWeek === null);
      setJobType(restored.answers.jobType);
      setJobValues(restored.jobs);
      setTiming(restored.answers.timing);
      setProcess(restored.answers.process);
      setSpeed(restored.speed);
      setOwner(restored.owner);
      setRates(restored.answers);
      setRateDrafts({
        realLeadRate: String(restored.answers.realLeadRate),
        engagementRate: String(restored.answers.engagementRate),
        qualificationRate: String(restored.answers.qualificationRate),
        closeRate: String(restored.answers.closeRate),
      });
      setCompany(restored.company);
      setName(restored.name);
      setEmail(restored.email);
      setSaved(restored.saved);
      setPreliminary(true);
      setStep(3);
      setDownloading(true);
    });
    const followUpKnown = restored.answers.existingRecoveryRate !== null;
    trackCalculator("calculator_report_requested", followUpKnown, {
      step: 3,
      flow_version: "assessment_v3",
    });
    void savePdf(restored.answers, restored.company, restored.name)
      .then(() => {
        setDownloaded(true);
        trackCalculator("calculator_report_downloaded", followUpKnown, {
          step: 3,
          flow_version: "assessment_v3",
        });
      })
      .catch(() => {
        setDownloadError(downloadFailure);
        trackCalculator("calculator_report_failed", followUpKnown, {
          step: 3,
          flow_version: "assessment_v3",
        });
      })
      .finally(() => setDownloading(false));
  }, []);
  function change() {
    setSaved(false);
    setDownloaded(false);
    if (!engaged.current) {
      engaged.current = true;
      trackCalculator("calculator_engaged", known, {
        flow_version: "assessment_v3",
      });
    }
  }
  function jobChange(value: Partial<{ value: string; unknown: boolean }>) {
    change();
    setPreliminary(false);
    setJobValues((prev) => ({ ...prev, [jobType]: { ...job, ...value } }));
  }
  function track(event: Parameters<typeof trackCalculator>[0]) {
    trackCalculator(event, known, { step, flow_version: "assessment_v3" });
  }
  function advance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    change();
    if (!preliminary || step === 2) track("calculator_step_completed");
    if (step === 1 && !preliminary) {
      setPreliminary(true);
      requestAnimationFrame(() => preliminaryHeading.current?.focus());
    } else if (step === 1) setStep(2);
    else {
      track("calculator_completed");
      setStep(3);
    }
  }
  async function downloadBrief(savedForRetry = saved) {
    if (downloadError) {
      try {
        sessionStorage.setItem(
          DOWNLOAD_RETRY_KEY,
          encodeDownloadRetry({
            answers,
            company,
            name,
            email,
            jobs: jobValues,
            speed: speed as "" | "fast" | "same-day" | "next-day" | "unknown",
            owner: owner as "" | "yes" | "sometimes" | "no" | "unknown",
            saved: savedForRetry,
          }),
        );
        window.location.reload();
      } catch {
        setDownloadError(
          "Your browser could not preserve the assessment for a retry. Keep this page open; you can still read all your results here.",
        );
      }
      return;
    }
    setDownloading(true);
    setDownloadError("");
    track("calculator_report_requested");
    try {
      await savePdf(answers, company, name);
      setDownloaded(true);
      track("calculator_report_downloaded");
    } catch {
      setDownloadError(downloadFailure);
      track("calculator_report_failed");
    } finally {
      setDownloading(false);
    }
  }
  async function capture(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (capturePending.current) return;
    capturePending.current = true;
    setSubmitting(true);
    setCaptureError("");
    try {
      const response = await fetch("/api/lead-magnet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentVersion: ASSESSMENT_VERSION,
          answers,
          company,
          name,
          email,
          attribution: Object.fromEntries(new URLSearchParams(originalCampaign())),
          followUpRequest: { version: FOLLOW_UP_VERSION, accepted: true },
        }),
      });
      const result = await response.json();
      if (!response.ok || result.captured !== true)
        throw new Error("capture failed");
      setSaved(true);
      track("calculator_contact_saved");
      if (typeof result.eventId === "string") trackCapturedLead(result.eventId);
      await downloadBrief(true);
    } catch {
      setCaptureError(
        "Your details could not be saved. You can still use Download my report above, or try again.",
      );
      track("calculator_contact_failed");
    } finally {
      capturePending.current = false;
      setSubmitting(false);
    }
  }
  const refine = (
    <details className="ra-assumptions">
      <summary>
        Refine my estimate <Plus size={18} />
      </summary>
      <p className="ra-note">
        These conversion rates are illustrative assumptions, not industry
        benchmarks. Change them only if you have a better estimate.
      </p>
      <div className="ma-refine-grid">
        {rateKeys.map((key) => (
          <div key={key}>
            <label htmlFor={key}>{RATE_LABELS[key]} (%)</label>
            <p className="ra-note" id={`${key}-hint`}>
              {RATE_HINTS[key]}
            </p>
            <input
              id={key}
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              step="any"
              value={rateDrafts[key]}
              aria-invalid={invalidRates.includes(key)}
              aria-describedby={`${key}-hint ${key}-error`}
              onChange={(e) => {
                change();
                setRateDrafts((prev) => ({ ...prev, [key]: e.target.value }));
                if (e.target.value !== "" && e.target.validity.valid)
                  setRates((prev) => ({
                    ...prev,
                    [key]: Number(e.target.value),
                    suppliedRates: [...new Set([...prev.suppliedRates, key])],
                  }));
              }}
            />
            <span id={`${key}-error`} className="ra-error">
              {invalidRates.includes(key)
                ? "Enter a percentage from 0 to 100."
                : ""}
            </span>
            <span className="ma-source">
              {rates.suppliedRates.includes(key)
                ? "Your input"
                : "Illustrative assumption"}
            </span>
          </div>
        ))}
      </div>
      <label htmlFor="existing-recovery">
        What percentage does your team already reach?
      </label>
      <p className="ra-note">
        Of legitimate, unique new missed inquiries, what share does your team
        already reach? Count successful reconnections, not callback attempts.
        These are deducted once.
      </p>
      <select
        id="existing-recovery"
        value={rates.existingRecoveryRate ?? "unknown"}
        onChange={(e) => {
          change();
          setRates((prev) => ({
            ...prev,
            existingRecoveryRate:
              e.target.value === "unknown" ? null : Number(e.target.value),
          }));
        }}
      >
        <option value="unknown">I’m not sure</option>
        {Array.from({ length: 21 }, (_, i) => i * 5).map((n) => (
          <option key={n} value={n}>
            {n}% already reached
          </option>
        ))}
      </select>
      <label htmlFor="gross-margin">
        Gross margin after direct job costs (optional)
      </label>
      <p className="ra-note">
        Used only for a gross-profit comparison before overhead and service
        fees. It does not change revenue potential.
      </p>
      <select
        id="gross-margin"
        value={rates.grossMargin ?? "unknown"}
        onChange={(e) => {
          change();
          setRates((prev) => ({
            ...prev,
            grossMargin:
              e.target.value === "unknown" ? null : Number(e.target.value),
          }));
        }}
      >
        <option value="unknown">I’m not sure</option>
        {Array.from({ length: 21 }, (_, i) => i * 5).map((n) => (
          <option key={n} value={n}>
            {n}%
          </option>
        ))}
      </select>
      <dl className="ma-inputs">
        {b.rows.map((r) => (
          <div key={r.label}>
            <dt>{r.label}</dt>
            <dd>
              {r.value}
              <small>{r.source}</small>
            </dd>
          </div>
        ))}
      </dl>
      {b.funnel && (
        <p className="ra-note">
          Average month: {count(b.funnel.monthlyMissedCalls)} missed calls →{" "}
          {count(b.funnel.monthlyLegitimateInquiries)} new inquiries →{" "}
          {count(b.funnel.monthlyEligibleInquiries)}{" "}
          {known ? "still unreached" : "before adjustment"} →{" "}
          {count(b.funnel.monthlyConversations)} replies →{" "}
          {count(b.funnel.monthlyQualifiedLeads)} qualified →{" "}
          {count(b.funnel.monthlyClosedJobs)} potential jobs.
        </p>
      )}
      <p className="ra-note">
        {b.jobDetails} Average month = annual ÷ 12. Calculations use 52 weeks
        without intermediate rounding.
      </p>
      {b.grossProfit && (
        <p>
          Modeled gross profit: {money(b.grossProfit.monthly)}/month and{" "}
          {money(b.grossProfit.yearly)}/year, before overhead and service fees.
          Additional profit beyond current follow-up is not established.
        </p>
      )}
      {b.costCopy && <p>{b.costCopy}</p>}
    </details>
  );
  return (
    <main className="ra-page ma-page" id="main-content">
      <header className="ra-header">
        <div className="ra-wrap ra-header-inner">
          <Link href="/" className="ra-brand">
            <Image src="/icon-svg.svg" alt="" width={25} height={25} priority />
            RoofReply
          </Link>
          <span>MISSED-CALL ASSESSMENT</span>
          <Link href="/how-it-works">
            About RoofReply <ArrowUpRight size={16} />
          </Link>
        </div>
      </header>
      <div
        className={`ra-wrap ${step < 3 ? "ma-form-wrap" : "ma-results-wrap"}`}
      >
        <nav aria-label="Assessment progress">
          <ol className="ma-progress">
            {["Your opportunity", "Current follow-up", "Your assessment"].map(
              (title, i) => (
                <li
                  key={title}
                  aria-current={step === i + 1 ? "step" : undefined}
                >
                  <span>{i + 1 < step ? "✓" : i + 1}</span>
                  {title}
                </li>
              ),
            )}
          </ol>
        </nav>
        <section className="ra-intro">
          <p className="ra-kicker">
            For established residential roofing companies
          </p>
          <h1 ref={heading} tabIndex={-1}>
            {step === 1
              ? "What happens to your missed roofing calls?"
              : step === 2
                ? "Your current follow-up."
                : b.takeaway}
          </h1>
          <p className="ra-lede">
            {step === 1
              ? "Get your free missed-call assessment. See follow-up gaps and an illustrative opportunity estimate. No email required."
              : step === 2
                ? "A missed call is only part of the story. Tell us what happens next."
                : "Your answers, the modeled opportunity and a practical next step."}
          </p>
        </section>
        {step < 3 && <p className="ra-note">Want a ready-to-use office routine? <JourneyLink href="/rescue-kit">Get the free Rescue Kit</JourneyLink> without completing this assessment.</p>}
        {step < 3 ? (
          <form onSubmit={advance}>
            {step === 1 ? (
              <>
                <Quantity
                  id="missed-calls"
                  label="In a typical week, how many incoming calls go unanswered?"
                  hint="Include all unanswered inbound calls. Unrelated calls are filtered separately in the estimate."
                  value={calls}
                  unknown={callsUnknown}
                  max={1000}
                  onChange={(value) => {
                    change();
                    setCalls(value);
                    setPreliminary(false);
                  }}
                  onUnknown={(value) => {
                    change();
                    setCallsUnknown(value);
                    setPreliminary(false);
                  }}
                />
                <Choices
                  legend="What kind of roofing work do these inquiries usually concern?"
                  name="job-type"
                  options={JOB_TYPES}
                  value={jobType}
                  onChange={(value) => {
                    change();
                    setJobType(value);
                    setPreliminary(false);
                  }}
                />
                {jobType && (
                  <Quantity
                    id="job-value"
                    currency
                    label={
                      jobType === "repairs"
                        ? "What is a typical sold repair job worth?"
                        : jobType === "replacements"
                          ? "What is a typical sold replacement job worth?"
                          : "What is an average sold job worth across this mix?"
                    }
                    hint={
                      jobType === "mixed" || jobType === "unknown"
                        ? "Use total revenue divided by jobs sold across a similar mix of repairs and replacements."
                        : "Revenue per sold job of this type, before labor, materials and overhead."
                    }
                    value={job.value}
                    unknown={job.unknown}
                    max={1_000_000}
                    onChange={(value) => jobChange({ value })}
                    onUnknown={(unknown) => jobChange({ unknown })}
                  />
                )}
                {preliminary && (
                  <section className="ma-preliminary">
                    <h2 ref={preliminaryHeading} tabIndex={-1}>
                      Your preliminary estimate
                    </h2>
                    <Result assessment={b} />
                    <p className="ra-note">
                      Assumed: {rates.realLeadRate}% legitimate inquiries ·{" "}
                      {rates.engagementRate}% reply · {rates.qualificationRate}%
                      fit · {rates.closeRate}% become sold jobs. These are
                      illustrative, not benchmarks.
                    </p>
                    {refine}
                  </section>
                )}
              </>
            ) : (
              <>
                <Choices
                  legend="When are calls mostly missed?"
                  name="timing"
                  options={TIMINGS}
                  value={timing}
                  onChange={(value) => {
                    change();
                    setTiming(value);
                  }}
                />
                <Choices
                  legend="What usually happens after a missed call?"
                  name="process"
                  options={PROCESSES}
                  value={process}
                  onChange={(value) => {
                    change();
                    setProcess(value);
                  }}
                />
                {process === "callback" && (
                  <Choices
                    legend="How soon does someone usually call back?"
                    name="speed"
                    options={SPEEDS}
                    value={speed}
                    onChange={(value) => {
                      change();
                      setSpeed(value);
                    }}
                  />
                )}
                {(process === "text" || process === "both") && (
                  <Choices
                    legend="Does someone consistently handle replies and move suitable inquiries forward?"
                    name="owner"
                    options={OWNERS}
                    value={owner}
                    onChange={(value) => {
                      change();
                      setOwner(value);
                    }}
                  />
                )}
              </>
            )}
            <div className="ma-actions">
              {step === 2 && (
                <button
                  className="ma-back"
                  type="button"
                  onClick={() => setStep(1)}
                >
                  <ArrowLeft size={16} />
                  Back
                </button>
              )}
              <button
                className="ra-button"
                type="submit"
                disabled={invalidRates.length > 0}
              >
                {step === 1
                  ? preliminary
                    ? "Continue to current follow-up"
                    : "See my preliminary estimate"
                  : "See my assessment"}
                <ArrowRight size={18} />
              </button>
            </div>
            <p className="ra-note">
              No contact details needed. Your answers stay here when you go
              back.
            </p>
          </form>
        ) : (
          <>
            <button className="ma-back" onClick={() => setStep(2)}>
              <ArrowLeft size={16} />
              Edit my answers
            </button>
            <Result assessment={b} />
            <section
              className="ma-findings"
              aria-label="What your answers suggest"
            >
              {b.findings.map((finding, i) => (
                <article key={finding.id}>
                  <p className="ra-kicker">
                    {i === 0 ? "The opportunity" : "Your current coverage"}
                  </p>
                  <h2>{finding.title}</h2>
                  <p>{finding.evidence}</p>
                </article>
              ))}
            </section>
            <section className="ma-next">
              <h2>Your first step</h2>
              <p>{b.firstAction}</p>
              <h3>Put the routine to work</h3>
              <p>The free Rescue Kit includes an office plan, callback scripts, a tracking sheet, and a seven-day review. Use it with your existing tools.</p>
              <JourneyLink className="ra-button" href="/rescue-kit">Get the free Rescue Kit <ArrowUpRight size={18} /></JourneyLink>
              <h3>What still needs checking</h3>
              <p>{b.uncertainty}</p>
              <p className="ra-note">Want a firmer estimate? {REFINE_COPY}</p>
            </section>
            {refine}
            {invalidRates.length > 0 && (
              <p className="ra-error" role="alert">
                Correct the percentages in “Refine my estimate” before
                downloading or sharing. The displayed result uses your last
                valid values.
              </p>
            )}
            <section className="ra-save">
              <div>
                <p className="ra-kicker">Your two-page report</p>
                <h2>Keep this assessment.</h2>
                <p>
                  Add your company name to personalize the report. Download
                  immediately; no email required.
                </p>
                <label htmlFor="report-company">Company name (optional)</label>
                <input
                  id="report-company"
                  maxLength={100}
                  autoComplete="organization"
                  value={company}
                  onChange={(e) => {
                    change();
                    setCompany(e.target.value);
                  }}
                />
                <button
                  className="ra-button"
                  disabled={downloading || invalidRates.length > 0}
                  onClick={() => downloadBrief()}
                >
                  {downloading
                    ? "Preparing your report…"
                    : downloadError
                      ? "Reload and retry download"
                      : "Download my report"}
                  <Download size={18} />
                </button>
                {downloaded && !downloadError && (
                  <p role="status">
                    Your report is ready. The download has started.
                  </p>
                )}
                {downloadError && (
                  <p className="ra-error" role="alert">
                    {downloadError}
                  </p>
                )}
              </div>
              <div>
                <div className="ra-contact">
                  <h3>Want help putting this to work?</h3>
                  {saved ? (
                    <p role="status">
                      Your request is saved. Berny will follow up by email within one business day. Your download is available above.
                    </p>
                  ) : (
                    <form onSubmit={capture}>
                      <label htmlFor="report-name">Your name (optional)</label>
                      <input
                        id="report-name"
                        maxLength={100}
                        autoComplete="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                      <label htmlFor="follow-up-company">Roofing company</label>
                      <input id="follow-up-company" required maxLength={100} autoComplete="organization"
                        value={company} onChange={(e) => setCompany(e.target.value)} />
                      <label htmlFor="report-email">Work email</label>
                      <input
                        id="report-email"
                        type="email"
                        required
                        maxLength={254}
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                      <p>
                        {FOLLOW_UP_COPY}{" "}
                        <Link href="/privacy">Privacy</Link>
                      </p>
                      <button
                        className="ra-button"
                        disabled={
                          submitting || downloading || invalidRates.length > 0
                        }
                      >
                        {submitting ? "Saving…" : "Request a follow-up"}
                      </button>
                      {captureError && (
                        <p className="ra-error" role="alert">
                          {captureError}
                        </p>
                      )}
                    </form>
                  )}
                </div>
              </div>
            </section>
            <section className="ra-roofreply">
              <div>
                <p className="ra-kicker">Optional managed follow-up</p>
                <h2>Want help running the follow-up?</h2>
                <p>{FOLLOW_UP_KIT_READY
                  ? "Your kit gives your team a process to follow. RoofReply can set up and manage missed-call conversations and handoffs for you."
                  : "Your assessment highlights gaps to check. RoofReply can set up and manage missed-call conversations and handoffs for you."}</p>
              </div>
              <div>
                <JourneyLink className="ra-button" href={OFFER_PATH}
                  onClick={() => track(FOLLOW_UP_KIT_READY ? "kit_offer_clicked" : "calculator_offer_clicked")}>
                  See the free founding-client offer <ArrowUpRight size={18} />
                </JourneyLink>
                <p>{FREE_OFFER_SUMMARY}</p>
              </div>
            </section>
            <section className="ma-operating">
              <p className="ra-kicker">What effective recovery looks like</p>
              <h2>{OPERATING_COPY.title}</h2>
              <p>{OPERATING_COPY.problem}</p>
              <div className="ra-process">
                <span>Missed inquiry</span>
                <ArrowRight size={16} />
                <span>Text conversation</span>
                <ArrowRight size={16} />
                <span>Roofing details</span>
                <ArrowRight size={16} />
                <span>Clear handoff</span>
              </div>
              <details>
                <summary>
                  See an illustrative conversation and handoff{" "}
                  <Plus size={18} />
                </summary>
                <div className="ra-example">
                  <div>
                    {b.conversation.map((m, i) => (
                      <div
                        key={i}
                        className={`ra-message ${i % 2 ? "ra-message-homeowner" : ""}`}
                      >
                        <span>{m.speaker}</span>
                        <p>{m.text}</p>
                      </div>
                    ))}
                  </div>
                  <div className="ra-handoff">
                    <h3>What reaches your team</h3>
                    <dl>
                      {b.handoff.map((r) => (
                        <div key={r.label}>
                          <dt>{r.label}</dt>
                          <dd>{r.value}</dd>
                        </div>
                      ))}
                    </dl>
                    <p>{HANDOFF_STATUS}</p>
                  </div>
                </div>
              </details>
            </section>

          </>
        )}
        <footer className="ra-footer">
          <Link href="/" className="ra-brand">
            RoofReply
          </Link>
          <div>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
