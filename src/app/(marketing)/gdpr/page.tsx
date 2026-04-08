import Link from "next/link";
import { Shield } from "lucide-react";

export const metadata = { title: "GDPR — TrueTwist" };

const rights = [
  {
    title: "Right of Access",
    description:
      "You can request a copy of all personal data we hold about you. We will provide this within 30 days.",
  },
  {
    title: "Right to Rectification",
    description:
      "You can request correction of any inaccurate or incomplete personal data we hold about you.",
  },
  {
    title: "Right to Erasure",
    description:
      'You can request deletion of your personal data. We will comply unless we have a legal obligation to retain it ("right to be forgotten").',
  },
  {
    title: "Right to Restrict Processing",
    description:
      "You can request that we limit how we use your data while a complaint or dispute is being resolved.",
  },
  {
    title: "Right to Data Portability",
    description:
      "You can request your data in a structured, machine-readable format to transfer to another service.",
  },
  {
    title: "Right to Object",
    description:
      "You can object to processing of your personal data for direct marketing or based on legitimate interests.",
  },
];

export default function GDPRPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-dark-bg">
      {/* Hero */}
      <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg gradient-brand flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
              GDPR Compliance
            </h1>
          </div>
          <p className="text-gray-600 dark:text-dark-muted leading-relaxed">
            TrueTwist is committed to compliance with the General Data
            Protection Regulation (GDPR). This page outlines how we protect the
            rights of individuals in the European Economic Area (EEA) and the
            United Kingdom.
          </p>
        </div>
      </div>

      {/* Data Processing */}
      <div className="py-12 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-dark-surface">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            How We Process Your Data
          </h2>
          <div className="space-y-4 text-sm text-gray-600 dark:text-dark-muted leading-relaxed">
            <p>
              <strong className="text-gray-900 dark:text-white">
                Legal Basis:
              </strong>{" "}
              We process personal data based on: (a) your consent, (b)
              performance of our contract with you, (c) compliance with legal
              obligations, and (d) our legitimate interests in providing and
              improving the platform.
            </p>
            <p>
              <strong className="text-gray-900 dark:text-white">
                Data Minimization:
              </strong>{" "}
              We only collect data that is necessary for the specific purpose it
              is intended for. We do not collect excessive or irrelevant data.
            </p>
            <p>
              <strong className="text-gray-900 dark:text-white">
                Data Location:
              </strong>{" "}
              Your data is primarily stored in secure, SOC 2-compliant data
              centers. When data is transferred outside the EEA, we ensure
              adequate safeguards are in place, including Standard Contractual
              Clauses (SCCs).
            </p>
            <p>
              <strong className="text-gray-900 dark:text-white">
                Sub-Processors:
              </strong>{" "}
              We use a limited number of sub-processors (Supabase for database
              and auth, Vercel for hosting, OpenAI for AI content generation).
              Each is bound by data processing agreements compliant with GDPR.
            </p>
          </div>
        </div>
      </div>

      {/* Your Rights */}
      <div className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">
            Your Rights Under GDPR
          </h2>
          <div className="grid gap-4">
            {rights.map((right) => (
              <div
                key={right.title}
                className="p-5 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface"
              >
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                  {right.title}
                </h3>
                <p className="text-sm text-gray-500 dark:text-dark-muted leading-relaxed">
                  {right.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Data Breach */}
      <div className="py-12 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-dark-surface">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Data Breach Notification
          </h2>
          <p className="text-sm text-gray-600 dark:text-dark-muted leading-relaxed">
            In the event of a personal data breach that poses a risk to your
            rights and freedoms, we will notify the relevant supervisory
            authority within 72 hours and affected individuals without undue
            delay, as required by GDPR Article 33 and 34.
          </p>
        </div>
      </div>

      {/* Contact DPO */}
      <div className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Contact Our Data Protection Team
          </h2>
          <p className="text-sm text-gray-600 dark:text-dark-muted leading-relaxed mb-4">
            To exercise any of your rights or ask questions about how we handle
            your data, contact our data protection team:
          </p>
          <a
            href="mailto:dpo@truetwist.com"
            className="inline-flex items-center px-6 py-3 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium transition-colors"
          >
            Contact DPO
          </a>

          {/* Back link */}
          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-dark-border">
            <Link
              href="/"
              className="text-brand-500 hover:text-brand-600 font-medium"
            >
              &larr; Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
