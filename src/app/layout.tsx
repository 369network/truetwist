import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  title: "TrueTwist - AI-Powered Social Media Content",
  description: "Create viral social media content with AI. Auto-generate, schedule, and post across all platforms.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${geist.variable} antialiased`}>{children}</body>
    </html>
  );
}
