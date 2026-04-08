"use client";
import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { usePosts, useDeletePost, useUpdatePost } from "@/hooks/use-api";
import type { Post, PostMedia } from "@/lib/api-client";

const statusColors: Record<string, string> = {
  draft: "bg-gray-500/15 text-gray-400",
  scheduled: "bg-blue-500/15 text-blue-400",
  published: "bg-green-500/15 text-green-400",
  posted: "bg-green-500/15 text-green-400",
  failed: "bg-red-500/15 text-red-400",
  posting: "bg-yellow-500/15 text-yellow-400",
  pending_review: "bg-purple-500/15 text-purple-400",
  queued: "bg-cyan-500/15 text-cyan-400",
};

const platformColors: Record<string, string> = {
  instagram: "#E4405F",
  twitter: "#1DA1F2",
  facebook: "#1877F2",
  linkedin: "#0A66C2",
  tiktok: "#ff0050",
  youtube: "#FF0000",
  pinterest: "#E60023",
  threads: "#000000",
};

type SortKey = "createdAt" | "status" | "viralScore";

const PAGE_SIZE = 20;

export default function PostsPage() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("createdAt");
  const [sortAsc, setSortAsc] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editPost, setEditPost] = useState<Post | null>(null);
  const [editContent, setEditContent] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [page, setPage] = useState(1);

  const { data: postsResponse, isLoading, error } = usePosts({
    status: statusFilter,
    page,
    pageSize: PAGE_SIZE,
  });
  const deletePostMutation = useDeletePost();
  const updatePostMutation = useUpdatePost();

  const posts = postsResponse?.data ?? [];
  const totalPages = postsResponse?.totalPages ?? 1;
  const totalPosts = postsResponse?.total ?? 0;

  // Client-side search + sort on the current page's data
  const filtered = useMemo(() => {
    let result = posts;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          (p.contentText || "").toLowerCase().includes(q) ||
          (p.business?.name || "").toLowerCase().includes(q) ||
          (p.schedules || []).some((s) => s.platform.toLowerCase().includes(q))
      );
    }
    return [...result].sort((a, b) => {
      let av: string | number | null = a[sortBy] as string | number | null;
      let bv: string | number | null = b[sortBy] as string | number | null;
      if (sortBy === "createdAt") {
        av = new Date(av as string).getTime();
        bv = new Date(bv as string).getTime();
      }
      if (sortBy === "viralScore") {
        av = (av as number) || 0;
        bv = (bv as number) || 0;
      }
      if (av === null) av = "";
      if (bv === null) bv = "";
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [posts, search, sortBy, sortAsc]);

  const deletePost = useCallback(
    async (id: string) => {
      if (!confirm("Delete this post?")) return;
      deletePostMutation.mutate(id);
      setSelected((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
    },
    [deletePostMutation]
  );

  const bulkDelete = useCallback(async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} selected posts?`)) return;
    const ids = Array.from(selected);
    for (const id of ids) {
      deletePostMutation.mutate(id);
    }
    setSelected(new Set());
  }, [selected, deletePostMutation]);

  const toggleAll = useCallback(() => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((p) => p.id)));
  }, [selected.size, filtered]);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const openEdit = useCallback((post: Post) => {
    setEditPost(post);
    setEditContent(post.contentText || "");
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editPost) return;
    updatePostMutation.mutate(
      { id: editPost.id, contentText: editContent },
      { onSuccess: () => setEditPost(null) }
    );
  }, [editPost, editContent, updatePostMutation]);

  const getMediaUrl = (post: Post): string | null => {
    if (!post.media || post.media.length === 0) return null;
    return post.media[0].thumbnailUrl || post.media[0].mediaUrl;
  };

  const getPlatforms = (post: Post): string[] => {
    if (!post.schedules || post.schedules.length === 0) return [];
    return [...new Set(post.schedules.map((s) => s.platform))];
  };

  const getScheduledAt = (post: Post): string | null => {
    if (!post.schedules || post.schedules.length === 0) return null;
    const pending = post.schedules.find((s) => s.status === "pending");
    return pending?.scheduledAt || post.schedules[0].scheduledAt;
  };

  const displayStatus = (status: string) => {
    if (status === "posted") return "published";
    return status.replace("_", " ");
  };

  const canEdit = (post: Post) =>
    ["draft", "scheduled", "failed"].includes(post.status);

  // Status tab counts - we show total from API for current filter, approximate for others
  const statusTabs = ["all", "draft", "scheduled", "posted", "failed"] as const;

  const handleFilterChange = (tab: string) => {
    setStatusFilter(tab === "all" ? undefined : tab);
    setPage(1);
    setSelected(new Set());
  };

  // Loading state
  if (isLoading && posts.length === 0) {
    return (
      <div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>Your Posts</h1>
            <p className="text-sm mt-1" style={{ color: "var(--tt-text-muted)" }}>Loading...</p>
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-5 rounded-2xl animate-pulse" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
              <div className="flex items-start gap-4">
                <div className="w-4 h-4 rounded bg-gray-700/30 mt-1" />
                <div className="flex-1 space-y-3">
                  <div className="h-4 bg-gray-700/30 rounded w-3/4" />
                  <div className="h-3 bg-gray-700/30 rounded w-1/2" />
                  <div className="h-3 bg-gray-700/30 rounded w-1/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>Your Posts</h1>
          </div>
        </div>
        <div className="text-center py-16 rounded-2xl" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
          <svg className="w-16 h-16 mx-auto mb-4" style={{ color: "#ef4444" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={0.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <h3 className="text-lg font-semibold mb-2" style={{ fontFamily: "var(--font-heading)" }}>Failed to load posts</h3>
          <p className="text-sm" style={{ color: "var(--tt-text-muted)" }}>
            {error instanceof Error ? error.message : "Something went wrong. Please try again."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>Your Posts</h1>
          <p className="text-sm mt-1" style={{ color: "var(--tt-text-muted)" }}>{totalPosts} total posts</p>
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
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search posts, platforms..."
            className="input-field pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="input-field text-xs"
            style={{ width: "auto", padding: "0.5rem 0.75rem" }}
          >
            <option value="createdAt">Date</option>
            <option value="status">Status</option>
            <option value="viralScore">Viral Score</option>
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
        {statusTabs.map((s) => (
          <button
            key={s}
            onClick={() => handleFilterChange(s)}
            className="px-4 py-2 rounded-lg text-xs font-medium capitalize transition"
            style={{
              background: (statusFilter === s || (s === "all" && !statusFilter)) ? "rgba(99,102,241,0.2)" : "var(--tt-surface)",
              color: (statusFilter === s || (s === "all" && !statusFilter)) ? "#a5b4fc" : "var(--tt-text-muted)",
              border: "1px solid " + ((statusFilter === s || (s === "all" && !statusFilter)) ? "rgba(99,102,241,0.4)" : "var(--tt-border)"),
            }}
          >
            {s === "posted" ? "published" : s}
            {(s === "all" || !statusFilter) && s === "all" && (
              <span className="ml-1 opacity-60">({totalPosts})</span>
            )}
          </button>
        ))}
      </div>

      {/* Bulk Actions Bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 rounded-xl animate-fade-up" style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)" }}>
          <span className="text-sm font-medium" style={{ color: "#a5b4fc" }}>{selected.size} selected</span>
          <div className="flex gap-2 ml-auto">
            <button
              onClick={bulkDelete}
              disabled={deletePostMutation.isPending}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444" }}
            >
              {deletePostMutation.isPending ? "Deleting..." : "Delete"}
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
          {filtered.map((post) => {
            const mediaUrl = getMediaUrl(post);
            const platforms = getPlatforms(post);
            const scheduledAt = getScheduledAt(post);
            return (
              <div key={post.id} className="rounded-2xl overflow-hidden transition-all hover:-translate-y-1" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
                {/* Media preview */}
                {mediaUrl ? (
                  <div className="h-40 overflow-hidden" style={{ borderBottom: "1px solid var(--tt-border)" }}>
                    <img src={mediaUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
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
                    <span className={`text-xs px-2.5 py-1 rounded-full capitalize ${statusColors[post.status] || "bg-gray-500/15 text-gray-400"}`}>{displayStatus(post.status)}</span>
                    <input type="checkbox" checked={selected.has(post.id)} onChange={() => toggleSelect(post.id)} className="w-4 h-4 accent-indigo-500" />
                  </div>
                  <p className="text-sm line-clamp-3 mb-3">{post.contentText || <span style={{ color: "var(--tt-text-muted)", fontStyle: "italic" }}>No content</span>}</p>
                  {platforms.length > 0 && (
                    <div className="flex gap-1 mb-3">
                      {platforms.map((pl) => (
                        <span key={pl} className="w-6 h-6 rounded-md flex items-center justify-center text-xs text-white" style={{ background: platformColors[pl] || "var(--tt-surface-2)" }}>
                          {pl[0].toUpperCase()}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: "var(--tt-text-muted)" }}>{new Date(post.createdAt).toLocaleDateString()}</span>
                    <div className="flex gap-1">
                      {canEdit(post) && (
                        <button onClick={() => openEdit(post)} className="p-1.5 rounded-lg transition hover:bg-indigo-500/10" style={{ color: "#818cf8" }}>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" /></svg>
                        </button>
                      )}
                      <button onClick={() => deletePost(post.id)} disabled={deletePostMutation.isPending} className="p-1.5 rounded-lg transition hover:bg-red-500/10" style={{ color: "#ef4444" }}>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="space-y-3">
          {/* Select All */}
          <div className="flex items-center gap-3 px-4">
            <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll} className="w-4 h-4 accent-indigo-500" />
            <span className="text-xs" style={{ color: "var(--tt-text-muted)" }}>Select all</span>
          </div>

          {filtered.map((post) => {
            const mediaUrl = getMediaUrl(post);
            const platforms = getPlatforms(post);
            const scheduledAt = getScheduledAt(post);
            return (
              <div key={post.id} className="p-5 rounded-2xl transition-all hover:-translate-y-0.5" style={{ background: "var(--tt-surface)", border: "1px solid " + (selected.has(post.id) ? "rgba(99,102,241,0.4)" : "var(--tt-border)") }}>
                <div className="flex items-start gap-4">
                  {/* Checkbox */}
                  <input type="checkbox" checked={selected.has(post.id)} onChange={() => toggleSelect(post.id)} className="mt-1 w-4 h-4 accent-indigo-500 shrink-0" />

                  {/* Media Thumbnail */}
                  {mediaUrl && (
                    <div className="shrink-0 w-20 h-20 rounded-lg overflow-hidden" style={{ border: "1px solid var(--tt-border)" }}>
                      <img src={mediaUrl} alt="Post media" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      {post.media && post.media.length > 1 && (
                        <div className="relative -mt-5 text-center">
                          <span className="bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">+{post.media.length - 1}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <p className="text-sm flex-1 line-clamp-3">{post.contentText || <span style={{ color: "var(--tt-text-muted)", fontStyle: "italic" }}>No content</span>}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs px-2.5 py-1 rounded-full capitalize ${statusColors[post.status] || "bg-gray-500/15 text-gray-400"}`}>{displayStatus(post.status)}</span>
                        {post.viralScore != null && post.viralScore > 0 && (
                          <span className="text-xs px-2 py-1 rounded-full" style={{ background: "rgba(16,185,129,0.1)", color: "#10b981" }}>
                            {Math.round(post.viralScore * 100)}%
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Business */}
                    {post.business?.name && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8" }}>
                          {post.business.name}
                        </span>
                      </div>
                    )}

                    {/* Meta */}
                    <div className="flex items-center gap-3 flex-wrap">
                      {platforms.map((p) => (
                        <span key={p} className="text-xs px-2 py-0.5 rounded capitalize" style={{ background: platformColors[p] ? `${platformColors[p]}20` : "var(--tt-surface-2)", color: platformColors[p] || "var(--tt-text-muted)" }}>
                          {p === "twitter" ? "X" : p}
                        </span>
                      ))}
                      <span className="text-xs" style={{ color: "var(--tt-text-muted)" }}>
                        {new Date(post.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                      {scheduledAt && (
                        <span className="text-xs" style={{ color: "#60a5fa" }}>
                          Scheduled: {new Date(scheduledAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </span>
                      )}
                      {post.aiGenerated && (
                        <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8" }}>
                          AI Generated
                        </span>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded capitalize" style={{ background: "rgba(99,102,241,0.05)", color: "var(--tt-text-muted)" }}>
                        {post.contentType}
                      </span>
                      <div className="flex gap-1 ml-auto">
                        {canEdit(post) && (
                          <button onClick={() => openEdit(post)} className="p-1.5 rounded-lg transition opacity-50 hover:opacity-100 hover:bg-indigo-500/10" style={{ color: "#818cf8" }} title="Edit">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" /></svg>
                          </button>
                        )}
                        <button onClick={() => deletePost(post.id)} disabled={deletePostMutation.isPending} className="p-1.5 rounded-lg transition opacity-50 hover:opacity-100 hover:bg-red-500/10" style={{ color: "#ef4444" }} title="Delete">
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-2 rounded-lg text-xs font-medium transition disabled:opacity-30"
            style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)", color: "var(--tt-text-muted)" }}
          >
            Previous
          </button>
          <span className="text-xs px-3" style={{ color: "var(--tt-text-muted)" }}>
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-2 rounded-lg text-xs font-medium transition disabled:opacity-30"
            style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)", color: "var(--tt-text-muted)" }}
          >
            Next
          </button>
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
                <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={6} className="input-field resize-none" />
                <div className="text-xs mt-1 text-right" style={{ color: "var(--tt-text-muted)" }}>{editContent.length} characters</div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Status</label>
                <span className={`text-xs px-2.5 py-1 rounded-full capitalize ${statusColors[editPost.status] || "bg-gray-500/15 text-gray-400"}`}>
                  {displayStatus(editPost.status)}
                </span>
                <p className="text-xs mt-1" style={{ color: "var(--tt-text-muted)" }}>Status is managed through the publishing workflow</p>
              </div>

              {/* Platform tags (read-only display from schedules) */}
              {getPlatforms(editPost).length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-2">Platforms</label>
                  <div className="flex gap-2">
                    {getPlatforms(editPost).map((p) => (
                      <span key={p} className="text-xs px-3 py-1.5 rounded-lg capitalize" style={{ background: platformColors[p] ? `${platformColors[p]}20` : "var(--tt-surface-2)", color: platformColors[p] || "var(--tt-text-muted)", border: "1px solid var(--tt-border)" }}>
                        {p === "twitter" ? "X" : p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Content type display */}
              <div>
                <label className="block text-sm font-medium mb-2">Content Type</label>
                <span className="text-xs px-2.5 py-1 rounded-full capitalize" style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8" }}>
                  {editPost.contentType}
                </span>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditPost(null)} className="flex-1 py-2.5 rounded-xl text-sm font-medium transition" style={{ background: "var(--tt-surface-2)", border: "1px solid var(--tt-border)", color: "var(--tt-text)" }}>
                Cancel
              </button>
              <button onClick={saveEdit} disabled={updatePostMutation.isPending} className="btn-primary flex-1 py-2.5 text-sm disabled:opacity-50">
                {updatePostMutation.isPending ? "Saving..." : "Save Changes"}
              </button>
            </div>

            {updatePostMutation.isError && (
              <p className="text-xs mt-3 text-center" style={{ color: "#ef4444" }}>
                {updatePostMutation.error instanceof Error ? updatePostMutation.error.message : "Failed to save. Please try again."}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
