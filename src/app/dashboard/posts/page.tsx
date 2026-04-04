"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

export default function PostsPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [deleting, setDeleting] = useState<string | null>(null);
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

  const deletePost = async (id: string) => {
    if (!confirm("Delete this post?")) return;
    setDeleting(id);
    await supabase.from("posts").delete().eq("id", id);
    setPosts(prev => prev.filter(p => p.id !== id));
    setDeleting(null);
  };

  const filtered = filter === "all" ? posts : posts.filter(p => p.status === filter);
  const statusColors: Record<string, string> = {
    draft: "bg-gray-500/15 text-gray-400",
    scheduled: "bg-blue-500/15 text-blue-400",
    published: "bg-green-500/15 text-green-400",
    failed: "bg-red-500/15 text-red-400",
  };

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

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {["all", "draft", "scheduled", "published"].map(s => (
          <button key={s} onClick={() => setFilter(s)} className="px-4 py-2 rounded-lg text-xs font-medium capitalize transition" style={{
            background: filter === s ? "rgba(99,102,241,0.2)" : "var(--tt-surface)",
            color: filter === s ? "#a5b4fc" : "var(--tt-text-muted)",
            border: "1px solid " + (filter === s ? "rgba(99,102,241,0.4)" : "var(--tt-border)"),
          }}>{s} {s !== "all" && <span className="ml-1 opacity-60">({posts.filter(p => s === "all" ? true : p.status === s).length})</span>}</button>
        ))}
      </div>

      {/* Posts List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 rounded-2xl" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
          <div className="text-5xl mb-4">📝</div>
          <h3 className="text-lg font-semibold mb-2">No posts yet</h3>
          <p className="text-sm mb-4" style={{ color: "var(--tt-text-muted)" }}>Generate your first AI-powered content!</p>
          <Link href="/dashboard/generate" className="inline-block px-5 py-2.5 rounded-xl text-white text-sm font-semibold" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>Generate Content</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(post => {
            const hasMedia = post.media_urls && post.media_urls.length > 0;
            return (
              <div key={post.id} className="p-5 rounded-2xl" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
                <div className="flex items-start gap-4">
                  {/* Media Thumbnail */}
                  {hasMedia && (
                    <div className="shrink-0 w-20 h-20 rounded-lg overflow-hidden" style={{ border: "1px solid var(--tt-border)" }}>
                      <img src={post.media_urls[0]} alt="Post media" className="w-full h-full object-cover" onError={(e) => {
                        (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='80' height='80' fill='%23222'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' font-size='24' fill='%23666'%3E🖼️%3C/text%3E%3C/svg%3E";
                      }} />
                      {post.media_urls.length > 1 && (
                        <div className="relative -mt-5 text-center">
                          <span className="bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">+{post.media_urls.length - 1}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <p className="text-sm flex-1 line-clamp-3">{post.content}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs px-2.5 py-1 rounded-full ${statusColors[post.status] || ""}`}>{post.status}</span>
                        <button onClick={() => deletePost(post.id)} disabled={deleting === post.id} className="text-xs px-2 py-1 rounded-lg transition opacity-50 hover:opacity-100" style={{ color: "#ef4444" }}>
                          {deleting === post.id ? "..." : "🗑️"}
                        </button>
                      </div>
                    </div>

                    {/* Hashtags */}
                    {post.hashtags && post.hashtags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {post.hashtags.slice(0, 5).map((h: string, i: number) => (
                          <span key={i} className="text-xs" style={{ color: "#818cf8" }}>#{h}</span>
                        ))}
                        {post.hashtags.length > 5 && <span className="text-xs" style={{ color: "var(--tt-text-muted)" }}>+{post.hashtags.length - 5} more</span>}
                      </div>
                    )}

                    {/* Meta info */}
                    <div className="flex items-center gap-3">
                      {post.platforms?.map((p: string) => (
                        <span key={p} className="text-xs px-2 py-0.5 rounded capitalize" style={{ background: "var(--tt-surface-2)", color: "var(--tt-text-muted)" }}>
                          {p === "twitter" ? "X" : p}
                        </span>
                      ))}
                      <span className="text-xs" style={{ color: "var(--tt-text-muted)" }}>{new Date(post.created_at).toLocaleDateString()}</span>
                      {post.ai_prompt && (
                        <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8" }}>AI: {post.ai_prompt.slice(0, 30)}{post.ai_prompt.length > 30 ? "..." : ""}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
