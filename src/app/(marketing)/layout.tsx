import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TrueTwist — AI-Powered Social Media Content That Goes Viral",
  description:
    "Generate, schedule, and publish scroll-stopping content across 7+ social platforms. Powered by AI that understands what makes content go viral.",
  openGraph: {
    title: "TrueTwist — AI-Powered Social Media Content That Goes Viral",
    description:
      "Generate, schedule, and publish scroll-stopping content across 7+ social platforms. Powered by AI that understands what makes content go viral.",
    type: "website",
    siteName: "TrueTwist",
  },
  twitter: {
    card: "summary_large_image",
    title: "TrueTwist — AI-Powered Social Media Content That Goes Viral",
    description:
      "Generate, schedule, and publish scroll-stopping content across 7+ social platforms.",
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
