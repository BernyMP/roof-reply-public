"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Step3VoiceAndComplianceProps {
  onNext: () => void;
  onBack: () => void;
  clerkId: string;
}

export function Step3VoiceAndCompliance({
  onNext,
  onBack,
  clerkId,
}: Step3VoiceAndComplianceProps) {
  const onboarding = useQuery(api.onboarding.getOnboarding, { clerkId });
  const saveStep = useMutation(api.onboarding.saveOnboardingStep);

  // Section A: Voice & Tone
  const [aiTone, setAiTone] = useState<string>("");
  const [typicalCallDescription, setTypicalCallDescription] = useState("");
  const [callApproach, setCallApproach] = useState("");
  const [thingsNotToSay, setThingsNotToSay] = useState("");

  // Section B: Basic business info
  const [legalBusinessName, setLegalBusinessName] = useState("");
  const [website, setWebsite] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");

  useEffect(() => {
    if (onboarding) {
      setAiTone(onboarding.aiTone || "");
      setTypicalCallDescription(
        (onboarding as any).typicalCallDescription || "",
      );
      setCallApproach((onboarding as any).callApproach || "");
      setThingsNotToSay((onboarding as any).thingsNotToSay || "");
      setLegalBusinessName(onboarding.legalBusinessName || "");
      setWebsite(onboarding.website || "");
      setBusinessPhone(onboarding.businessPhone || "");
    }
  }, [onboarding]);

  const handleNext = async () => {
    const data: any = {
      aiTone: aiTone as any,
      typicalCallDescription,
      callApproach,
      collectPhotosFirst: false,
      legalBusinessName,
      website,
      businessPhone,
    };

    if (thingsNotToSay.trim()) {
      data.thingsNotToSay = thingsNotToSay.trim();
    }

    await saveStep({ clerkId, step: 3, data });
    onNext();
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-foreground">
          Voice, Rules &amp; Business Info
        </h2>
        <p className="text-muted-foreground">
          We&apos;ll shape RoofReply to sound like your team when it recovers a
          missed call — so homeowners feel taken care of even when you&apos;re
          on a roof or driving.
        </p>
      </div>

      {/* Section A: Voice & Tone */}
      <Card>
        <CardHeader>
          <CardTitle>Section A: How should RoofReply talk?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Tone */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Tone</Label>
            <p className="text-sm text-muted-foreground">
              Pick the style that best matches how you normally talk to
              homeowners when they call about leaks or storm damage.
            </p>
            <RadioGroup value={aiTone} onValueChange={setAiTone}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="professional" id="tone-professional" />
                <Label htmlFor="tone-professional">Professional</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="friendly" id="tone-friendly" />
                <Label htmlFor="tone-friendly">Friendly</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="straight_to_point" id="tone-straight" />
                <Label htmlFor="tone-straight">Direct / to the point</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="bilingual" id="tone-bilingual" />
                <Label htmlFor="tone-bilingual">
                  Bilingual (English / Spanish)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Typical inquiry */}
          <div className="space-y-2">
            <Label
              htmlFor="typicalCallDescription"
              className="text-base font-semibold"
            >
              What does a typical missed-call inquiry sound like?
            </Label>
            <p className="text-sm text-muted-foreground">
              Describe what homeowners usually say when they call or text about
              a leak or storm issue. This helps RoofReply recognize your
              real-world messages.
            </p>
            <Textarea
              id="typicalCallDescription"
              placeholder={`e.g., "Hey, I called earlier. We've got water coming through the ceiling when it rains and need someone out ASAP."`}
              value={typicalCallDescription}
              onChange={(e) => setTypicalCallDescription(e.target.value)}
              className="min-h-[100px]"
            />
          </div>

          {/* How you handle the lead */}
          <div className="space-y-2">
            <Label htmlFor="callApproach" className="text-base font-semibold">
              How do you normally handle those leads?
            </Label>
            <p className="text-sm text-muted-foreground">
              Share the main steps: what you say first, what you ask, and how
              you move them toward a booked job once you get back to them.
            </p>
            <Textarea
              id="callApproach"
              placeholder={`e.g., "I thank them for reaching out, ask where the leak is, how long it's been happening, then ask for the address, and talk about when we can come out."`}
              value={callApproach}
              onChange={(e) => setCallApproach(e.target.value)}
              className="min-h-[100px]"
            />
          </div>

          {/* Guardrails */}
          <div className="space-y-2">
            <Label htmlFor="thingsNotToSay" className="text-base font-semibold">
              Anything RoofReply should NOT say or promise?
            </Label>
            <p className="text-sm text-muted-foreground">
              Set simple rules — for example: no exact pricing over text, no
              same-day guarantees, no insurance promises, etc.
            </p>
            <Textarea
              id="thingsNotToSay"
              placeholder={`e.g., "Don't promise same-day service, don't quote exact prices, don't talk about insurance coverage or warranties."`}
              value={thingsNotToSay}
              onChange={(e) => setThingsNotToSay(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Section B: Light business info */}
      <Card>
        <CardHeader>
          <CardTitle>Section B: Basic business info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-accent rounded-lg p-4 border border-accent/20 mb-4">
            <p className="text-sm text-foreground">
              We use this to match your assistant&apos;s messages to your brand
              and support proper registration so your missed-call texts are less
              likely to be flagged as spam.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="legalBusinessName">
              Business name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="legalBusinessName"
              value={legalBusinessName}
              onChange={(e) => setLegalBusinessName(e.target.value)}
              placeholder="ABC Roofing LLC"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">Website (optional)</Label>
            <Input
              id="website"
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://yourroofingcompany.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="businessPhone">
              Main business phone number{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="businessPhone"
              type="tel"
              value={businessPhone}
              onChange={(e) => setBusinessPhone(e.target.value)}
              placeholder="(555) 123-4567"
            />
            <p className="text-sm text-muted-foreground">
              This is the number homeowners already call. RoofReply will use
              this as the reference for your missed-call recovery setup.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Footer actions */}
      <div className="flex justify-between pt-6">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button
          onClick={handleNext}
          disabled={
            !aiTone || !legalBusinessName.trim() || !businessPhone.trim()
          }
        >
          Continue
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
