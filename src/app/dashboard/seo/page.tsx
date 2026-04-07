"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import {
  Image as ImageIcon,
  Save,
  AlertTriangle,
  Check,
  Filter,
  Loader2,
} from "lucide-react";

interface MediaItem {
  id: string;
  mediaUrl: string;
  thumbnailUrl: string | null;
  altText: string | null;
  width: number | null;
  height: number | null;
  sortOrder: number;
  post: { id: string; contentText: string | null };
}

type FilterMode = "all" | "missing";

export default function SeoAltTextPage() {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<FilterMode>("missing");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const supabase = createClient();

  const fetchMedia = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch(
      `/api/v1/media/alt-text?filter=${filter}&page=${page}&pageSize=24`,
      { headers: { Authorization: `Bearer ${session.access_token}` } }
    );
    const json = await res.json();
    setMedia(json.data ?? []);
    setTotal(json.total ?? 0);
    setTotalPages(json.totalPages ?? 1);
    setLoading(false);
  }, [filter, page, supabase]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  const handleEdit = (id: string, value: string) => {
    setEdits((prev) => ({ ...prev, [id]: value }));
    setSaved(false);
  };

  const pendingCount = Object.keys(edits).length;

  const handleSave = async () => {
    if (pendingCount === 0) return;
    setSaving(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const updates = Object.entries(edits).map(([id, altText]) => ({
      id,
      altText,
    }));

    const res = await fetch("/api/v1/media/alt-text", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ updates }),
    });

    if (res.ok) {
      setEdits({});
      setSaved(true);
      fetchMedia();
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  };

  const missingCount = media.filter(
    (m) => !m.altText && !edits[m.id]
  ).length;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">SEO — Alt Text Editor</h1>
            <p className="mt-1 text-sm text-gray-400">
              Manage image alt text for better accessibility and search rankings.
              {total > 0 && ` ${total} image${total !== 1 ? "s" : ""} total.`}
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={pendingCount === 0 || saving}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium transition-colors hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saved ? (
              <Check className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving
              ? "Saving…"
              : saved
              ? "Saved!"
              : `Save${pendingCount > 0 ? ` (${pendingCount})` : ""}`}
          </button>
        </div>

        {/* Filter bar */}
        <div className="mb-6 flex items-center gap-3">
          <Filter className="h-4 w-4 text-gray-500" />
          <button
            onClick={() => { setFilter("missing"); setPage(1); }}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === "missing"
                ? "bg-amber-500/20 text-amber-400"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            <AlertTriangle className="mr-1 inline h-3 w-3" />
            Missing alt text
          </button>
          <button
            onClick={() => { setFilter("all"); setPage(1); }}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === "all"
                ? "bg-indigo-500/20 text-indigo-400"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            All images
          </button>
          {filter === "missing" && missingCount > 0 && (
            <span className="text-xs text-amber-400">
              {missingCount} image{missingCount !== 1 ? "s" : ""} need alt text
            </span>
          )}
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
          </div>
        )}

        {/* Empty state */}
        {!loading && media.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <ImageIcon className="mb-3 h-12 w-12" />
            <p className="text-lg font-medium">
              {filter === "missing"
                ? "All images have alt text!"
                : "No images found."}
            </p>
          </div>
        )}

        {/* Media grid */}
        {!loading && media.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {media.map((item) => {
              const currentAlt = edits[item.id] ?? item.altText ?? "";
              const isMissing = !item.altText && !edits[item.id];
              return (
                <div
                  key={item.id}
                  className={`rounded-xl border p-3 transition-colors ${
                    isMissing
                      ? "border-amber-500/30 bg-amber-500/5"
                      : "border-gray-800 bg-gray-900"
                  }`}
                >
                  <div className="relative mb-3 aspect-video overflow-hidden rounded-lg bg-gray-800">
                    <img
                      src={item.thumbnailUrl || item.mediaUrl}
                      alt={currentAlt}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    {isMissing && (
                      <div className="absolute right-2 top-2">
                        <AlertTriangle className="h-5 w-5 text-amber-400" />
                      </div>
                    )}
                  </div>
                  <textarea
                    value={currentAlt}
                    onChange={(e) => handleEdit(item.id, e.target.value)}
                    placeholder="Describe this image for accessibility…"
                    rows={2}
                    className="w-full resize-none rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  {item.post.contentText && (
                    <p className="mt-2 truncate text-xs text-gray-500">
                      Post: {item.post.contentText.slice(0, 60)}
                      {item.post.contentText.length > 60 ? "…" : ""}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-sm text-gray-500">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
