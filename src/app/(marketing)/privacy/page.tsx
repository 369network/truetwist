import Link from "next/link";

export const metadata = { title: "Privacy Policy — TrueTwist" };

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-dark-bg">
      <div className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Privacy Policy
          </h1>
          <p className="text-sm text-gray-400 dark:text-dark-muted mb-12">
            Last updated: April 8, 2026
          </p>

          <div className="prose prose-gray dark:prose-invert max-w-none space-y-8 text-gray-600 dark:text-dark-muted text-sm leading-relaxed">
            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                1. Introduction
              </h2>
              <p>
                TrueTwist (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;)
                respects your privacy and is committed to protecting your
                personal data. This Privacy Policy explains how we collect, use,
                disclose, and safeguard your information when you use our
                AI-powered social media management platform and related services.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                2. Information We Collect
              </h2>
              <p className="mb-3">We may collect the following types of information:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Account Information:</strong> Name, email address, and
                  password when you create an account.
                </li>
                <li>
                  <strong>Social Media Data:</strong> When you connect social
                  media accounts, we access profile information, posts, and
                  analytics data as authorized by you through the platform&apos;s
                  OAuth permissions.
                </li>
                <li>
                  <strong>Usage Data:</strong> Information about how you interact
                  with our platform, including pages visited, features used, and
                  session duration.
                </li>
                <li>
                  <strong>Payment Information:</strong> Billing details processed
                  securely through our third-party payment provider.
                </li>
                <li>
                  <strong>AI-Generated Content:</strong> Content you create or
                  generate using our AI tools, including prompts and outputs.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                3. How We Use Your Information
              </h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>Provide, maintain, and improve our platform</li>
                <li>Generate AI-powered content and recommendations</li>
                <li>Process transactions and manage your account</li>
                <li>
                  Send service-related communications and marketing (with your
                  consent)
                </li>
                <li>Analyze usage patterns to enhance user experience</li>
                <li>Ensure platform security and prevent fraud</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                4. Data Sharing
              </h2>
              <p>
                We do not sell your personal data. We may share information with:
              </p>
              <ul className="list-disc pl-5 space-y-2 mt-3">
                <li>
                  <strong>Service Providers:</strong> Third-party services that
                  help us operate the platform (hosting, analytics, payment
                  processing).
                </li>
                <li>
                  <strong>Social Media Platforms:</strong> When you authorize us
                  to post content or retrieve analytics on your behalf.
                </li>
                <li>
                  <strong>Legal Requirements:</strong> When required by law,
                  regulation, or legal process.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                5. Data Security
              </h2>
              <p>
                We implement industry-standard security measures including
                encryption in transit (TLS) and at rest, secure authentication,
                and regular security audits. While we strive to protect your
                data, no method of electronic transmission or storage is 100%
                secure.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                6. Data Retention
              </h2>
              <p>
                We retain your personal data only for as long as necessary to
                provide our services and fulfill the purposes described in this
                policy. When you delete your account, we will delete or
                anonymize your data within 30 days, except where retention is
                required by law.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                7. Your Rights
              </h2>
              <p>Depending on your location, you may have the right to:</p>
              <ul className="list-disc pl-5 space-y-2 mt-3">
                <li>Access, correct, or delete your personal data</li>
                <li>Object to or restrict processing of your data</li>
                <li>Data portability</li>
                <li>Withdraw consent at any time</li>
              </ul>
              <p className="mt-3">
                To exercise any of these rights, contact us at{" "}
                <a
                  href="mailto:privacy@truetwist.com"
                  className="text-brand-500 hover:text-brand-600"
                >
                  privacy@truetwist.com
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                8. Contact Us
              </h2>
              <p>
                If you have questions about this Privacy Policy, contact us at{" "}
                <a
                  href="mailto:privacy@truetwist.com"
                  className="text-brand-500 hover:text-brand-600"
                >
                  privacy@truetwist.com
                </a>
                .
              </p>
            </section>
          </div>

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
