"use client";

import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

interface Step0WelcomeProps {
  onNext: () => void;
}

export function Step0Welcome({ onNext }: Step0WelcomeProps) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="rounded-full bg-accent p-4">
            <CheckCircle2 className="h-12 w-12 text-primary" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-foreground">
          Welcome to RoofReply
        </h1>

        <p className="text-base text-muted-foreground max-w-xl mx-auto">
          Tell us about your roofing business, service area, and lead delivery
          preferences. Your operator will review the setup and verify live
          messaging before activation.
        </p>
      </div>

      <div className="flex justify-center pt-6">
        <Button onClick={onNext} size="lg" className="min-w-[200px]">
          Get started
        </Button>
      </div>
    </div>
  );
}
