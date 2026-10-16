import { pageMetadata, jsonLd } from "@/lib/seo";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SpecialOfferPilotPage } from "@/components/special-offer-pilot-page";
import {
  getSpecialOffer,
  getSpecialOfferSlugs,
} from "@/lib/special-offers";

type SpecialOfferPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return getSpecialOfferSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: SpecialOfferPageProps): Promise<Metadata> {
  const { slug } = await params;
  const offer = getSpecialOffer(slug);

  if (!offer) {
    notFound();
  }

  return pageMetadata(`/specials/${offer.slug}`, offer.metadata.title.replace(/ \| RoofReply$/, ""), offer.metadata.description, offer.indexable);
}

export default async function SpecialOfferPage({
  params,
}: SpecialOfferPageProps) {
  const { slug } = await params;
  const offer = getSpecialOffer(slug);

  if (!offer) {
    notFound();
  }

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: offer.faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: jsonLd(faqSchema),
        }}
      />
      <SpecialOfferPilotPage offer={offer} />
    </>
  );
}
