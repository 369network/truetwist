import Link from "next/link";

export const metadata = { title: "Cookie Policy — TrueTwist" };

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-dark-bg flex items-center justify-center px-4">
      <div className="max-w-2xl text-center">
        <h1 className="text-3xl font-bold mb-4">Cookie Policy</h1>
        <p className="text-gray-500 dark:text-dark-muted mb-8">
          Our cookie policy is being finalized and will be published here soon.
        </p>
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
