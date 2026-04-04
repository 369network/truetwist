import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  title: "TrueTwist - AI-Powered Social Media Content Platform",
  description: "Create viral social media content with AI. Generate, schedule, and post across Instagram, X, Facebook, LinkedIn, and TikTok in seconds.",
  keywords: ["social media", "AI content", "content generation", "scheduling", "analytics", "TrueTwist"],
  openGraph: {
    title: "TrueTwist - AI-Powered Social Media Content Platform",
    description: "Create viral social media content with AI. Generate, schedule, and post across all platforms.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body className={`${geist.variable} antialiased`}>{children}</body>
    </html>
  );
}
