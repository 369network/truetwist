import Link from "next/link";
import { Sparkles, Target, Users, Zap } from "lucide-react";

export const metadata = { title: "About — TrueTwist" };

const values = [
  {
    icon: Sparkles,
    title: "AI-First",
    description:
      "We believe AI should amplify human creativity, not replace it. Every feature is designed to save time while keeping your authentic voice.",
  },
  {
    icon: Target,
    title: "Results-Driven",
    description:
      "Vanity metrics don't pay the bills. We focus on the metrics that matter — engagement, conversions, and real business growth.",
  },
  {
    icon: Users,
    title: "Creator-Centric",
    description:
      "Built by creators, for creators. We understand the daily grind of content creation because we live it too.",
  },
  {
    icon: Zap,
    title: "Speed Matters",
    description:
      "Social media moves fast. Our platform is built for speed — from content generation to scheduling to analytics.",
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-dark-bg">
      {/* Hero */}
      <div className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-6">
            Social media management,{" "}
            <span className="text-brand-500">reimagined with AI</span>
          </h1>
          <p className="text-lg text-gray-600 dark:text-dark-muted max-w-2xl mx-auto leading-relaxed">
            TrueTwist is an AI-powered social media management platform that
            helps creators and brands produce scroll-stopping content, optimize
            ad spend, and grow their audience — all from one dashboard.
          </p>
        </div>
      </div>

      {/* Mission */}
      <div className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-dark-surface">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">
            Our Mission
          </h2>
          <p className="text-gray-600 dark:text-dark-muted text-center max-w-3xl mx-auto leading-relaxed">
            Managing social media shouldn&apos;t feel like a full-time job on
            top of your full-time job. We&apos;re building the tools that let
            you focus on what you do best — creating — while AI handles the
            strategy, scheduling, and optimization. Our goal is to make
            enterprise-grade social media intelligence accessible to everyone,
            from solo creators to growing brands.
          </p>
        </div>
      </div>

      {/* Values */}
      <div className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-12 text-center">
            What We Stand For
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            {values.map((value) => (
              <div
                key={value.title}
                className="p-6 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-bg"
              >
                <div className="w-10 h-10 rounded-lg gradient-brand flex items-center justify-center mb-4">
                  <value.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {value.title}
                </h3>
                <p className="text-sm text-gray-500 dark:text-dark-muted leading-relaxed">
                  {value.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-dark-surface">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Ready to transform your social media?
          </h2>
          <p className="text-gray-500 dark:text-dark-muted mb-8">
            Join the waitlist and be among the first to experience TrueTwist.
          </p>
          <Link
            href="/#waitlist"
            className="inline-flex items-center px-6 py-3 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium transition-colors"
          >
            Join the Waitlist
          </Link>
        </div>
      </div>

      {/* Back link */}
      <div className="py-8 text-center">
        <Link
          href="/"
          className="text-brand-500 hover:text-brand-600 font-medium"
        >
          &larr; Back to home
        </Link>
      </div>
    </div>
  );
}
