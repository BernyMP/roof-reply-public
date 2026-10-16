import { serviceSchema } from "@/lib/seo-schema";
import { jsonLd } from "@/lib/seo";
import { pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import { LandingPage } from "@/components/landing-page";
import { HOMEPAGE_DESCRIPTION } from "@/lib/marketing-copy";

export const metadata: Metadata = pageMetadata("/", "Missed Calls Shouldn’t Cost You Roofing Jobs", HOMEPAGE_DESCRIPTION, true);
export default function HomePage() {
  const homepageServiceSchema = Object.fromEntries(
    Object.entries(serviceSchema).filter(([key]) => key !== "offers"),
  );
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({ ...homepageServiceSchema, description: HOMEPAGE_DESCRIPTION }),
        }}
      />
      <LandingPage />
    </>
  );
}
