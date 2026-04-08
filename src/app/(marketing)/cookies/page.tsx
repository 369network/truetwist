import Link from "next/link";

export const metadata = { title: "Cookie Policy — TrueTwist" };

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-dark-bg">
      <div className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Cookie Policy
          </h1>
          <p className="text-sm text-gray-400 dark:text-dark-muted mb-12">
            Last updated: April 8, 2026
          </p>

          <div className="prose prose-gray dark:prose-invert max-w-none space-y-8 text-gray-600 dark:text-dark-muted text-sm leading-relaxed">
            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                1. What Are Cookies
              </h2>
              <p>
                Cookies are small text files stored on your device when you
                visit a website. They help the website remember your preferences
                and improve your browsing experience. TrueTwist uses cookies and
                similar technologies to provide, protect, and improve our
                platform.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                2. Types of Cookies We Use
              </h2>
              <div className="space-y-4">
                <div className="p-4 rounded-lg border border-gray-200 dark:border-dark-border">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                    Essential Cookies
                  </h3>
                  <p>
                    Required for the platform to function. These handle
                    authentication, session management, and security. They
                    cannot be disabled.
                  </p>
                </div>
                <div className="p-4 rounded-lg border border-gray-200 dark:border-dark-border">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                    Analytics Cookies
                  </h3>
                  <p>
                    Help us understand how visitors interact with the platform
                    so we can improve the user experience. These collect
                    anonymous usage data.
                  </p>
                </div>
                <div className="p-4 rounded-lg border border-gray-200 dark:border-dark-border">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                    Functional Cookies
                  </h3>
                  <p>
                    Remember your preferences such as language, theme (dark/light
                    mode), and display settings to provide a personalized
                    experience.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                3. Third-Party Cookies
              </h2>
              <p>
                We use third-party services that may set their own cookies,
                including:
              </p>
              <ul className="list-disc pl-5 space-y-2 mt-3">
                <li>
                  <strong>Supabase:</strong> Authentication and session
                  management.
                </li>
                <li>
                  <strong>Vercel Analytics:</strong> Anonymous performance and
                  usage metrics.
                </li>
              </ul>
              <p className="mt-3">
                We do not use advertising or tracking cookies from ad networks.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                4. Managing Cookies
              </h2>
              <p>
                You can control cookies through your browser settings. Most
                browsers allow you to block or delete cookies. However,
                disabling essential cookies may prevent parts of the platform
                from functioning correctly.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                5. Updates to This Policy
              </h2>
              <p>
                We may update this Cookie Policy from time to time. Changes will
                be posted on this page with an updated revision date.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                6. Contact
              </h2>
              <p>
                Questions about our use of cookies? Contact us at{" "}
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
