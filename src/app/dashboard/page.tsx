"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

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
      const { data: posts } = await supabase.from("posts").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5);
      setPosts(posts || []);
    }
    load();
  }, []);

  const stats = [
    { label: "Total Posts", value: posts.length || "0", change: "+12%", icon: "📝" },
    { label: "Scheduled", value: posts.filter(p => p.status === "scheduled").length || "0", change: "", icon: "📅" },
    { label: "Published", value: posts.filter(p => p.status === "published").length || "0", change: "+8%", icon: "🚀" },
    { label: "Engagement", value: "0", change: "New", icon: "❤️" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: "var(--tt-text-muted)" }}>Welcome back{profile?.full_name ? `, ${profile.full_name}` : ""}!</p>
        </div>
        <Link href="/dashboard/generate" className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition hover:-translate-y-0.5" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
          ✨ Generate Content
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s, i) => (
          <div key={i} className="p-5 rounded-2xl" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm" style={{ color: "var(--tt-text-muted)" }}>{s.label}</span>
              <span className="text-xl">{s.icon}</span>
            </div>
            <div className="text-3xl font-bold">{s.value}</div>
            {s.change && <div className="text-xs mt-1" style={{ color: "#10b981" }}>{s.change}</div>}
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="p-6 rounded-2xl" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
          <h3 className="font-semibold mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <Link href="/dashboard/generate" className="flex items-center gap-3 p-3 rounded-xl transition hover:translate-x-1" style={{ background: "var(--tt-surface-2)" }}>
              <span className="text-lg">✨</span>
              <div>
                <div className="text-sm font-medium">Generate AI Content</div>
                <div className="text-xs" style={{ color: "var(--tt-text-muted)" }}>Create posts with AI in seconds</div>
              </div>
            </Link>
            <Link href="/dashboard/calendar" className="flex items-center gap-3 p-3 rounded-xl transition hover:translate-x-1" style={{ background: "var(--tt-surface-2)" }}>
              <span className="text-lg">📅</span>
              <div>
                <div className="text-sm font-medium">Schedule Posts</div>
                <div className="text-xs" style={{ color: "var(--tt-text-muted)" }}>Plan your content calendar</div>
              </div>
            </Link>
            <Link href="/dashboard/settings" className="flex items-center gap-3 p-3 rounded-xl transition hover:translate-x-1" style={{ background: "var(--tt-surface-2)" }}>
              <span className="text-lg">🔗</span>
              <div>
                <div className="text-sm font-medium">Connect Accounts</div>
                <div className="text-xs" style={{ color: "var(--tt-text-muted)" }}>Link your social media profiles</div>
              </div>
            </Link>
          </div>
        </div>
        <div className="p-6 rounded-2xl" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
          <h3 className="font-semibold mb-4">Recent Posts</h3>
          {posts.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">🚀</div>
              <p className="text-sm" style={{ color: "var(--tt-text-muted)" }}>No posts yet. Generate your first content!</p>
              <Link href="/dashboard/generate" className="inline-block mt-3 px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc" }}>Get Started</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {posts.map(post => (
                <div key={post.id} className="p-3 rounded-xl" style={{ background: "var(--tt-surface-2)" }}>
                  <div className="text-sm line-clamp-2">{post.content}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${post.status === 'published' ? 'bg-green-500/15 text-green-400' : post.status === 'scheduled' ? 'bg-blue-500/15 text-blue-400' : 'bg-gray-500/15 text-gray-400'}`}>{post.status}</span>
                    {post.platforms?.map((p: string) => <span key={p} className="text-xs" style={{ color: "var(--tt-text-muted)" }}>{p}</span>)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
