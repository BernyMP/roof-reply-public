import type { ReactNode } from "react";
import { ConvexAuthGate } from "@/components/convex-auth-gate";
import { ConvexProvider } from "@/components/convex-provider";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <ConvexProvider>
      <ConvexAuthGate>{children}</ConvexAuthGate>
    </ConvexProvider>
  );
}
