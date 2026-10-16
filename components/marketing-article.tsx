import type { ReactNode } from "react";
import Link from "next/link";
import { MarketingHeader, MarketingFooter, DemoBookingLink } from "./marketing-shell";
import { breadcrumbSchema } from "@/lib/seo-schema";
import { jsonLd } from "@/lib/seo";

export function MarketingArticle({ path, title, intro, children }: { path: string; title: string; intro: string; children: ReactNode }) {
  return <div className="rr-site">
    <MarketingHeader />
    <main className="rr-site-wrap rr-seo-article">
      <nav aria-label="Breadcrumb" className="rr-seo-breadcrumb"><Link href="/">Home</Link><span aria-hidden="true"> / </span><span aria-current="page">{title}</span></nav>
      <header><p className="rr-eyebrow">For residential roofing businesses</p><h1>{title}</h1><p className="rr-seo-intro">{intro}</p></header>
      {children}
      <section className="rr-seo-cta"><h2>Start with your missed calls.</h2><p>Bring your service area, an estimate of missed and after-hours calls, and your current follow-up process. We’ll discuss fit and a controlled starting point.</p><DemoBookingLink /></section>
    </main>
    <MarketingFooter />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbSchema(path, title)) }} />
  </div>;
}
