import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "@/lib/providers";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildWebSiteJsonLd } from "@/lib/seo";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://truetwist.com";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "TrueTwist — AI-Powered Social Media Manager",
    template: "%s | TrueTwist",
  },
  description: "Generate, schedule, and publish content across 7+ social platforms with AI.",
  openGraph: {
    type: "website",
    siteName: "TrueTwist",
    title: "TrueTwist — AI-Powered Social Media Manager",
    description: "Generate, schedule, and publish content across 7+ social platforms with AI.",
  },
  twitter: {
    card: "summary_large_image",
    title: "TrueTwist — AI-Powered Social Media Manager",
    description: "Generate, schedule, and publish content across 7+ social platforms with AI.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <JsonLd data={buildWebSiteJsonLd(SITE_URL)} />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
