"use client";

import { PageHeading } from "@/components/dashboard/page-heading";
import { ElementType, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DashboardLoading } from "@/components/dashboard/dashboard-loading";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CalendarCheck,
  Globe2,
  Loader2,
  MapPinned,
  MessageSquare,
  Pencil,
} from "lucide-react";
import { formatPhoneNumber } from "@/lib/format-phone";
import { LEAD_HANDOFF_LABELS, LeadHandoffMode } from "@/lib/lead-handoff";
import {
  ACCOUNT_SMS_CONSENT_TEXT,
  ACCOUNT_SMS_CONSENT_VERSION,
  hasCurrentAccountSmsConsent,
  normalizeConsentPhone,
} from "@/lib/account-sms-consent";

type JobType =
  | "leak_repairs"
  | "storm_damage"
  | "emergency_tarping"
  | "tile_shingle"
  | "insurance_jobs";

const JOB_TYPE_LABELS: Record<JobType, string> = {
  leak_repairs: "Leak Repairs",
  storm_damage: "Storm Damage",
  emergency_tarping: "Emergency Tarping",
  tile_shingle: "Tile & Shingle",
  insurance_jobs: "Insurance Jobs",
};

const AI_TONE_LABELS: Record<string, string> = {
  professional: "Professional",
  friendly: "Friendly",
  straight_to_point: "Straight to the Point",
  bilingual: "Bilingual (EN/ES)",
  custom: "Custom",
};

