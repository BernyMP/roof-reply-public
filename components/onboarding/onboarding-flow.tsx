"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { GuidedSetupForm } from "./guided-setup-form";
import { DashboardLoading } from "@/components/dashboard/dashboard-loading";
import { Button } from "@/components/ui/button";
import {
  ACCOUNT_SMS_CONSENT_TEXT,
  ACCOUNT_SMS_CONSENT_VERSION,
} from "@/lib/account-sms-consent";
import { guidedSetupDefaults } from "@/lib/guided-onboarding";

export function OnboardingFlow({
  clerkId,
  email,
  firstName,
}: {
  clerkId: string;
  email: string;
  firstName?: string;
}) {
  const router = useRouter();
  const getOrCreateUser = useMutation(api.users.getOrCreateUser);
  const saveStep = useMutation(api.onboarding.saveOnboardingStep);
  const complete = useMutation(api.onboarding.completeOnboarding);
  const account = useQuery(api.onboarding.getOnboarding, { clerkId });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError(false);
    getOrCreateUser({ clerkId, email, name: firstName })
      .then(() => {
        if (active) setReady(true);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [clerkId, email, firstName, getOrCreateUser, attempt]);
  return (
    <div className="rr-app rr-onboarding">
      <header className="rr-setup-header">
        <Link href="/" className="font-semibold text-lg tracking-tight">
          RoofReply
        </Link>
        <div className="flex items-center gap-5">
          <a href="mailto:hello@example.com" className="rr-text-link text-sm">
            Contact Berny
          </a>
          <UserButton />
        </div>
      </header>
      <main className="rr-setup-wrap">
        {error ? (
          <div className="rr-app-card p-6" role="alert">
            <p>We couldn’t open your setup. Please try again.</p>
            <Button className="mt-4" onClick={() => setAttempt(attempt + 1)}>
              Try again
            </Button>
          </div>
        ) : !ready || account === undefined ? (
          <DashboardLoading label="Opening your setup" />
        ) : (
          <GuidedSetupForm
            initial={account || {}}
            email={email}
            firstName={firstName}
            onSaveBusiness={async (data) => {
              await saveStep({
                clerkId,
                // Legacy step 2 also resumes at alert details if this UI is rolled back.
                step: 2,
                data: { ...data, ...guidedSetupDefaults(account || {}) },
              });
            }}
            onSubmit={async (phone, contactPreference) => {
              await saveStep({
                clerkId,
                step: 5,
                data: {
                  bookingDeliveryMethod: "phone",
                  bookingDeliveryPhone: phone,
                  accountSmsConsentGranted: true,
                  accountSmsConsentText: ACCOUNT_SMS_CONSENT_TEXT,
                  accountSmsConsentVersion: ACCOUNT_SMS_CONSENT_VERSION,
                  ...guidedSetupDefaults(account || {}),
                },
              });
              await complete({ clerkId, contactPreference });
              try {
                sessionStorage.setItem("roofreply-enrollment-welcome", clerkId);
              } catch {
                /* Setup is saved even if browser storage is unavailable. */
              }
              router.replace("/dashboard");
            }}
          />
        )}
      </main>
    </div>
  );
}
