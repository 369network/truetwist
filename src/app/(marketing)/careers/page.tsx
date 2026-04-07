import Link from "next/link";

export const metadata = { title: "Careers — TrueTwist" };

export default function CareersPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-dark-bg flex items-center justify-center px-4">
      <div className="max-w-2xl text-center">
        <h1 className="text-3xl font-bold mb-4">Careers</h1>
        <p className="text-gray-500 dark:text-dark-muted mb-8">
          We&apos;re not hiring right now, but check back soon for open
          positions.
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
