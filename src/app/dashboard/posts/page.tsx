"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

const statusColors: Record<string, string> = {
  draft: "bg-gray-500/15 text-gray-400",
  scheduled: "bg-blue-500/15 text-blue-400",
  published: "bg-green-500/15 text-green-400",
  failed: "bg-red-500/15 text-red-400",
};

const platformColors: Record<string, string> = {
  instagram: "#E4405F",
  twitter: "#1DA1F2",
  facebook: "#1877F2",
  linkedin: "#0A66C2",
  tiktok: "#ff0050",
};

type SortKey = "created_at" | "status" | "engagement_score";

export default function PostsPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("created_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editPost, setEditPost] = useState<any>(null);
  const [editContent, setEditContent] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("posts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setPosts(data || []);
    }
    load();
  }, []);

  const deletePost = async (id: string) => {
    if (!confirm("Delete this post?")) return;
    setDeleting(id);
    await supabase.from("posts").delete().eq("id", id);
    setPosts(prev => prev.filter(p => p.id !== id));
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
    setDeleting(null);
  };

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} selected posts?`)) return;
    const ids = Array.from(selected);
    await supabase.from("posts").delete().in("id", ids);
    setPosts(prev => prev.filter(p => !selected.has(p.id)));
    setSelected(new Set());
  };

  const bulkUpdateStatus = async (status: string) => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    await supabase.from("posts").update({ status }).in("id", ids);
    setPosts(prev => prev.map(p => selected.has(p.id) ? { ...p, status } : p));
    setSelected(new Set());
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(p => p.id)));
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const openEdit = (post: any) => {
    setEditPost(post);
    setEditContent(post.content || "");
    setEditStatus(post.status || "draft");
  };

  const saveEdit = async () => {
    if (!editPost) return;
    setSaving(true);
    await supabase.from("posts").update({ content: editContent, status: editStatus, updated_at: new Date().toISOString() }).eq("id", editPost.id);
    setPosts(prev => prev.map(p => p.id === editPost.id ? { ...p, content: editContent, status: editStatus } : p));
    setEditPost(null);
    setSaving(false);
  };

  const handleSort = (key: SortKey) => {
    if (sortBy === key) setSortAsc(!sortAsc);
    else { setSortBy(key); setSortAsc(false); }
  };

  // Filter + Search + Sort
  let filtered = filter === "all" ? posts : posts.filter(p => p.status === filter);
  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter(p =>
      (p.content || "").toLowerCase().includes(q) ||
      (p.hashtags || []).some((h: string) => h.toLowerCase().includes(q)) ||
      (p.platforms || []).some((pl: string) => pl.toLowerCase().includes(q))
    );
  }
  filtered = [...filtered].sort((a, b) => {
    let av = a[sortBy], bv = b[sortBy];
    if (sortBy === "created_at") { av = new Date(av).getTime(); bv = new Date(bv).getTime(); }
    if (sortBy === "engagement_score") { av = av || 0; bv = bv || 0; }
    if (av < bv) return sortAsc ? -1 : 1;
    if (av > bv) return sortAsc ? 1 : -1;
    return 0;
  });

  const counts = {
    all: posts.length,
    draft: posts.filter(p => p.status === "draft").length,
    scheduled: posts.filter(p => p.status === "scheduled").length,
    published: posts.filter(p => p.status === "published").length,
    failed: posts.filter(p => p.status === "failed").length,
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>Your Posts</h1>
          <p className="text-sm mt-1" style={{ color: "var(--tt-text-muted)" }}>{posts.length} total posts</p>
        </div>
        <Link href="/dashboard/generate" className="btn-primary px-5 py-2.5 text-sm inline-flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          New Post
        </Link>
      </div>

      {/* Search + View Toggle */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--tt-text-muted)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search posts, hashtags, platforms..."
            className="input-field pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortKey)}
            className="input-field text-xs"
            style={{ width: "auto", padding: "0.5rem 0.75rem" }}
          >
            <option value="created_at">Date</option>
            <option value="status">Status</option>
            <option value="engagement_score">Engagement</option>
          </select>
          <button onClick={() => setSortAsc(!sortAsc)} className="p-2 rounded-lg transition" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)", color: "var(--tt-text-muted)" }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ transform: sortAsc ? "scaleY(-1)" : "none" }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h14.25M3 9h9.75M3 13.5h5.25m5.25-.75L17.25 9m0 0L21 12.75M17.25 9v12" />
            </svg>
          </button>
          <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--tt-border)" }}>
            <button onClick={() => setViewMode("list")} className="p-2 transition" style={{ background: viewMode === "list" ? "rgba(99,102,241,0.15)" : "var(--tt-surface)", color: viewMode === "list" ? "#a5b4fc" : "var(--tt-text-muted)" }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 5.25h16.5m-16.5-10.5h16.5" /></svg>
            </button>
            <button onClick={() => setViewMode("grid")} className="p-2 transition" style={{ background: viewMode === "grid" ? "rgba(99,102,241,0.15)" : "var(--tt-surface)", color: viewMode === "grid" ? "#a5b4fc" : "var(--tt-text-muted)" }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        {(["all", "draft", "scheduled", "published", "failed"] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)} className="px-4 py-2 rounded-lg text-xs font-medium capitalize transition" style={{
            background: filter === s ? "rgba(99,102,241,0.2)" : "var(--tt-surface)",
            color: filter === s ? "#a5b4fc" : "var(--tt-text-muted)",
            border: "1px solid " + (filter === s ? "rgba(99,102,241,0.4)" : "var(--tt-border)"),
          }}>
            {s} <span className="ml-1 opacity-60">({counts[s]})</span>
          </button>
        ))}
      </div>

      {/* Bulk Actions Bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 rounded-xl animate-fade-up" style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)" }}>
          <span className="text-sm font-medium" style={{ color: "#a5b4fc" }}>{selected.size} selected</span>
          <div className="flex gap-2 ml-auto">
            <button onClick={() => bulkUpdateStatus("draft")} className="px-3 py-1.5 rounded-lg text-xs font-medium transition" style={{ background: "var(--tt-surface-2)", border: "1px solid var(--tt-border)", color: "var(--tt-text)" }}>
              Mark Draft
            </button>
            <button onClick={() => bulkUpdateStatus("scheduled")} className="px-3 py-1.5 rounded-lg text-xs font-medium transition" style={{ background: "var(--tt-surface-2)", border: "1px solid var(--tt-border)", color: "var(--tt-text)" }}>
              Schedule
            </button>
            <button onClick={bulkDelete} className="px-3 py-1.5 rounded-lg text-xs font-medium transition" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444" }}>
              Delete
            </button>
            <button onClick={() => setSelected(new Set())} className="px-3 py-1.5 rounded-lg text-xs font-medium transition" style={{ color: "var(--tt-text-muted)" }}>
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Posts */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 rounded-2xl" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
          <svg className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--tt-text-muted)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={0.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <h3 className="text-lg font-semibold mb-2" style={{ fontFamily: "var(--font-heading)" }}>
            {search ? "No matching posts" : "No posts yet"}
          </h3>
          <p className="text-sm mb-6" style={{ color: "var(--tt-text-muted)" }}>
            {search ? "Try a different search term" : "Generate your first AI-powered content!"}
          </p>
          {!search && (
            <Link href="/dashboard/generate" className="btn-primary inline-block px-6 py-2.5 text-sm">
              Create Your First Post
            </Link>
          )}
        </div>
      ) : viewMode === "grid" ? (
        /* Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(post => (
            <div key={post.id} className="rounded-2xl overflow-hidden transition-all hover:-translate-y-1" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
              {/* Media preview */}
              {post.media_urls?.[0] ? (
                <div className="h-40 overflow-hidden" style={{ borderBottom: "1px solid var(--tt-border)" }}>
                  <img src={post.media_urls[0]} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                </div>
              ) : (
                <div className="h-20 flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.05), rgba(168,85,247,0.05))" }}>
                  <svg className="w-8 h-8" style={{ color: "var(--tt-border-light)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
              )}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs px-2.5 py-1 rounded-full ${statusColors[post.status] || ""}`}>{post.status}</span>
                  <input type="checkbox" checked={selected.has(post.id)} onChange={() => toggleSelect(post.id)} className="w-4 h-4 accent-indigo-500" />
                </div>
                <p className="text-sm line-clamp-3 mb-3">{post.content}</p>
                {post.platforms?.length > 0 && (
                  <div className="flex gap-1 mb-3">
                    {post.platforms.map((pl: string) => (
                      <span key={pl} className="w-6 h-6 rounded-md flex items-center justify-center text-xs text-white" style={{ background: platformColors[pl] || "var(--tt-surface-2)" }}>
                        {pl[0].toUpperCase()}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: "var(--tt-text-muted)" }}>{new Date(post.created_at).toLocaleDateString()}</span>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(post)} className="p-1.5 rounded-lg transition hover:bg-indigo-500/10" style={{ color: "#818cf8" }}>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" /></svg>
                    </button>
                    <button onClick={() => deletePost(post.id)} disabled={deleting === post.id} className="p-1.5 rounded-lg transition hover:bg-red-500/10" style={{ color: "#ef4444" }}>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="space-y-3">
          {/* Select All */}
          <div className="flex items-center gap-3 px-4">
            <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll} className="w-4 h-4 accent-indigo-500" />
            <span className="text-xs" style={{ color: "var(--tt-text-muted)" }}>Select all</span>
          </div>

          {filtered.map(post => {
            const hasMedia = post.media_urls && post.media_urls.length > 0;
            return (
              <div key={post.id} className="p-5 rounded-2xl transition-all hover:-translate-y-0.5" style={{ background: "var(--tt-surface)", border: "1px solid " + (selected.has(post.id) ? "rgba(99,102,241,0.4)" : "var(--tt-border)") }}>
                <div className="flex items-start gap-4">
                  {/* Checkbox */}
                  <input type="checkbox" checked={selected.has(post.id)} onChange={() => toggleSelect(post.id)} className="mt-1 w-4 h-4 accent-indigo-500 shrink-0" />

                  {/* Media Thumbnail */}
                  {hasMedia && (
                    <div className="shrink-0 w-20 h-20 rounded-lg overflow-hidden" style={{ border: "1px solid var(--tt-border)" }}>
                      <img src={post.media_urls[0]} alt="Post media" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
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
                        {post.engagement_score && (
                          <span className="text-xs px-2 py-1 rounded-full" style={{ background: "rgba(16,185,129,0.1)", color: "#10b981" }}>
                            {post.engagement_score}%
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Hashtags */}
                    {post.hashtags && post.hashtags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {post.hashtags.slice(0, 5).map((h: string, i: number) => (
                          <span key={i} className="text-xs" style={{ color: "#818cf8" }}>#{h}</span>
                        ))}
                        {post.hashtags.length > 5 && <span className="text-xs" style={{ color: "var(--tt-text-muted)" }}>+{post.hashtags.length - 5}</span>}
                      </div>
                    )}

                    {/* Meta */}
                    <div className="flex items-center gap-3 flex-wrap">
                      {post.platforms?.map((p: string) => (
                        <span key={p} className="text-xs px-2 py-0.5 rounded capitalize" style={{ background: platformColors[p] ? `${platformColors[p]}20` : "var(--tt-surface-2)", color: platformColors[p] || "var(--tt-text-muted)" }}>
                          {p === "twitter" ? "X" : p}
                        </span>
                      ))}
                      <span className="text-xs" style={{ color: "var(--tt-text-muted)" }}>
                        {new Date(post.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                      {post.scheduled_at && (
                        <span className="text-xs" style={{ color: "#60a5fa" }}>
                          Scheduled: {new Date(post.scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </span>
                      )}
                      {post.ai_model && (
                        <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8" }}>
                          AI: {post.ai_model}
                        </span>
                      )}
                      <div className="flex gap-1 ml-auto">
                        <button onClick={() => openEdit(post)} className="p-1.5 rounded-lg transition opacity-50 hover:opacity-100 hover:bg-indigo-500/10" style={{ color: "#818cf8" }} title="Edit">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" /></svg>
                        </button>
                        <button onClick={() => deletePost(post.id)} disabled={deleting === post.id} className="p-1.5 rounded-lg transition opacity-50 hover:opacity-100 hover:bg-red-500/10" style={{ color: "#ef4444" }} title="Delete">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="w-full max-w-lg rounded-2xl p-6 animate-fade-up" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold" style={{ fontFamily: "var(--font-heading)" }}>Edit Post</h3>
              <button onClick={() => setEditPost(null)} className="p-1 rounded-lg transition hover:bg-white/5" style={{ color: "var(--tt-text-muted)" }}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Content</label>
                <textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={6} className="input-field resize-none" />
                <div className="text-xs mt-1 text-right" style={{ color: "var(--tt-text-muted)" }}>{editContent.length} characters</div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Status</label>
                <div className="flex gap-2">
                  {["draft", "scheduled", "published"].map(s => (
                    <button key={s} onClick={() => setEditStatus(s)} className="px-4 py-2 rounded-lg text-xs font-medium capitalize transition" style={{
                      background: editStatus === s ? "rgba(99,102,241,0.2)" : "var(--tt-surface-2)",
                      color: editStatus === s ? "#a5b4fc" : "var(--tt-text-muted)",
                      border: "1px solid " + (editStatus === s ? "rgba(99,102,241,0.4)" : "var(--tt-border)"),
                    }}>{s}</button>
                  ))}
                </div>
              </div>

              {/* Platform tags (read-only display) */}
              {editPost.platforms?.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-2">Platforms</label>
                  <div className="flex gap-2">
                    {editPost.platforms.map((p: string) => (
                      <span key={p} className="text-xs px-3 py-1.5 rounded-lg capitalize" style={{ background: platformColors[p] ? `${platformColors[p]}20` : "var(--tt-surface-2)", color: platformColors[p] || "var(--tt-text-muted)", border: "1px solid var(--tt-border)" }}>
                        {p === "twitter" ? "X" : p}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditPost(null)} className="flex-1 py-2.5 rounded-xl text-sm font-medium transition" style={{ background: "var(--tt-surface-2)", border: "1px solid var(--tt-border)", color: "var(--tt-text)" }}>
                Cancel
              </button>
              <button onClick={saveEdit} disabled={saving} className="btn-primary flex-1 py-2.5 text-sm disabled:opacity-50">
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
