"use client";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CONCIERGE_CHECKLIST,
  CONTACT_LABELS,
  conciergeDrafts,
  formatConciergeDate,
  pendingContactChannels,
  requestedChannels,
  type ChecklistItem,
} from "@/lib/concierge";
import { formatPhoneNumber } from "@/lib/format-phone";

type Enrollment = FunctionReturnType<typeof api.concierge.enrollments>[number];
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Could not save. Please try again.";

function ChecklistRow({
  clerkId,
  item,
}: {
  clerkId: string;
  item: ChecklistItem;
}) {
  const save = useMutation(api.concierge.updateChecklist);
  const [status, setStatus] = useState(item.status);
  const [reference, setReference] = useState(item.reference);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!dirty) {
      setStatus(item.status);
      setReference(item.reference);
    }
  }, [item.status, item.reference, dirty]);
  const definition = CONCIERGE_CHECKLIST.find(
    (entry) => entry.key === item.key,
  )!;
  return (
    <form
      className="rr-checklist-item"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setMessage("");
        try {
          await save({ clerkId, key: item.key, status, reference });
          setDirty(false);
          setMessage("Saved.");
        } catch (error) {
          setMessage(errorMessage(error));
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy}>
        <legend>{definition.title}</legend>
        <p>{definition.detail}</p>
        <div className="rr-checklist-controls">
          <label>
            Status
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as ChecklistItem["status"]);
                setDirty(true);
              }}
            >
              <option value="pending">Pending</option>
              <option value="waiting">Waiting on customer</option>
              <option value="complete">Complete</option>
            </select>
          </label>
          <label>
            Private confirmation or evidence reference
            <textarea
              rows={2}
              maxLength={2000}
              value={reference}
              onChange={(event) => {
                setReference(event.target.value);
                setDirty(true);
              }}
              required={status === "complete"}
            />
          </label>
          <Button type="submit" variant="outline" disabled={busy || !dirty}>
            {busy ? "Saving…" : "Save item"}
          </Button>
        </div>
        {item.status === "complete" && (
          <small>Confirmed {formatConciergeDate(item.updatedAt)}</small>
        )}
      </fieldset>
      {message && <p role="status">{message}</p>}
    </form>
  );
}

function CoordinationEditor({
  enrollment: record,
}: {
  enrollment: Enrollment;
}) {
  const save = useMutation(api.concierge.updateCoordination);
  const [nextAction, setNextAction] = useState(record.nextAction);
  const [owner, setOwner] = useState(record.nextActionOwner);
  const toInput = (time?: number) =>
    time ? new Date(time - 7 * 60 * 60 * 1000).toISOString().slice(0, 16) : "";
  const [kickoff, setKickoff] = useState(toInput(record.kickoffAt));
  const [notes, setNotes] = useState(record.privateNotes);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!dirty) {
      setNextAction(record.nextAction);
      setOwner(record.nextActionOwner);
      setKickoff(toInput(record.kickoffAt));
      setNotes(record.privateNotes);
    }
  }, [
    record.nextAction,
    record.nextActionOwner,
    record.kickoffAt,
    record.privateNotes,
    dirty,
  ]);
  return (
    <form
      className="rr-ops-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setMessage("");
        try {
          await save({
            clerkId: record.clerkId,
            kickoffAt: kickoff
              ? new Date(`${kickoff}:00-07:00`).getTime()
              : null,
            nextAction,
            nextActionOwner: owner,
            privateNotes: notes,
          });
          setDirty(false);
          setMessage("Coordination saved.");
        } catch (error) {
          setMessage(errorMessage(error));
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy}>
        <legend className="font-semibold">Kickoff and next action</legend>
        <div className="rr-ops-form-grid">
          <label>
            Kickoff time · Phoenix (MST)
            <Input
              type="datetime-local"
              value={kickoff}
              onChange={(event) => {
                setKickoff(event.target.value);
                setDirty(true);
              }}
            />
          </label>
          <label>
            Who owns the next action?
            <select
              value={owner}
              onChange={(event) => {
                setOwner(event.target.value as "berny" | "customer");
                setDirty(true);
              }}
            >
              <option value="berny">Berny</option>
              <option value="customer">Customer</option>
            </select>
          </label>
        </div>
        <label>
          Next action · visible to the customer
          <Input
            value={nextAction}
            required
            maxLength={240}
            onChange={(event) => {
              setNextAction(event.target.value);
              setDirty(true);
            }}
          />
        </label>
        <label>
          Private notes · operator only
          <textarea
            rows={3}
            maxLength={4000}
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value);
              setDirty(true);
            }}
          />
        </label>
        <p className="text-xs text-muted-foreground">
          Keep passwords, tax IDs and registration documents in the private
          provider process. Store references here.
        </p>
        <Button type="submit" variant="outline" disabled={busy || !dirty}>
          {busy ? "Saving…" : "Save coordination"}
        </Button>
      </fieldset>
      {message && <p role="status">{message}</p>}
    </form>
  );
}