function SaveNotice({ error }: { error: string }) {
  return (
    <div className="space-y-2 text-sm">
      <p className="rounded-lg bg-muted/60 p-3 leading-6 text-muted-foreground">
        Saving changes pauses messaging until RoofReply reviews your setup.
        Contact Berny if you’d like help making a change.
      </p>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}

function ConfigSectionCard({
  icon: Icon,
  title,
  description,
  items,
  onEdit,
  id,
}: {
  icon: ElementType;
  title: string;
  description: string;
  items: Array<{ label: string; value: string; hint?: string }>;
  onEdit?: () => void;
  id?: string;
}) {
  return (
    <div id={id} className="rr-app-card scroll-mt-24 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl border border-border bg-muted">
            <Icon className="size-5 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
        </div>
        {onEdit && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:bg-muted hover:text-foreground"
            id={`${id}-edit`}
            aria-label={`Edit ${title.toLowerCase()}`}
            onClick={onEdit}
          >
            <Pencil className="mr-2 size-4" />
            Edit
          </Button>
        )}
      </div>

      <div className="mt-4 grid gap-2">
        {items.map((item) => (
          <div key={item.label} className="min-w-0">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="mt-1 break-words text-sm text-foreground">
              {item.value}
            </p>
            {item.hint && (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {item.hint}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const fieldClassName =
  "border-border bg-muted text-foreground placeholder:text-muted-foreground";
const outlineButtonClassName =
  "border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground";

export default function ConfigPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const hasCompleted = useQuery(
    api.users.hasCompletedOnboarding,
    user?.id ? { clerkId: user.id } : "skip",
  );
  const onboarding = useQuery(
    api.onboarding.getOnboarding,
    user?.id ? { clerkId: user.id } : "skip",
  );
  const updateSettings = useMutation(api.onboarding.updateSettings);

  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveResult, setSaveResult] = useState("");

  function openSection(section: string) {
    setSaveError("");
    setSaveResult("");
    setEditingSection(section);
  }

  const [leadDelivery, setLeadDelivery] = useState({
    bookingDeliveryMethod: "phone" as const,
    bookingDeliveryPhone: "",
    accountSmsConsentGranted: false,
    leadHandoffMode: "review_first" as LeadHandoffMode,
    bookingLink: "",
    bookingLinkLabel: "Schedule roof inspection",
    autoBookingJobTypes: [] as string[],
    handoffInstructions: "",
  });

  const [serviceArea, setServiceArea] = useState({
    serviceAreas: [] as Array<{
      type: "zip" | "city" | "radius";
      value: string;
    }>,
    preferredJobTypes: [] as JobType[],
  });

  const [voiceRules, setVoiceRules] = useState({
    aiTone: "friendly" as
      | "professional"
      | "friendly"
      | "straight_to_point"
      | "bilingual"
      | "custom",
    thingsNotToSay: "",
    callApproach: "",
    collectPhotosFirst: false,
  });

  const [businessInfo, setBusinessInfo] = useState({
    legalBusinessName: "",
    website: "",
    businessPhone: "",
  });

  useEffect(() => {
    if (onboarding && !editingSection) {
      setLeadDelivery({
        bookingDeliveryMethod: "phone",
        bookingDeliveryPhone: onboarding.bookingDeliveryPhone || "",
        accountSmsConsentGranted: hasCurrentAccountSmsConsent({
          phoneNumber: onboarding.bookingDeliveryPhone,
          consentGranted: onboarding.accountSmsConsentGranted,
          consentPhone: onboarding.accountSmsConsentPhone,
          consentText: onboarding.accountSmsConsentText,
          consentVersion: onboarding.accountSmsConsentVersion,
        }),
        leadHandoffMode: onboarding.leadHandoffMode || "review_first",
        bookingLink: onboarding.bookingLink || "",
        bookingLinkLabel:
          onboarding.bookingLinkLabel || "Schedule roof inspection",
        autoBookingJobTypes: onboarding.autoBookingJobTypes || [],
        handoffInstructions: onboarding.handoffInstructions || "",
      });
      setServiceArea({
        serviceAreas: onboarding.serviceAreas || [],
        preferredJobTypes: (onboarding.preferredJobTypes as JobType[]) || [],
      });
      setVoiceRules({
        aiTone: onboarding.aiTone || "friendly",
        thingsNotToSay: onboarding.thingsNotToSay || "",
        callApproach: onboarding.callApproach || "",
        collectPhotosFirst: false,
      });
      setBusinessInfo({
        legalBusinessName: onboarding.legalBusinessName || "",
        website: onboarding.website || "",
        businessPhone: onboarding.businessPhone || "",
      });
    }
  }, [onboarding, editingSection]);

  useEffect(() => {
    if (isLoaded && !user) {
      router.push("/");
    }
    if (isLoaded && user && hasCompleted === false) {
      router.push("/onboarding");
    }
  }, [isLoaded, user, hasCompleted, router]);

  const handleSave = async (section: string) => {
    if (!user?.id || isSaving) return;
    setIsSaving(true);
    setSaveError("");
    setSaveResult("");

    try {
      switch (section) {
        case "leadDelivery":
          await updateSettings({
            clerkId: user.id,
            bookingDeliveryMethod: "phone",
            bookingDeliveryPhone: leadDelivery.bookingDeliveryPhone,
            accountSmsConsentGranted: leadDelivery.accountSmsConsentGranted,
            accountSmsConsentAt: leadDelivery.accountSmsConsentGranted
              ? Date.now()
              : undefined,
            accountSmsConsentPhone: leadDelivery.accountSmsConsentGranted
              ? leadDelivery.bookingDeliveryPhone.trim()
              : undefined,
            accountSmsConsentText: leadDelivery.accountSmsConsentGranted
              ? ACCOUNT_SMS_CONSENT_TEXT
              : undefined,
            accountSmsConsentVersion: leadDelivery.accountSmsConsentGranted
              ? ACCOUNT_SMS_CONSENT_VERSION
              : undefined,
            leadHandoffMode: leadDelivery.leadHandoffMode,
            bookingLink: leadDelivery.bookingLink.trim() || undefined,
            bookingLinkLabel: leadDelivery.bookingLinkLabel.trim() || undefined,
            autoBookingJobTypes: leadDelivery.autoBookingJobTypes,
            handoffInstructions:
              leadDelivery.handoffInstructions.trim() || undefined,
          });
          break;
        case "serviceArea":
          await updateSettings({
            clerkId: user.id,
            serviceAreas: serviceArea.serviceAreas,
            preferredJobTypes: serviceArea.preferredJobTypes,
          });
          break;
        case "voiceRules":
          await updateSettings({
            clerkId: user.id,
            aiTone: voiceRules.aiTone,
            thingsNotToSay: voiceRules.thingsNotToSay,
            callApproach: voiceRules.callApproach.trim(),
            collectPhotosFirst: false,
          });
          break;
        case "businessInfo":
          await updateSettings({
            clerkId: user.id,
            legalBusinessName: businessInfo.legalBusinessName,
            website: businessInfo.website,
            businessPhone: businessInfo.businessPhone,
          });
          break;
      }

      setEditingSection(null);
      setSaveResult(
        "Changes saved. Messaging is paused while RoofReply reviews your setup.",
      );
    } catch {
      setSaveError(
        "We couldn’t save your changes. Your entries are still here. Please try again or contact Berny for help.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const toggleJobType = (jobType: JobType) => {
    setServiceArea((prev) => ({
      ...prev,
      preferredJobTypes: prev.preferredJobTypes.includes(jobType)
        ? prev.preferredJobTypes.filter((j) => j !== jobType)
        : [...prev.preferredJobTypes, jobType],
    }));
  };

  const addServiceArea = () => {
    setServiceArea((prev) => ({
      ...prev,
      serviceAreas: [...prev.serviceAreas, { type: "zip", value: "" }],
    }));
  };

  const toggleAutoBookingJobType = (jobType: JobType) => {
    setLeadDelivery((prev) => ({
      ...prev,
      autoBookingJobTypes: prev.autoBookingJobTypes.includes(jobType)
        ? prev.autoBookingJobTypes.filter((j) => j !== jobType)
        : [...prev.autoBookingJobTypes, jobType],
    }));
  };

  const updateLeadDeliveryPhone = (value: string) => {
    setLeadDelivery((prev) => ({
      ...prev,
      bookingDeliveryPhone: value,
      accountSmsConsentGranted:
        normalizeConsentPhone(value) ===
          normalizeConsentPhone(onboarding?.accountSmsConsentPhone) &&
        hasCurrentAccountSmsConsent({
          phoneNumber: value,
          consentGranted: onboarding?.accountSmsConsentGranted,
          consentPhone: onboarding?.accountSmsConsentPhone,
          consentText: onboarding?.accountSmsConsentText,
          consentVersion: onboarding?.accountSmsConsentVersion,
        }),
    }));
  };

  const removeServiceArea = (index: number) => {
    setServiceArea((prev) => ({
      ...prev,
      serviceAreas: prev.serviceAreas.filter((_, i) => i !== index),
    }));
  };

  const updateServiceArea = (
    index: number,
    field: "type" | "value",
    value: string,
  ) => {
    setServiceArea((prev) => ({
      ...prev,
      serviceAreas: prev.serviceAreas.map((area, i) =>
        i === index ? { ...area, [field]: value } : area,
      ),
    }));
  };

  if (
    !isLoaded ||
    !user ||
    hasCompleted === undefined ||
    hasCompleted === false ||
    onboarding === undefined
  ) {
    return <DashboardLoading label="Loading settings" />;
  }

  const serviceAreaCount = onboarding?.serviceAreas?.length || 0;
  const preferredJobsCount = onboarding?.preferredJobTypes?.length || 0;
  const accountSmsConsentReady = hasCurrentAccountSmsConsent({
    phoneNumber: onboarding?.bookingDeliveryPhone,
    consentGranted: onboarding?.accountSmsConsentGranted,
    consentPhone: onboarding?.accountSmsConsentPhone,
    consentText: onboarding?.accountSmsConsentText,
    consentVersion: onboarding?.accountSmsConsentVersion,
  });

  return (
    <div className="rr-app-page">
      <div className="rr-app-wrap space-y-6">
        <PageHeading
          title="Settings"
          description="Your business details and preferences. We’ll help with the configuration."
        />
        {saveResult && (
          <p role="status" className="rounded-lg border bg-white p-4 text-sm">
            {saveResult}{" "}
            <a className="rr-text-link" href="mailto:hello@example.com">
              Contact Berny →
            </a>
          </p>
        )}

        <div className="grid gap-4 xl:grid-cols-2">
          <ConfigSectionCard
            id="account"
            icon={Globe2}
            title="Business"
            description="Legal business details used for account verification."
            items={[
              {
                label: "Business name",
                value: onboarding?.legalBusinessName || "Not set",
              },
              {
                label: "Website",
                value: onboarding?.website || "Not set",
              },
              {
                label: "Business phone",
                value: formatPhoneNumber(onboarding?.businessPhone),
              },
            ]}
            onEdit={() => openSection("businessInfo")}
          />

          <ConfigSectionCard
            id="handoff"
            icon={CalendarCheck}
            title="Lead delivery"
            description="Where we send alerts and how you follow up with homeowners."
            items={[
              {
                label: "Lead preference",
                value:
                  LEAD_HANDOFF_LABELS[
                    onboarding?.leadHandoffMode || "review_first"
                  ],
              },
              {
                label: "Alert phone",
                value: formatPhoneNumber(onboarding?.bookingDeliveryPhone),
              },
              {
                label: "SMS permission",
                value: accountSmsConsentReady ? "Allowed" : "Needs consent",
              },
              ...(onboarding?.leadHandoffMode &&
              onboarding.leadHandoffMode !== "review_first"
                ? [
                    {
                      label: "Calendly link",
                      value: onboarding?.bookingLink || "Not configured",
                    },
                  ]
                : []),
            ]}
            onEdit={() => openSection("leadDelivery")}
          />

          <ConfigSectionCard
            id="service-area"
            icon={MapPinned}
            title="Service area"
            description="Locations and roofing work RoofReply should prioritize."
            items={[
              {
                label: "Coverage",
                value: `${serviceAreaCount} service area${serviceAreaCount === 1 ? "" : "s"}`,
              },
              {
                label: "Preferred jobs",
                value: `${preferredJobsCount} job type${preferredJobsCount === 1 ? "" : "s"}`,
                hint:
                  onboarding?.preferredJobTypes &&
                  onboarding.preferredJobTypes.length > 0
                    ? onboarding.preferredJobTypes
                        .map((j) => JOB_TYPE_LABELS[j as JobType])
                        .join(", ")
                    : "No preferred jobs selected yet.",
              },
              {
                label: "Area preview",
                value:
                  onboarding?.serviceAreas && onboarding.serviceAreas.length > 0
                    ? onboarding.serviceAreas
                        .slice(0, 3)
                        .map((area) => area.value)
                        .join(", ")
                    : "No areas added yet",
              },
            ]}
            onEdit={() => openSection("serviceArea")}
          />

          <ConfigSectionCard
            id="voice-rules"
            icon={MessageSquare}
            title="Text replies"
            description="The tone and instructions used in customer text messages."
            items={[
              {
                label: "Tone",
                value: AI_TONE_LABELS[onboarding?.aiTone || ""] || "Not set",
              },
              {
                label: "How your team talks to customers",
                value:
                  onboarding?.callApproach ||
                  "We’ll review this with you during setup.",
              },
              {
                label: "Reply instructions",
                value:
                  onboarding?.thingsNotToSay || "No extra restrictions set",
              },
            ]}
            onEdit={() => openSection("voiceRules")}
          />
        </div>
      </div>

      <Dialog
        open={editingSection === "leadDelivery"}
        onOpenChange={(open) => {
          if (!open && !isSaving) setEditingSection(null);
        }}
      >
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            document.getElementById("handoff-edit")?.focus();
          }}
          aria-describedby={undefined}
          className="max-w-2xl border-border bg-background text-foreground"
        >
          <DialogHeader>
            <DialogTitle>Edit lead delivery</DialogTitle>
          </DialogHeader>
          <SaveNotice error={saveError} />
          <div className="max-h-[70vh] space-y-5 overflow-y-auto py-4">
            <div className="space-y-2">
              <Label htmlFor="handoff-mode" className="text-muted-foreground">
                Handoff mode
              </Label>
              <Select
                value={leadDelivery.leadHandoffMode}
                onValueChange={(value) =>
                  setLeadDelivery((prev) => ({
                    ...prev,
                    leadHandoffMode: value as LeadHandoffMode,
                  }))
                }
              >
                <SelectTrigger
                  id="handoff-mode"
                  className="w-full border-border bg-muted text-foreground"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-border bg-card text-foreground">
                  {Object.entries(LEAD_HANDOFF_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs leading-relaxed text-muted-foreground">
                SMS review stays available in review-first, review + Calendly,
                and emergency handoff modes.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="alert-phone" className="text-muted-foreground">
                Phone Number (for SMS notifications)
              </Label>
              <Input
                id="alert-phone"
                type="tel"
                className={fieldClassName}
                value={leadDelivery.bookingDeliveryPhone}
                onChange={(e) => updateLeadDeliveryPhone(e.target.value)}
                placeholder="+1 (555) 123-4567"
              />
              <p className="text-xs text-muted-foreground">
                Qualified lead summaries are texted here when review is part of
                the handoff.
              </p>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-border bg-muted p-4">
              <Checkbox
                id="configAccountSmsConsent"
                className="mt-0.5 border-border"
                checked={leadDelivery.accountSmsConsentGranted}
                onCheckedChange={(checked) =>
                  setLeadDelivery((prev) => ({
                    ...prev,
                    accountSmsConsentGranted: checked === true,
                  }))
                }
              />
              <label
                htmlFor="configAccountSmsConsent"
                className="cursor-pointer text-sm leading-6 text-muted-foreground"
              >
                <span className="block font-medium text-muted-foreground">
                  Allow setup and demo SMS to this phone
                </span>
                {ACCOUNT_SMS_CONSENT_TEXT}
              </label>
            </div>
            {leadDelivery.leadHandoffMode !== "review_first" && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label
                    htmlFor="booking-link"
                    className="text-muted-foreground"
                  >
                    Calendly booking link
                  </Label>
                  <Input
                    id="booking-link"
                    type="url"
                    className={fieldClassName}
                    value={leadDelivery.bookingLink}
                    onChange={(e) =>
                      setLeadDelivery((prev) => ({
                        ...prev,
                        bookingLink: e.target.value,
                      }))
                    }
                    placeholder="https://calendly.com/your-team/inspection"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="booking-label"
                    className="text-muted-foreground"
                  >
                    Calendly link label
                  </Label>
                  <Input
                    id="booking-label"
                    className={fieldClassName}
                    value={leadDelivery.bookingLinkLabel}
                    onChange={(e) =>
                      setLeadDelivery((prev) => ({
                        ...prev,
                        bookingLinkLabel: e.target.value,
                      }))
                    }
                    placeholder="Schedule roof inspection"
                  />
                </div>
              </div>
            )}
            {(leadDelivery.leadHandoffMode === "booking_link" ||
              leadDelivery.leadHandoffMode === "emergency_escalation") && (
              <div className="space-y-3">
                <Label className="text-muted-foreground">
                  Jobs eligible for automatic Calendly handoff
                </Label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {(Object.keys(JOB_TYPE_LABELS) as JobType[]).map(
                    (jobType) => (
                      <div
                        key={jobType}
                        className="flex items-center space-x-2 rounded-xl border border-border bg-muted p-3"
                      >
                        <Checkbox
                          id={`handoff-${jobType}`}
                          className="border-border"
                          checked={leadDelivery.autoBookingJobTypes.includes(
                            jobType,
                          )}
                          onCheckedChange={() =>
                            toggleAutoBookingJobType(jobType)
                          }
                        />
                        <label
                          htmlFor={`handoff-${jobType}`}
                          className="cursor-pointer text-sm text-muted-foreground"
                        >
                          {JOB_TYPE_LABELS[jobType]}
                        </label>
                      </div>
                    ),
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Leave blank to allow any qualified non-emergency job to
                  receive the Calendly booking link.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label
                htmlFor="handoff-instructions"
                className="text-muted-foreground"
              >
                Extra handoff instructions
              </Label>
              <Textarea
                id="handoff-instructions"
                className={fieldClassName}
                value={leadDelivery.handoffInstructions}
                onChange={(e) =>
                  setLeadDelivery((prev) => ({
                    ...prev,
                    handoffInstructions: e.target.value,
                  }))
                }
                placeholder="e.g., Active leaks should be reviewed first. Send inspections to Calendly. Never auto-book insurance questions."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className={outlineButtonClassName}
              disabled={isSaving}
              onClick={() => setEditingSection(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleSave("leadDelivery")}
              disabled={
                isSaving ||
                !leadDelivery.bookingDeliveryPhone.trim() ||
                !leadDelivery.accountSmsConsentGranted
              }
            >
              {isSaving ? (
                <>
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />{" "}
                  Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editingSection === "serviceArea"}
        onOpenChange={(open) => {
          if (!open && !isSaving) setEditingSection(null);
        }}
      >
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            document.getElementById("service-area-edit")?.focus();
          }}
          aria-describedby={undefined}
          className="max-w-lg border-border bg-background text-foreground"
        >
          <DialogHeader>
            <DialogTitle>Edit service area and jobs</DialogTitle>
          </DialogHeader>
          <SaveNotice error={saveError} />
          <div className="max-h-[60vh] space-y-6 overflow-y-auto py-4">
            <div className="space-y-3">
              <Label className="text-muted-foreground">Service Areas</Label>
              {serviceArea.serviceAreas.map((area, index) => (
                <div key={index} className="flex gap-2">
                  <Select
                    value={area.type}
                    onValueChange={(value) =>
                      updateServiceArea(index, "type", value)
                    }
                  >
                    <SelectTrigger
                      aria-label={`Service area ${index + 1} type`}
                      className="w-32 border-border bg-muted text-foreground"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-border bg-card text-foreground">
                      <SelectItem value="zip">ZIP</SelectItem>
                      <SelectItem value="city">City</SelectItem>
                      <SelectItem value="radius">Radius</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    aria-label={`Service area ${index + 1}`}
                    className={fieldClassName}
                    value={area.value}
                    onChange={(e) =>
                      updateServiceArea(index, "value", e.target.value)
                    }
                    placeholder={
                      area.type === "zip"
                        ? "85001"
                        : area.type === "city"
                          ? "Phoenix"
                          : "25"
                    }
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className={outlineButtonClassName}
                    onClick={() => removeServiceArea(index)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className={outlineButtonClassName}
                onClick={addServiceArea}
              >
                Add Service Area
              </Button>
            </div>

            <div className="space-y-3">
              <Label className="text-muted-foreground">
                Preferred Job Types
              </Label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {(Object.keys(JOB_TYPE_LABELS) as JobType[]).map((jobType) => (
                  <div
                    key={jobType}
                    className="flex items-center space-x-2 rounded-xl border border-border bg-muted p-3"
                  >
                    <Checkbox
                      id={jobType}
                      className="border-border"
                      checked={serviceArea.preferredJobTypes.includes(jobType)}
                      onCheckedChange={() => toggleJobType(jobType)}
                    />
                    <label
                      htmlFor={jobType}
                      className="cursor-pointer text-sm text-muted-foreground"
                    >
                      {JOB_TYPE_LABELS[jobType]}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className={outlineButtonClassName}
              disabled={isSaving}
              onClick={() => setEditingSection(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleSave("serviceArea")}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />{" "}
                  Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editingSection === "voiceRules"}
        onOpenChange={(open) => {
          if (!open && !isSaving) setEditingSection(null);
        }}
      >
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            document.getElementById("voice-rules-edit")?.focus();
          }}
          aria-describedby={undefined}
          className="border-border bg-background text-foreground"
        >
          <DialogHeader>
            <DialogTitle>Edit text replies</DialogTitle>
          </DialogHeader>
          <SaveNotice error={saveError} />
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="sms-tone" className="text-muted-foreground">
                Reply tone
              </Label>
              <Select
                value={voiceRules.aiTone}
                onValueChange={(value) =>
                  setVoiceRules((prev) => ({
                    ...prev,
                    aiTone: value as typeof prev.aiTone,
                  }))
                }
              >
                <SelectTrigger
                  id="sms-tone"
                  className="w-full border-border bg-muted text-foreground"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-border bg-card text-foreground">
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="friendly">Friendly</SelectItem>
                  <SelectItem value="straight_to_point">
                    Straight to the Point
                  </SelectItem>
                  <SelectItem value="bilingual">Bilingual (EN/ES)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="customer-conversation-style"
                className="text-muted-foreground leading-6"
              >
                Do you have a usual greeting, questions, or follow-up script
                you’d like us to use? (optional)
              </Label>
              <Textarea
                id="customer-conversation-style"
                className={fieldClassName}
                value={voiceRules.callApproach}
                onChange={(event) =>
                  setVoiceRules((prev) => ({
                    ...prev,
                    callApproach: event.target.value,
                  }))
                }
                maxLength={2000}
                rows={4}
                aria-describedby="customer-conversation-style-help"
                placeholder="For example: Thank them for calling, ask what roofing issue they’re having and where the property is, then explain that our team will call to discuss an inspection."
              />
              <p
                id="customer-conversation-style-help"
                className="text-xs leading-5 text-muted-foreground"
              >
                Paste an existing script or describe your usual approach. We’ll
                review it with you and adapt it for text conversations.
              </p>
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="sms-restrictions"
                className="text-muted-foreground"
              >
                Anything RoofReply should avoid saying or promising?
              </Label>
              <Textarea
                id="sms-restrictions"
                className={fieldClassName}
                value={voiceRules.thingsNotToSay}
                onChange={(e) =>
                  setVoiceRules((prev) => ({
                    ...prev,
                    thingsNotToSay: e.target.value,
                  }))
                }
                placeholder="e.g., Don't promise specific prices, don't guarantee same-day service..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className={outlineButtonClassName}
              disabled={isSaving}
              onClick={() => setEditingSection(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleSave("voiceRules")}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />{" "}
                  Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editingSection === "businessInfo"}
        onOpenChange={(open) => {
          if (!open && !isSaving) setEditingSection(null);
        }}
      >
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            document.getElementById("account-edit")?.focus();
          }}
          aria-describedby={undefined}
          className="border-border bg-background text-foreground"
        >
          <DialogHeader>
            <DialogTitle>Edit business details</DialogTitle>
          </DialogHeader>
          <SaveNotice error={saveError} />
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="business-name" className="text-muted-foreground">
                Business name
              </Label>
              <Input
                id="business-name"
                className={fieldClassName}
                value={businessInfo.legalBusinessName}
                onChange={(e) =>
                  setBusinessInfo((prev) => ({
                    ...prev,
                    legalBusinessName: e.target.value,
                  }))
                }
                placeholder="ABC Roofing LLC"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="business-website"
                className="text-muted-foreground"
              >
                Website
              </Label>
              <Input
                id="business-website"
                type="url"
                className={fieldClassName}
                value={businessInfo.website}
                onChange={(e) =>
                  setBusinessInfo((prev) => ({
                    ...prev,
                    website: e.target.value,
                  }))
                }
                placeholder="https://www.yourcompany.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business-phone" className="text-muted-foreground">
                Business phone
              </Label>
              <Input
                id="business-phone"
                type="tel"
                className={fieldClassName}
                value={businessInfo.businessPhone}
                onChange={(e) =>
                  setBusinessInfo((prev) => ({
                    ...prev,
                    businessPhone: e.target.value,
                  }))
                }
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className={outlineButtonClassName}
              disabled={isSaving}
              onClick={() => setEditingSection(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleSave("businessInfo")}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />{" "}
                  Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
