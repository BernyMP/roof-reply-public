"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { LEAD_HANDOFF_LABELS } from "@/lib/lead-handoff";

interface Step5ConfirmationProps {
  onBack: () => void;
  clerkId: string;
}

export function Step5Confirmation({ onBack, clerkId }: Step5ConfirmationProps) {
  const router = useRouter();
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provisionError, setProvisionError] = useState<string | null>(null);
  const completeOnboarding = useMutation(api.onboarding.completeOnboarding);
  const onboarding = useQuery(api.onboarding.getOnboarding, { clerkId });

  const handleComplete = async () => {
    setIsProvisioning(true);
    setProvisionError(null);

    try {
      // Complete onboarding
      await completeOnboarding({ clerkId });
      router.push("/dashboard");
    } catch (error) {
      setProvisionError(
        error instanceof Error ? error.message : "Could not save your setup",
      );
      setIsProvisioning(false);
    }
  };

  let leadDestinationLabel = "Not set";

  const hasPhone = Boolean(onboarding?.bookingDeliveryPhone);
  if (hasPhone) {
    leadDestinationLabel = "Texted to your phone";
  }

  const serviceAreaCount = onboarding?.serviceAreas?.length ?? 0;
  const preferredJobs = onboarding?.preferredJobTypes?.length ?? 0;
  const handoffLabel =
    LEAD_HANDOFF_LABELS[onboarding?.leadHandoffMode || "review_first"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex justify-center mb-4">
          <div className="rounded-full bg-accent p-4">
            <CheckCircle2 className="h-12 w-12 text-primary" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-foreground text-center">
          Your business setup is ready for review
        </h2>
        <p className="text-muted-foreground text-center max-w-xl mx-auto">
          Save your preferences and open your dashboard. Your operator will
          verify the number, messaging approval, and a live rehearsal before
          activating missed-call recovery.
        </p>
      </div>

      {/* Summary */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <h3 className="font-semibold text-foreground mb-3">
            Your setup summary:
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">
                Where recovered leads go:
              </span>
              <span className="text-foreground font-medium text-right">
                {leadDestinationLabel}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Lead handoff:</span>
              <span className="text-foreground font-medium text-right">
                {handoffLabel}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Service area:</span>
              <span className="text-foreground font-medium text-right">
                {serviceAreaCount} area
                {serviceAreaCount === 1 ? "" : "s"} configured
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Jobs to prioritize:</span>
              <span className="text-foreground font-medium text-right">
                {preferredJobs} job type
                {preferredJobs === 1 ? "" : "s"} selected
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Message */}
      {provisionError && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="p-4">
            <p className="text-sm text-destructive">{provisionError}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Please try again or contact support if the issue persists.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-between pt-6">
        <Button variant="outline" onClick={onBack} disabled={isProvisioning}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button
          onClick={handleComplete}
          size="lg"
          className="min-w-[200px]"
          disabled={isProvisioning}
        >
          {isProvisioning ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving your setup...
            </>
          ) : (
            "Finish & Go to Dashboard"
          )}
        </Button>
      </div>
    </div>
  );
}
