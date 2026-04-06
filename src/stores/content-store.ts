"use client";

import { create } from "zustand";

export type Platform = "instagram" | "twitter" | "linkedin" | "tiktok" | "facebook" | "youtube" | "pinterest";

export interface ScheduledPost {
  id: string;
  title: string;
  content: string;
  platforms: Platform[];
  scheduledAt: string;
  status: "draft" | "scheduled" | "published" | "failed";
  type: "text" | "image" | "video";
}

interface ContentState {
  posts: ScheduledPost[];
  selectedPlatforms: Platform[];
  setSelectedPlatforms: (platforms: Platform[]) => void;
  addPost: (post: ScheduledPost) => void;
  updatePost: (id: string, updates: Partial<ScheduledPost>) => void;
  removePost: (id: string) => void;
  setPosts: (posts: ScheduledPost[]) => void;
}

export const useContentStore = create<ContentState>((set) => ({
  posts: [],
  selectedPlatforms: [],
  setSelectedPlatforms: (platforms) => set({ selectedPlatforms: platforms }),
  addPost: (post) => set((s) => ({ posts: [...s.posts, post] })),
  updatePost: (id, updates) =>
    set((s) => ({
      posts: s.posts.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    })),
  removePost: (id) => set((s) => ({ posts: s.posts.filter((p) => p.id !== id) })),
  setPosts: (posts) => set({ posts }),
}));
