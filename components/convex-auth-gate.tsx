"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SignOutButton, useUser } from "@clerk/nextjs";
import { useConvexAuth } from "convex/react";

type ConvexAuthGateProps = {
  children: ReactNode;
};

function LoadingState() {
  return (
    <div className="rr-app flex items-center justify-center">
      <div role="status" className="text-center text-muted-foreground">
        Opening your workspace…
      </div>
    </div>
  );
}

function SessionErrorState() {
  return (
    <div className="rr-app px-4 py-16">
      <div className="rr-app-card mx-auto max-w-md p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Session unavailable
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          We could not verify your dashboard session.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Please sign out and sign back in. If this keeps happening, contact
          Berny for help.
        </p>
        <SignOutButton redirectUrl="/">
          <button className="mt-5 min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Sign out
          </button>
        </SignOutButton>
        <a
          className="rr-text-link ml-4 text-sm"
          href="mailto:hello@example.com"
        >
          Contact Berny
        </a>
      </div>
    </div>
  );
}

export function ConvexAuthGate({ children }: ConvexAuthGateProps) {
  const { user, isLoaded } = useUser();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && !user) {
      router.replace("/sign-in");
    }
  }, [isLoaded, router, user]);

  if (!isLoaded || !user || isLoading) {
    return <LoadingState />;
  }

  if (!isAuthenticated) {
    return <SessionErrorState />;
  }

  return <>{children}</>;
}
