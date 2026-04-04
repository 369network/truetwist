"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

/* ─── TRUA-15: Dashboard Home — Metrics Cards, Activity Feed, Quick Actions ─── */

const platformColors: Record<string, string> = {
  instagram: "#E4405F",
  twitter: "#1DA1F2",
  facebook: "#1877F2",
  linkedin: "#0A66C2",
  tiktok: "#ff0050",
};

export default function DashboardPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setProfile(p);
      const { data: postData } = await supabase.from("posts").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10);
      setPosts(postData || []);
    }
    load();
  }, []);

  const totalPosts = posts.length;
  const scheduled = posts.filter(p => p.status === "scheduled").length;
  const published = posts.filter(p => p.status === "published").length;
  const drafts = posts.filter(p => p.status === "draft").length;

  const metrics = [
    {
      label: "Posts Scheduled",
      value: scheduled.toString(),
      change: "+12%",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: "#6366f1",
      bg: "rgba(99,102,241,0.1)",
    },
    {
      label: "Engagement Rate",
      value: "4.8%",
      change: "+0.6%",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
        </svg>
      ),
      color: "#ff6b6b",
      bg: "rgba(255,107,107,0.1)",
    },
    {
      label: "Follower Growth",
      value: "+834",
      change: "+23%",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
        </svg>
      ),
      color: "#10b981",
      bg: "rgba(16,185,129,0.1)",
    },
    {
      label: "AI Credits Left",
      value: "3/5",
      change: "Free Plan",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
      ),
      color: "#a855f7",
      bg: "rgba(168,85,247,0.1)",
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
            Dashboard
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--tt-text-muted)" }}>
            Welcome back{profile?.full_name ? `, ${profile.full_name}` : ""}! Here&apos;s your content overview.
          </p>
        </div>
        <Link href="/dashboard/generate" className="btn-primary px-5 py-2.5 text-sm hidden sm:flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Generate Content
        </Link>
      </div>

      {/* Metrics Cards (TRUA-15) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {metrics.map((m, i) => (
          <div
            key={i}
            className="p-5 rounded-2xl transition-all hover:-translate-y-0.5"
            style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm" style={{ color: "var(--tt-text-muted)" }}>{m.label}</span>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: m.bg, color: m.color }}>
                {m.icon}
              </div>
            </div>
            <div className="text-3xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>{m.value}</div>
            <div className="text-xs mt-1 font-medium" style={{ color: "#10b981" }}>{m.change}</div>
          </div>
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Quick Actions */}
        <div className="p-6 rounded-2xl" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
          <h3 className="font-semibold mb-4" style={{ fontFamily: "var(--font-heading)" }}>Quick Actions</h3>
          <div className="space-y-3">
            {[
              { href: "/dashboard/generate", icon: "sparkles", label: "Generate AI Content", desc: "Create posts with AI in seconds", color: "#6366f1" },
              { href: "/dashboard/calendar", icon: "calendar", label: "Schedule Posts", desc: "Plan your content calendar", color: "#a855f7" },
              { href: "/dashboard/trends", icon: "fire", label: "View Trends", desc: "Discover viral opportunities", color: "#ff6b6b" },
              { href: "/dashboard/settings", icon: "link", label: "Connect Accounts", desc: "Link your social profiles", color: "#10b981" },
            ].map((action, i) => (
              <Link
                key={i}
                href={action.href}
                className="flex items-center gap-3 p-3 rounded-xl transition-all hover:translate-x-1"
                style={{ background: "var(--tt-surface-2)" }}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${action.color}15`, color: action.color }}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-medium">{action.label}</div>
                  <div className="text-xs" style={{ color: "var(--tt-text-muted)" }}>{action.desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Posts */}
        <div className="lg:col-span-2 p-6 rounded-2xl" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold" style={{ fontFamily: "var(--font-heading)" }}>Recent Posts</h3>
            <Link href="/dashboard/posts" className="text-xs font-medium" style={{ color: "#a5b4fc" }}>View All</Link>
          </div>
          {posts.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ background: "rgba(99,102,241,0.1)" }}>
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="#6366f1" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </div>
              <h4 className="font-semibold mb-1">No posts yet</h4>
              <p className="text-sm mb-4" style={{ color: "var(--tt-text-muted)" }}>Generate your first AI-powered content!</p>
              <Link href="/dashboard/generate" className="btn-primary px-5 py-2.5 text-sm inline-block">Get Started</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {posts.slice(0, 5).map(post => (
                <div key={post.id} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: "var(--tt-surface-2)" }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm line-clamp-2 mb-2">{post.content}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        post.status === "published" ? "bg-green-500/15 text-green-400" :
                        post.status === "scheduled" ? "bg-blue-500/15 text-blue-400" :
                        "bg-gray-500/15 text-gray-400"
                      }`}>
                        {post.status}
                      </span>
                      {post.platforms?.map((p: string) => (
                        <span key={p} className="w-2 h-2 rounded-full" style={{ background: platformColors[p] || "#666" }} />
                      ))}
                      <span className="text-xs" style={{ color: "var(--tt-text-muted)" }}>
                        {new Date(post.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Platform Performance Overview */}
      <div className="p-6 rounded-2xl" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold" style={{ fontFamily: "var(--font-heading)" }}>Platform Overview</h3>
          <Link href="/dashboard/analytics" className="text-xs font-medium" style={{ color: "#a5b4fc" }}>View Analytics</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { name: "Instagram", followers: "2.4K", color: "#E4405F" },
            { name: "X (Twitter)", followers: "1.8K", color: "#1DA1F2" },
            { name: "Facebook", followers: "1.1K", color: "#1877F2" },
            { name: "LinkedIn", followers: "956", color: "#0A66C2" },
            { name: "TikTok", followers: "5.2K", color: "#ff0050" },
          ].map((p, i) => (
            <div key={i} className="text-center p-4 rounded-xl" style={{ background: "var(--tt-surface-2)" }}>
              <div className="w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center" style={{ background: `${p.color}15` }}>
                <div className="w-3 h-3 rounded-full" style={{ background: p.color }} />
              </div>
              <div className="text-sm font-medium">{p.name}</div>
              <div className="text-lg font-bold mt-1" style={{ fontFamily: "var(--font-heading)", color: p.color }}>
                {p.followers}
              </div>
              <div className="text-xs" style={{ color: "var(--tt-text-muted)" }}>followers</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
