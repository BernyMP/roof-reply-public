"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const hasCompleted = useQuery(
    api.users.hasCompletedOnboarding,
    user?.id ? { clerkId: user.id } : "skip",
  );

  useEffect(() => {
    if (isLoaded && !user) {
      router.push("/");
    }
    if (isLoaded && user && hasCompleted === true) {
      router.push("/dashboard");
    }
  }, [isLoaded, user, hasCompleted, router]);

  if (
    !isLoaded ||
    !user ||
    hasCompleted === undefined ||
    hasCompleted === true
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <OnboardingFlow
        clerkId={user.id}
        email={user.primaryEmailAddress?.emailAddress || ""}
        firstName={user.firstName || undefined}
      />
    </div>
  );
}
