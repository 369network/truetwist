import Link from "next/link";

const features = [
  { icon: "🤖", title: "AI Content Generation", desc: "Generate scroll-stopping posts for any platform in seconds using advanced AI models." },
  { icon: "📅", title: "Smart Scheduling", desc: "Auto-schedule posts at peak engagement times across all your social accounts." },
  { icon: "📊", title: "Analytics Dashboard", desc: "Track performance, engagement rates, and growth across all platforms in one view." },
  { icon: "🎯", title: "Viral Suggestions", desc: "AI analyzes trending topics and suggests content ideas that are likely to go viral." },
  { icon: "🔗", title: "Multi-Platform", desc: "Connect Instagram, X, Facebook, LinkedIn, and TikTok — post everywhere at once." },
  { icon: "✨", title: "Content Templates", desc: "Use pre-built templates or create your own for consistent brand messaging." },
];

const platforms = ["Instagram", "X (Twitter)", "Facebook", "LinkedIn", "TikTok"];

export default function Home() {
  return (
    <div className="min-h-screen" style={{ background: "var(--tt-bg)" }}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 md:px-12 py-5 glass sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold" style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}>T</div>
          <span className="text-xl font-bold">TrueTwist</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm" style={{ color: "var(--tt-text-muted)" }}>
          <a href="#features" className="hover:text-white transition">Features</a>
          <a href="#platforms" className="hover:text-white transition">Platforms</a>
          <a href="#pricing" className="hover:text-white transition">Pricing</a>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/auth/login" className="text-sm font-medium hover:text-white transition" style={{ color: "var(--tt-text-muted)" }}>Log in</Link>
          <Link href="/auth/signup" className="text-sm font-semibold px-5 py-2.5 rounded-xl text-white transition hover:-translate-y-0.5" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>Start Free</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 md:px-12 pt-20 pb-32 text-center max-w-5xl mx-auto">
        <div className="inline-block px-4 py-1.5 rounded-full text-xs font-medium mb-6" style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.3)" }}>
          Powered by AI — 10x Your Social Media
        </div>
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold leading-tight mb-6">
          Create <span className="gradient-text">Viral Content</span><br />
          in Seconds, Not Hours
        </h1>
        <p className="text-lg md:text-xl max-w-2xl mx-auto mb-10" style={{ color: "var(--tt-text-muted)" }}>
          TrueTwist uses AI to generate, schedule, and post social media content that actually engages. Stop guessing, start growing.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/auth/signup" className="px-8 py-4 rounded-xl text-white font-semibold text-lg transition hover:-translate-y-1" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 8px 30px rgba(99,102,241,0.35)" }}>
            Get Started Free
          </Link>
          <Link href="#features" className="px-8 py-4 rounded-xl font-semibold text-lg transition hover:-translate-y-1" style={{ border: "1px solid var(--tt-border)", color: "var(--tt-text)" }}>
            See How It Works
          </Link>
        </div>
        <div className="mt-12 flex items-center justify-center gap-6 flex-wrap" style={{ color: "var(--tt-text-muted)" }}>
          {platforms.map(p => (
            <span key={p} className="text-sm px-3 py-1 rounded-full" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>{p}</span>
          ))}
        </div>
      </section>

      {/* Dashboard Preview */}
      <section className="px-6 md:px-12 pb-24 max-w-6xl mx-auto">
        <div className="rounded-2xl overflow-hidden glow" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
          <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: "1px solid var(--tt-border)" }}>
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="ml-3 text-xs" style={{ color: "var(--tt-text-muted)" }}>TrueTwist Dashboard</span>
          </div>
          <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl" style={{ background: "var(--tt-surface-2)" }}>
              <div className="text-xs mb-2" style={{ color: "var(--tt-text-muted)" }}>Posts This Week</div>
              <div className="text-3xl font-bold gradient-text">47</div>
              <div className="text-xs mt-1" style={{ color: "#10b981" }}>+23% vs last week</div>
            </div>
            <div className="p-4 rounded-xl" style={{ background: "var(--tt-surface-2)" }}>
              <div className="text-xs mb-2" style={{ color: "var(--tt-text-muted)" }}>Total Engagement</div>
              <div className="text-3xl font-bold gradient-text">12.4K</div>
              <div className="text-xs mt-1" style={{ color: "#10b981" }}>+45% vs last week</div>
            </div>
            <div className="p-4 rounded-xl" style={{ background: "var(--tt-surface-2)" }}>
              <div className="text-xs mb-2" style={{ color: "var(--tt-text-muted)" }}>Followers Gained</div>
              <div className="text-3xl font-bold gradient-text">834</div>
              <div className="text-xs mt-1" style={{ color: "#10b981" }}>+12% vs last week</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-6 md:px-12 py-24 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything You Need to <span className="gradient-text">Go Viral</span></h2>
          <p style={{ color: "var(--tt-text-muted)" }}>Powerful AI tools to create, schedule, and analyze your social media content.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div key={i} className="p-6 rounded-2xl transition hover:-translate-y-1" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-sm" style={{ color: "var(--tt-text-muted)" }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-6 md:px-12 py-24 max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple, <span className="gradient-text">Transparent</span> Pricing</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { name: "Free", price: "$0", desc: "Get started", features: ["5 AI posts/month", "1 social account", "Basic templates", "Manual posting"] },
            { name: "Pro", price: "$19", desc: "For creators", features: ["Unlimited AI posts", "5 social accounts", "All templates", "Auto-scheduling", "Analytics dashboard", "Priority support"], popular: true },
            { name: "Business", price: "$49", desc: "For teams", features: ["Everything in Pro", "Unlimited accounts", "Team collaboration", "Custom AI training", "API access", "Dedicated support"] },
          ].map((p, i) => (
            <div key={i} className={`p-8 rounded-2xl relative ${p.popular ? "glow" : ""}`} style={{ background: "var(--tt-surface)", border: p.popular ? "2px solid #6366f1" : "1px solid var(--tt-border)" }}>
              {p.popular && <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-medium text-white" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>Most Popular</div>}
              <h3 className="text-xl font-bold">{p.name}</h3>
              <p className="text-sm mt-1 mb-4" style={{ color: "var(--tt-text-muted)" }}>{p.desc}</p>
              <div className="text-4xl font-extrabold mb-1">{p.price}<span className="text-sm font-normal" style={{ color: "var(--tt-text-muted)" }}>/mo</span></div>
              <ul className="mt-6 space-y-3">
                {p.features.map((f, j) => (
                  <li key={j} className="flex items-center gap-2 text-sm">
                    <span style={{ color: "#10b981" }}>✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link href="/auth/signup" className="block text-center mt-8 py-3 rounded-xl font-semibold text-sm transition hover:-translate-y-0.5" style={{ background: p.popular ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "var(--tt-surface-2)", color: "white", border: p.popular ? "none" : "1px solid var(--tt-border)" }}>
                Get Started
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 md:px-12 py-12 text-center text-sm" style={{ color: "var(--tt-text-muted)", borderTop: "1px solid var(--tt-border)" }}>
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}>T</div>
          <span className="font-semibold text-white">TrueTwist</span>
        </div>
        <p>AI-Powered Social Media Content Creation Platform</p>
        <p className="mt-2">&copy; 2026 TrueTwist. All rights reserved.</p>
      </footer>
    </div>
  );
}
