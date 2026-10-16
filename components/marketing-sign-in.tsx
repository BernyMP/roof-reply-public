"use client";

import Link from "next/link";
import { SignInButton, useUser } from "@clerk/nextjs";

export function MarketingSignIn() {
  const { isSignedIn } = useUser();
  if (isSignedIn) return <Link href="/dashboard">Dashboard</Link>;
  return (
    <SignInButton mode="modal" forceRedirectUrl="/dashboard">
      <button type="button" className="rr-marketing-login">Log in</button>
    </SignInButton>
  );
}
