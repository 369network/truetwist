import Link from "next/link";
import { Mail } from "lucide-react";

export const metadata = { title: "Careers — TrueTwist" };

const perks = [
  "Remote-first — work from anywhere",
  "Competitive equity packages",
  "Flexible hours & async culture",
  "Latest tools & hardware budget",
  "Learning & conference stipend",
  "Build something millions will use",
];

export default function CareersPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-dark-bg">
      {/* Hero */}
      <div className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-6">
            Join the <span className="text-brand-500">TrueTwist</span> team
          </h1>
          <p className="text-lg text-gray-600 dark:text-dark-muted max-w-2xl mx-auto leading-relaxed">
            We&apos;re building the future of AI-powered social media
            management. If you&apos;re passionate about AI, creator tools, and
            shipping great products — we want to hear from you.
          </p>
        </div>
      </div>

      {/* Perks */}
      <div className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-dark-surface">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 text-center">
            Why TrueTwist?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {perks.map((perk) => (
              <div
                key={perk}
                className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-bg"
              >
                <div className="w-2 h-2 rounded-full bg-brand-500 shrink-0" />
                <span className="text-sm text-gray-700 dark:text-dark-text">
                  {perk}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Open Roles */}
      <div className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Open Positions
          </h2>
          <p className="text-gray-500 dark:text-dark-muted mb-8 max-w-xl mx-auto">
            We don&apos;t have any open positions right now, but we&apos;re
            always looking for exceptional talent. Send us your resume and
            we&apos;ll keep you in mind.
          </p>
          <a
            href="mailto:careers@truetwist.com"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium transition-colors"
          >
            <Mail className="w-4 h-4" />
            Get in Touch
          </a>
        </div>
      </div>

      {/* Back link */}
      <div className="py-8 text-center border-t border-gray-200 dark:border-dark-border">
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
