"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

export default function PostsPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("posts").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      setPosts(data || []);
    }
    load();
  }, []);

  const filtered = filter === "all" ? posts : posts.filter(p => p.status === filter);
  const statusColors: Record<string, string> = { draft: "bg-gray-500/15 text-gray-400", scheduled: "bg-blue-500/15 text-blue-400", published: "bg-green-500/15 text-green-400", failed: "bg-red-500/15 text-red-400" };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Your Posts</h1>
          <p className="text-sm mt-1" style={{ color: "var(--tt-text-muted)" }}>{posts.length} total posts</p>
        </div>
        <Link href="/dashboard/generate" className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition hover:-translate-y-0.5" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
          ✨ New Post
        </Link>
      </div>
      <div className="flex gap-2 mb-6">
        {["all", "draft", "scheduled", "published"].map(s => (
          <button key={s} onClick={() => setFilter(s)} className="px-4 py-2 rounded-lg text-xs font-medium capitalize transition" style={{
            background: filter === s ? "rgba(99,102,241,0.2)" : "var(--tt-surface)",
            color: filter === s ? "#a5b4fc" : "var(--tt-text-muted)",
            border: "1px solid " + (filter === s ? "rgba(99,102,241,0.4)" : "var(--tt-border)"),
          }}>{s}</button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div className="text-center py-16 rounded-2xl" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
          <div className="text-5xl mb-4">📝</div>
          <h3 className="text-lg font-semibold mb-2">No posts yet</h3>
          <p className="text-sm mb-4" style={{ color: "var(--tt-text-muted)" }}>Generate your first AI-powered content!</p>
          <Link href="/dashboard/generate" className="inline-block px-5 py-2.5 rounded-xl text-white text-sm font-semibold" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>Generate Content</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(post => (
            <div key={post.id} className="p-5 rounded-2xl" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
              <div className="flex items-start justify-between gap-4">
                <p className="text-sm flex-1 line-clamp-3">{post.content}</p>
                <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full ${statusColors[post.status] || ""}`}>{post.status}</span>
              </div>
              <div className="flex items-center gap-3 mt-3">
                {post.platforms?.map((p: string) => (
                  <span key={p} className="text-xs px-2 py-0.5 rounded capitalize" style={{ background: "var(--tt-surface-2)", color: "var(--tt-text-muted)" }}>{p}</span>
                ))}
                <span className="text-xs" style={{ color: "var(--tt-text-muted)" }}>{new Date(post.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
