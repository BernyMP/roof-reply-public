import { breadcrumbSchema } from "@/lib/seo-schema";
import { jsonLd, SITE_URL, pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
export const metadata: Metadata = pageMetadata(
  "/calculator",
  "Revenue Recovery Assessment",
  "Estimate monthly and annual missed-call revenue potential, account for current follow-up, and download a personalized two-page assessment.",
  true,
);
const calculatorSchema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Revenue Recovery Assessment",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "A free revenue calculator with a personalized two-page report on missed-call opportunity and managed roofing follow-up.",
  url: `${SITE_URL}/calculator`,
  provider: { "@id": `${SITE_URL}/#organization` },
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Estimate monthly and annual recoverable revenue potential",
    "Account for inquiries already reached by your team",
    "Review inputs, assumptions and modeled job equivalents",
    "Understand the managed follow-up and team handoff",
    "Download a personalized two-page assessment",
  ],
};
export default function CalculatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: jsonLd([
            calculatorSchema,
            breadcrumbSchema("/calculator", "Revenue Recovery Assessment"),
          ]),
        }}
      />
      {children}
    </>
  );
}
