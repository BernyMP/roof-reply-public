import type React from "react";
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Geist, Geist_Mono, Archivo, Public_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { MetaPixel } from "@/components/meta-pixel";
import "./globals.css";
import { SERVICE_TITLE, SERVICE_DESCRIPTION } from "@/lib/marketing-copy";
import { SITE_URL, jsonLd } from "@/lib/seo";
import { organizationSchema, websiteSchema } from "@/lib/seo-schema";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  preload: false,
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  preload: false,
});

// Dashboard brand fonts (Clean Cool design): Archivo display + Public Sans body
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
  variable: "--font-archivo",
  preload: false,
});

const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-public-sans",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `RoofReply | ${SERVICE_TITLE}`, template: "%s | RoofReply" },
  description: SERVICE_DESCRIPTION,
  authors: [{ name: "Web Shinobi LLC" }], creator: "RoofReply", publisher: "Web Shinobi LLC",
  robots: { index: false, follow: true },
  icons: { icon: { url: "/icon-svg.svg", type: "image/svg+xml" }, apple: "/apple-icon.png" },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
    other: process.env.BING_SITE_VERIFICATION
      ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION }
      : undefined,
  },
  category: "Business Services",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          {/* JSON-LD Structured Data */}
          <script
            type="application/ld+json"
            suppressHydrationWarning
            dangerouslySetInnerHTML={{
              __html: jsonLd([organizationSchema, websiteSchema]),
            }}
          />
        </head>
        <body
          className={`${geistSans.variable} ${geistMono.variable} ${archivo.variable} ${publicSans.variable} font-sans antialiased`}
        >
          {children}
          <Analytics />
          <MetaPixel />
        </body>
      </html>
    </ClerkProvider>
  );
}