function PreferenceEditor({ enrollment }: { enrollment: Enrollment }) {
  const save = useMutation(api.concierge.updateConfiguration);
  const account = enrollment.account;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  if (!account) return null;
  return (
    <details className="rr-ops-details">
      <summary>Prepare reply and handoff preferences</summary>
      <p className="mt-3 text-sm">
        Save configuration before confirming the checklist. Changes pause
        messaging and require a fresh review. Customer SMS permission can only
        be supplied by the customer.
      </p>
      <form
        className="rr-ops-form"
        onSubmit={async (event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          setBusy(true);
          setMessage("");
          try {
            await save({
              clerkId: enrollment.clerkId,
              data: {
                aiTone: String(data.get("aiTone")) as NonNullable<
                  typeof account.aiTone
                >,
                leadHandoffMode: String(
                  data.get("leadHandoffMode"),
                ) as NonNullable<typeof account.leadHandoffMode>,
                preferredJobTypes: data.getAll(
                  "preferredJobTypes",
                ) as NonNullable<typeof account.preferredJobTypes>,
                filteredJobTypes: String(data.get("filteredJobTypes"))
                  .split(",")
                  .map((value) => value.trim())
                  .filter(Boolean),
                bookingLink: String(data.get("bookingLink")).trim(),
                handoffInstructions: String(
                  data.get("handoffInstructions"),
                ).trim(),
                callApproach: String(data.get("callApproach")).trim(),
                thingsNotToSay: String(data.get("thingsNotToSay")).trim(),
              },
            });
            setMessage(
              "Preferences saved. Messaging is paused; confirm the updated setup checklist.",
            );
          } catch (error) {
            setMessage(errorMessage(error));
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy}>
          <div className="rr-ops-form-grid">
            <label>
              Reply style
              <select name="aiTone" defaultValue={account.aiTone || "friendly"}>
                {[
                  "friendly",
                  "professional",
                  "straight_to_point",
                  "bilingual",
                  "custom",
                ].map((value) => (
                  <option key={value} value={value}>
                    {value.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Handoff
              <select
                name="leadHandoffMode"
                defaultValue={account.leadHandoffMode || "review_first"}
              >
                {[
                  "review_first",
                  "booking_link",
                  "review_and_booking",
                  "emergency_escalation",
                ].map((value) => (
                  <option key={value} value={value}>
                    {value.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <fieldset className="rr-job-options">
            <legend>Preferred jobs</legend>
            {[
              "leak_repairs",
              "storm_damage",
              "emergency_tarping",
              "tile_shingle",
              "insurance_jobs",
            ].map((value) => (
              <label key={value}>
                <input
                  type="checkbox"
                  name="preferredJobTypes"
                  value={value}
                  defaultChecked={account.preferredJobTypes?.some(
                    (job) => job === value,
                  )}
                />
                {value.replaceAll("_", " ")}
              </label>
            ))}
          </fieldset>
          <label>
            Excluded jobs · comma separated
            <Input
              name="filteredJobTypes"
              defaultValue={account.filteredJobTypes?.join(", ") || ""}
              maxLength={2000}
            />
          </label>
          <label>
            Booking link · if used
            <Input
              name="bookingLink"
              type="url"
              defaultValue={account.bookingLink || ""}
              maxLength={2000}
              placeholder="https://calendly.com/your-team/inspection"
            />
          </label>
          {(
            [
              [
                "handoffInstructions",
                "Follow-up owner, urgent handling and handoff instructions",
              ],
              [
                "callApproach",
                "Qualification criteria and conversation guidance",
              ],
              ["thingsNotToSay", "Restrictions and things to avoid"],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              {label}
              <textarea
                name={key}
                rows={2}
                defaultValue={account[key] || ""}
                maxLength={2000}
              />
            </label>
          ))}
          <Button type="submit" variant="outline" disabled={busy}>
            {busy ? "Saving…" : "Save preferences for review"}
          </Button>
        </fieldset>
        {message && <p role="status">{message}</p>}
      </form>
    </details>
  );
}

function EnrollmentCard({
  enrollment: record,
  now,
}: {
  enrollment: Enrollment;
  now: number;
}) {
  const mark = useMutation(api.concierge.markContacted);
  const initialDrafts = conciergeDrafts(
    record.user?.name,
    record.account?.legalBusinessName || "your roofing business",
  );
  const [drafts, setDrafts] = useState(initialDrafts);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = pendingContactChannels(record);
  const overdue = pending.length > 0 && now > record.followUpDueAt;
  const onTime =
    !pending.length &&
    requestedChannels(record.contactPreference).every(
      (channel) =>
        (channel === "email"
          ? record.emailContactedAt!
          : record.smsContactedAt!) <= record.followUpDueAt,
    );
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(
        "Draft copied. Send it personally, then mark the channel as sent.",
      );
    } catch {
      setMessage("Copy is unavailable here. Select and copy the draft text.");
    }
  }
  return (
    <details className="rr-enrollment-record">
      <summary>
        <span>
          <strong>
            {record.account?.legalBusinessName || "Roofing business"}
          </strong>
          <small>
            {CONTACT_LABELS[record.contactPreference]} ·{" "}
            {record.blockers.length} setup items remaining
          </small>
        </span>
        <span className={overdue ? "rr-queue-overdue" : "rr-queue-badge"}>
          {pending.length
            ? overdue
              ? "Follow-up overdue"
              : "Contact today"
            : onTime
              ? "Contacted same day"
              : "Contacted after deadline"}
        </span>
      </summary>
      <div className="rr-enrollment-record-body">
        <dl className="rr-enrollment-facts">
          <div>
            <dt>Email</dt>
            <dd>{record.user?.email || "Not provided"}</dd>
          </div>
          <div>
            <dt>Alert mobile</dt>
            <dd>{formatPhoneNumber(record.account?.bookingDeliveryPhone)}</dd>
          </div>
          <div>
            <dt>Business phone</dt>
            <dd>{formatPhoneNumber(record.account?.businessPhone)}</dd>
          </div>
          <div>
            <dt>Coverage</dt>
            <dd>
              {record.account?.serviceAreas
                ?.map((area) => area.value)
                .join(", ") || "Not provided"}
            </dd>
          </div>
          <div>
            <dt>Follow-up due · Phoenix</dt>
            <dd>{formatConciergeDate(record.followUpDueAt)}</dd>
          </div>
          <div>
            <dt>
              Next · {record.nextActionOwner === "berny" ? "Berny" : "Customer"}
            </dt>
            <dd>{record.nextAction}</dd>
          </div>
        </dl>
        <section className="rr-contact-drafts">
          <h3>Personal welcome</h3>
          <p>
            Use the customer’s chosen channels. Email carries the details; text
            stays brief. These controls do not send messages.
          </p>
          {requestedChannels(record.contactPreference).map((channel) => {
            const contactedAt =
              channel === "email"
                ? record.emailContactedAt
                : record.smsContactedAt;
            return (
              <div key={channel} className="rr-contact-draft">
                {channel === "email" && (
                  <label>
                    Email subject
                    <Input
                      value={drafts.subject}
                      onChange={(event) =>
                        setDrafts({ ...drafts, subject: event.target.value })
                      }
                    />
                  </label>
                )}
                <label>
                  {channel === "email" ? "Welcome email" : "Short welcome text"}
                  <textarea
                    rows={channel === "email" ? 9 : 3}
                    value={drafts[channel]}
                    onChange={(event) =>
                      setDrafts({ ...drafts, [channel]: event.target.value })
                    }
                  />
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() =>
                      copy(
                        channel === "email"
                          ? `Subject: ${drafts.subject}\n\n${drafts.email}`
                          : drafts.sms,
                      )
                    }
                  >
                    Copy {channel === "email" ? "email" : "text"}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy || !!contactedAt}
                    onClick={async () => {
                      setBusy(true);
                      setMessage("");
                      try {
                        await mark({ clerkId: record.clerkId, channel });
                        setMessage("Contact recorded.");
                      } catch (error) {
                        setMessage(errorMessage(error));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {contactedAt
                      ? `Sent ${formatConciergeDate(contactedAt)}`
                      : `Mark ${channel === "email" ? "email" : "text"} sent`}
                  </Button>
                </div>
              </div>
            );
          })}
          {message && <p role="status">{message}</p>}
        </section>
        <CoordinationEditor enrollment={record} />
        <PreferenceEditor enrollment={record} />
        <section className="rr-concierge-checklist">
          <h3>Everything needed before launch</h3>
          <p>
            Each item needs a recorded confirmation. Sensitive registration
            details stay in the private provider process. Customer-specific
            routing and delivery checks remain in the account controls below.
          </p>
          {record.checklist.map((item) => (
            <ChecklistRow key={item.key} clerkId={record.clerkId} item={item} />
          ))}
        </section>
      </div>
    </details>
  );
}

export function ConciergeQueue() {
  const records = useQuery(api.concierge.enrollments, {});
  const [now, setNow] = useState(() => Date.now());
  const [includeLive, setIncludeLive] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  if (!records)
    return (
      <section className="rr-app-card p-6" role="status">
        Loading enrollments…
      </section>
    );
  const waiting = records.filter(
    (record) => pendingContactChannels(record).length,
  );
  const overdue = waiting.filter((record) => record.followUpDueAt < now);
  const visible = records
    .filter(
      (record) => includeLive || record.account?.activationMode !== "live",
    )
    .sort(
      (a, b) =>
        Number(!!pendingContactChannels(b).length) -
          Number(!!pendingContactChannels(a).length) ||
        a.followUpDueAt - b.followUpDueAt,
    );
  return (
    <section
      className="rr-concierge-queue"
      aria-labelledby="enrollment-queue-title"
    >
      <div className="rr-queue-heading">
        <div>
          <p className="rr-eyebrow">Personal follow-through</p>
          <h2 id="enrollment-queue-title">Your enrollment queue</h2>
          <p>
            {waiting.length} awaiting contact
            {overdue.length ? ` · ${overdue.length} overdue` : ""} · same-day
            deadline, Phoenix time
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeLive}
            onChange={(event) => setIncludeLive(event.target.checked)}
          />
          Include live customers
        </label>
      </div>
      {visible.length ? (
        visible.map((record) => (
          <EnrollmentCard key={record._id} enrollment={record} now={now} />
        ))
      ) : (
        <p className="p-5 text-sm text-muted-foreground">
          No enrollments awaiting setup. New customer details will appear here
          when submitted.
        </p>
      )}
    </section>
  );
}
