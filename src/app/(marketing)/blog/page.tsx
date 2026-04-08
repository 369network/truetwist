import Link from "next/link";

export const metadata = { title: "Blog — TrueTwist" };

const posts = [
  {
    title: "Why AI Is the Future of Social Media Management",
    excerpt:
      "Discover how AI-powered tools are transforming the way creators and brands manage their social presence — from content creation to audience analytics.",
    date: "April 2026",
    category: "AI & Strategy",
    readTime: "5 min read",
  },
  {
    title: "5 Tips to Boost Your Instagram Engagement in 2026",
    excerpt:
      "Engagement rates dropping? These proven strategies will help you reconnect with your audience and get your content seen by more people.",
    date: "April 2026",
    category: "Social Media Tips",
    readTime: "4 min read",
  },
  {
    title: "Understanding ROAS: A Guide for Social Media Advertisers",
    excerpt:
      "Return on ad spend is the metric that matters most. Learn how to measure, optimize, and scale your paid social campaigns effectively.",
    date: "April 2026",
    category: "Advertising",
    readTime: "6 min read",
  },
  {
    title: "The Creator Economy in 2026: Trends & Opportunities",
    excerpt:
      "The creator economy is booming. Here's what's changing, where the opportunities are, and how to position yourself for success.",
    date: "March 2026",
    category: "Industry Trends",
    readTime: "7 min read",
  },
];

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-dark-bg">
      {/* Hero */}
      <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            The TrueTwist <span className="text-brand-500">Blog</span>
          </h1>
          <p className="text-lg text-gray-600 dark:text-dark-muted max-w-2xl mx-auto">
            Insights on AI-powered content creation, social media strategy, and
            growing your audience.
          </p>
        </div>
      </div>

      {/* Posts */}
      <div className="pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto grid gap-8">
          {posts.map((post) => (
            <article
              key={post.title}
              className="p-6 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface hover:border-brand-300 dark:hover:border-brand-500/30 transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400">
                  {post.category}
                </span>
                <span className="text-xs text-gray-400 dark:text-dark-muted">
                  {post.date}
                </span>
                <span className="text-xs text-gray-400 dark:text-dark-muted">
                  {post.readTime}
                </span>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {post.title}
              </h2>
              <p className="text-gray-500 dark:text-dark-muted text-sm leading-relaxed">
                {post.excerpt}
              </p>
            </article>
          ))}
        </div>

        <div className="max-w-4xl mx-auto mt-12 text-center">
          <p className="text-gray-400 dark:text-dark-muted text-sm">
            More articles coming soon. Stay tuned!
          </p>
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
