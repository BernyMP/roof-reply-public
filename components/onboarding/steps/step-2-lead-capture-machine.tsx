"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LEAD_HANDOFF_LABELS, LeadHandoffMode } from "@/lib/lead-handoff";
import {
  ACCOUNT_SMS_CONSENT_TEXT,
  ACCOUNT_SMS_CONSENT_VERSION,
  hasCurrentAccountSmsConsent,
  normalizeConsentPhone,
} from "@/lib/account-sms-consent";

interface Step2LeadCaptureMachineProps {
  onNext: () => void;
  onBack: () => void;
  clerkId: string;
}

const JOB_TYPES = [
  { value: "leak_repairs", label: "Leak repairs" },
  { value: "storm_damage", label: "Storm damage" },
  { value: "emergency_tarping", label: "Emergency tarping" },
  { value: "tile_shingle", label: "Tile/shingle repair" },
  { value: "insurance_jobs", label: "Insurance jobs" },
] as const;

export function Step2LeadCaptureMachine({
  onNext,
  onBack,
  clerkId,
}: Step2LeadCaptureMachineProps) {
  const onboarding = useQuery(api.onboarding.getOnboarding, { clerkId });
  const saveStep = useMutation(api.onboarding.saveOnboardingStep);

  // Lead delivery
  const [deliveryPhone, setDeliveryPhone] = useState("");
  const [accountSmsConsentGranted, setAccountSmsConsentGranted] =
    useState(false);
  const [leadHandoffMode, setLeadHandoffMode] =
    useState<LeadHandoffMode>("review_first");
  const [bookingLink, setBookingLink] = useState("");
  const [bookingLinkLabel, setBookingLinkLabel] = useState(
    "Schedule roof inspection",
  );
  const [autoBookingJobTypes, setAutoBookingJobTypes] = useState<string[]>([]);
  const [handoffInstructions, setHandoffInstructions] = useState("");

  // Service Areas
  const [serviceAreas, setServiceAreas] = useState<
    Array<{ type: string; value: string }>
  >([]);
  const [newAreaType, setNewAreaType] = useState<"zip" | "city" | "radius">(
    "zip",
  );
  const [newAreaValue, setNewAreaValue] = useState("");

  // Job Types
  const [preferredJobTypes, setPreferredJobTypes] = useState<string[]>([]);
  const [filteredJobTypes, setFilteredJobTypes] = useState("");

  useEffect(() => {
    if (onboarding) {
      setDeliveryPhone(onboarding.bookingDeliveryPhone || "");
      setAccountSmsConsentGranted(
        hasCurrentAccountSmsConsent({
          phoneNumber: onboarding.bookingDeliveryPhone,
          consentGranted: onboarding.accountSmsConsentGranted,
          consentPhone: onboarding.accountSmsConsentPhone,
          consentText: onboarding.accountSmsConsentText,
          consentVersion: onboarding.accountSmsConsentVersion,
        }),
      );
      setLeadHandoffMode(onboarding.leadHandoffMode || "review_first");
      setBookingLink(onboarding.bookingLink || "");
      setBookingLinkLabel(
        onboarding.bookingLinkLabel || "Schedule roof inspection",
      );
      setAutoBookingJobTypes(onboarding.autoBookingJobTypes || []);
      setHandoffInstructions(onboarding.handoffInstructions || "");
      setServiceAreas(onboarding.serviceAreas || []);
      setPreferredJobTypes(onboarding.preferredJobTypes || []);
      setFilteredJobTypes(onboarding.filteredJobTypes?.join(", ") || "");
    }
  }, [onboarding]);

  const addServiceArea = () => {
    if (newAreaValue.trim()) {
      setServiceAreas([
        ...serviceAreas,
        { type: newAreaType, value: newAreaValue.trim() },
      ]);
      setNewAreaValue("");
    }
  };

  const removeServiceArea = (index: number) => {
    setServiceAreas(serviceAreas.filter((_, i) => i !== index));
  };

  const toggleJobType = (jobType: string) => {
    setPreferredJobTypes(
      preferredJobTypes.includes(jobType)
        ? preferredJobTypes.filter((t) => t !== jobType)
        : [...preferredJobTypes, jobType],
    );
  };

  const toggleAutoBookingJobType = (jobType: string) => {
    setAutoBookingJobTypes(
      autoBookingJobTypes.includes(jobType)
        ? autoBookingJobTypes.filter((t) => t !== jobType)
        : [...autoBookingJobTypes, jobType],
    );
  };

  const updateDeliveryPhone = (value: string) => {
    setDeliveryPhone(value);

    if (
      normalizeConsentPhone(value) !==
      normalizeConsentPhone(onboarding?.accountSmsConsentPhone)
    ) {
      setAccountSmsConsentGranted(false);
    }
  };

  const handleNext = async () => {
    const data: any = {
      bookingDeliveryMethod: "phone",
      leadHandoffMode,
      bookingLink: bookingLink.trim() || undefined,
      bookingLinkLabel: bookingLinkLabel.trim() || undefined,
      autoBookingJobTypes,
      handoffInstructions: handoffInstructions.trim() || undefined,
      serviceAreas,
      preferredJobTypes: preferredJobTypes,
      filteredJobTypes: filteredJobTypes
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };

    data.bookingDeliveryPhone = deliveryPhone;
    data.accountSmsConsentGranted = accountSmsConsentGranted;

    if (accountSmsConsentGranted) {
      data.accountSmsConsentAt = Date.now();
      data.accountSmsConsentPhone = deliveryPhone.trim();
      data.accountSmsConsentText = ACCOUNT_SMS_CONSENT_TEXT;
      data.accountSmsConsentVersion = ACCOUNT_SMS_CONSENT_VERSION;
    }

    await saveStep({ clerkId, step: 2, data });
    onNext();
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-foreground">
          Tell RoofReply Where to Send Saved Jobs
        </h2>
        <p className="text-muted-foreground">
          When RoofReply recovers a missed-call lead, we’ll send you everything
          you need to book the job fast.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lead delivery & coverage area</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Lead delivery */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">
              Where should we text recovered lead alerts?
            </Label>
            <p className="text-sm text-muted-foreground">
              Qualified lead summaries will be sent to the phone you want to
              monitor for owner alerts.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="onboarding-alert-phone">
              Phone number for lead alerts
            </Label>
            <Input
              id="onboarding-alert-phone"
              type="tel"
              placeholder="(555) 123-4567"
              value={deliveryPhone}
              onChange={(e) => updateDeliveryPhone(e.target.value)}
            />
          </div>

          <div className="flex items-start gap-3 rounded-lg border bg-muted/20 p-4">
            <Checkbox
              id="accountSmsConsent"
              checked={accountSmsConsentGranted}
              onCheckedChange={(checked) =>
                setAccountSmsConsentGranted(checked === true)
              }
            />
            <Label
              htmlFor="accountSmsConsent"
              className="cursor-pointer text-sm font-normal leading-6 text-muted-foreground"
            >
              <span className="block font-medium text-foreground">
                Allow setup and demo SMS to this phone
              </span>
              {ACCOUNT_SMS_CONSENT_TEXT}
            </Label>
          </div>

          <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
            <div className="space-y-2">
              <Label className="text-base font-semibold">
                How should RoofReply hand off qualified leads?
              </Label>
              <p className="text-sm text-muted-foreground">
                Choose contractor review, Calendly handoff, both, or
                emergency-first review.
              </p>
            </div>

            <Select
              value={leadHandoffMode}
              onValueChange={(value) =>
                setLeadHandoffMode(value as LeadHandoffMode)
              }
            >
              <SelectTrigger aria-label="Lead handoff mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LEAD_HANDOFF_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="rounded-md bg-background p-3 text-sm text-muted-foreground">
              {leadHandoffMode === "review_first" &&
                "RoofReply qualifies the homeowner, then texts you the summary for review."}
              {leadHandoffMode === "booking_link" &&
                "RoofReply qualifies the homeowner, then sends your Calendly booking link directly."}
              {leadHandoffMode === "review_and_booking" &&
                "RoofReply sends the homeowner your Calendly booking link and texts you the summary."}
              {leadHandoffMode === "emergency_escalation" &&
                "RoofReply sends Calendly booking links for normal qualified leads, but routes urgent leads to you first."}
            </div>

            {leadHandoffMode !== "review_first" && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="onboarding-booking-link">
                    Calendly booking link
                  </Label>
                  <Input
                    id="onboarding-booking-link"
                    type="url"
                    placeholder="https://calendly.com/your-team/inspection"
                    value={bookingLink}
                    onChange={(e) => setBookingLink(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="onboarding-booking-label">
                    Calendly link label
                  </Label>
                  <Input
                    id="onboarding-booking-label"
                    value={bookingLinkLabel}
                    onChange={(e) => setBookingLinkLabel(e.target.value)}
                    placeholder="Schedule roof inspection"
                  />
                </div>
              </div>
            )}

            {(leadHandoffMode === "booking_link" ||
              leadHandoffMode === "emergency_escalation") && (
              <div className="space-y-2">
                <Label>Which jobs can be sent to Calendly automatically?</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {JOB_TYPES.map((job) => (
                    <div
                      key={job.value}
                      className="flex items-center space-x-2 rounded-md border bg-background p-3"
                    >
                      <Checkbox
                        id={`auto-${job.value}`}
                        checked={autoBookingJobTypes.includes(job.value)}
                        onCheckedChange={() =>
                          toggleAutoBookingJobType(job.value)
                        }
                      />
                      <Label htmlFor={`auto-${job.value}`}>{job.label}</Label>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Leave blank to allow any qualified non-emergency job to get
                  the Calendly booking link.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="onboarding-handoff-instructions">
                Extra handoff instructions
              </Label>
              <Textarea
                id="onboarding-handoff-instructions"
                placeholder="e.g., Active leaks should be reviewed first. Send inspections to Calendly. Never auto-book insurance questions."
                value={handoffInstructions}
                onChange={(e) => setHandoffInstructions(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          </div>

          {/* Service areas */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">
              What areas do you want RoofReply to cover?
            </Label>
            <p className="text-sm text-muted-foreground">
              Use these areas to guide intake and contractor follow-up.
            </p>

            <div className="flex gap-2">
              <Select
                value={newAreaType}
                onValueChange={(v: any) => setNewAreaType(v)}
              >
                <SelectTrigger
                  aria-label="Service area type"
                  className="w-[120px]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zip">ZIP code</SelectItem>
                  <SelectItem value="city">City</SelectItem>
                  <SelectItem value="radius">Radius</SelectItem>
                </SelectContent>
              </Select>

              <Input
                aria-label="Service area"
                placeholder={
                  newAreaType === "zip"
                    ? "85251"
                    : newAreaType === "city"
                      ? "Scottsdale"
                      : "20 miles from Scottsdale"
                }
                value={newAreaValue}
                onChange={(e) => setNewAreaValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addServiceArea()}
              />

              <Button variant="outline" onClick={addServiceArea}>
                Add
              </Button>
            </div>

            {serviceAreas.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {serviceAreas.map((area, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 bg-muted px-3 py-1 rounded-md text-sm"
                  >
                    <span>
                      {area.type === "zip"
                        ? "ZIP"
                        : area.type === "city"
                          ? "City"
                          : "Radius"}
                      : {area.value}
                    </span>
                    <button
                      aria-label={`Remove ${area.value}`}
                      onClick={() => removeServiceArea(i)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Job preferences */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">
              What jobs do you want more of?
            </Label>
            <p className="text-sm text-muted-foreground">
              RoofReply will prioritize these when packaging recovered leads.
            </p>

            <div className="space-y-2">
              {JOB_TYPES.map((job) => (
                <div key={job.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={job.value}
                    checked={preferredJobTypes.includes(job.value)}
                    onCheckedChange={() => toggleJobType(job.value)}
                  />
                  <Label htmlFor={job.value}>{job.label}</Label>
                </div>
              ))}
            </div>
          </div>

          {/* Unwanted jobs */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">
              Any jobs you don’t want RoofReply to send you?
            </Label>
            <Textarea
              placeholder="e.g., No patch jobs under $250, no full replacements, nothing over 30 miles..."
              value={filteredJobTypes}
              onChange={(e) => setFilteredJobTypes(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between pt-6">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button
          onClick={handleNext}
          disabled={
            !deliveryPhone.trim() ||
            !accountSmsConsentGranted ||
            (leadHandoffMode !== "review_first" && !bookingLink.trim())
          }
        >
          Continue
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
