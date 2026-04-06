"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  Globe,
  Palette,
  Share2,
  MoreHorizontal,
  X,
  Upload,
  Save,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";

interface Business {
  id: string;
  name: string;
  industry: string;
  website: string;
  description: string;
  logo: string;
  colors: { primary: string; secondary: string };
  socialLinks: { platform: string; url: string }[];
  postsCount: number;
  followersTotal: number;
  status: "active" | "paused";
  createdAt: string;
}

const businesses: Business[] = [
  {
    id: "biz-1",
    name: "Acme Corp",
    industry: "Technology",
    website: "https://acme.com",
    description: "Leading tech company building developer tools.",
    logo: "AC",
    colors: { primary: "#3B82F6", secondary: "#1D4ED8" },
    socialLinks: [
      { platform: "twitter", url: "https://twitter.com/acme" },
      { platform: "linkedin", url: "https://linkedin.com/company/acme" },
      { platform: "instagram", url: "https://instagram.com/acme" },
    ],
    postsCount: 342,
    followersTotal: 28500,
    status: "active",
    createdAt: "Jan 2026",
  },
  {
    id: "biz-2",
    name: "Fresh Bakery",
    industry: "Food & Beverage",
    website: "https://freshbakery.com",
    description: "Artisan bakery delivering fresh pastries daily.",
    logo: "FB",
    colors: { primary: "#10B981", secondary: "#059669" },
    socialLinks: [
      { platform: "instagram", url: "https://instagram.com/freshbakery" },
      { platform: "facebook", url: "https://facebook.com/freshbakery" },
    ],
    postsCount: 156,
    followersTotal: 12300,
    status: "active",
    createdAt: "Feb 2026",
  },
  {
    id: "biz-3",
    name: "Style Studio",
    industry: "Fashion",
    website: "https://stylestudio.co",
    description: "Boutique fashion studio for modern professionals.",
    logo: "SS",
    colors: { primary: "#8B5CF6", secondary: "#7C3AED" },
    socialLinks: [
      { platform: "instagram", url: "https://instagram.com/stylestudio" },
      { platform: "tiktok", url: "https://tiktok.com/@stylestudio" },
      { platform: "pinterest", url: "https://pinterest.com/stylestudio" },
    ],
    postsCount: 89,
    followersTotal: 5700,
    status: "paused",
    createdAt: "Mar 2026",
  },
];

export default function BusinessSettingsPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingBiz, setEditingBiz] = useState<string | null>(null);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Your Businesses</h2>
          <p className="text-sm text-gray-500 dark:text-dark-muted">Manage multiple brands and businesses from one account</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-1" />
          New Business
        </Button>
      </div>

      {/* Business Cards */}
      <div className="grid grid-cols-1 gap-4">
        {businesses.map((biz) => (
          <Card key={biz.id} className={editingBiz === biz.id ? "ring-1 ring-brand-500" : ""}>
            <CardContent className="p-5">
              {editingBiz === biz.id ? (
                /* ── Edit Mode ── */
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">Edit Business</h3>
                    <button onClick={() => setEditingBiz(null)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-dark-surface-2">
                      <X className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Business Name</label>
                      <input
                        type="text"
                        defaultValue={biz.name}
                        className="w-full h-10 px-3 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Industry</label>
                      <input
                        type="text"
                        defaultValue={biz.industry}
                        className="w-full h-10 px-3 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Description</label>
                    <textarea
                      defaultValue={biz.description}
                      className="w-full h-20 p-3 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Website</label>
                    <input
                      type="url"
                      defaultValue={biz.website}
                      className="w-full h-10 px-3 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  {/* Brand Colors */}
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Brand Colors</label>
                    <div className="flex gap-3 items-center">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-md border border-gray-200" style={{ backgroundColor: biz.colors.primary }} />
                        <span className="text-xs text-gray-400 font-mono">{biz.colors.primary}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-md border border-gray-200" style={{ backgroundColor: biz.colors.secondary }} />
                        <span className="text-xs text-gray-400 font-mono">{biz.colors.secondary}</span>
                      </div>
                    </div>
                  </div>
                  {/* Logo Upload */}
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Logo</label>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: biz.colors.primary }}
                      >
                        {biz.logo}
                      </div>
                      <Button variant="outline" size="sm">
                        <Upload className="w-3 h-3 mr-1" />
                        Upload Logo
                      </Button>
                    </div>
                  </div>
                  {/* Social Links */}
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Social Links</label>
                    <div className="space-y-2">
                      {biz.socialLinks.map((link, i) => (
                        <div key={i} className="flex gap-2">
                          <input
                            type="text"
                            defaultValue={link.platform}
                            className="w-28 h-9 px-3 rounded-md border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-surface-2 text-xs"
                            readOnly
                          />
                          <input
                            type="url"
                            defaultValue={link.url}
                            className="flex-1 h-9 px-3 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end pt-2 border-t border-gray-200 dark:border-dark-border">
                    <Button variant="outline" onClick={() => setEditingBiz(null)}>Cancel</Button>
                    <Button onClick={() => setEditingBiz(null)}>
                      <Save className="w-4 h-4 mr-1" />
                      Save Changes
                    </Button>
                  </div>
                </div>
              ) : (
                /* ── View Mode ── */
                <div className="flex items-start gap-4">
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ backgroundColor: biz.colors.primary }}
                  >
                    {biz.logo}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{biz.name}</h3>
                      <Badge variant={biz.status === "active" ? "success" : "warning"}>{biz.status}</Badge>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-dark-muted">{biz.description}</p>
                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-400 dark:text-dark-muted">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {biz.industry}
                      </span>
                      <span className="flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        {biz.website.replace("https://", "")}
                      </span>
                      <span className="flex items-center gap-1">
                        <Share2 className="w-3 h-3" />
                        {biz.socialLinks.length} platforms
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs">
                      <span className="font-medium">{biz.postsCount.toLocaleString()} posts</span>
                      <span className="font-medium">{biz.followersTotal.toLocaleString()} total followers</span>
                      <span className="text-gray-400">Since {biz.createdAt}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => setEditingBiz(biz.id)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Business Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Create New Business</CardTitle>
                <button onClick={() => setShowCreateModal(false)} className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-dark-surface-2">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              <CardDescription>Set up a new business profile to manage separately</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Business Name *</label>
                <input
                  type="text"
                  placeholder="My Awesome Business"
                  className="w-full h-10 px-3 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Industry *</label>
                <select className="w-full h-10 px-3 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="">Select industry...</option>
                  <option>Technology</option>
                  <option>E-Commerce</option>
                  <option>Food & Beverage</option>
                  <option>Fashion</option>
                  <option>Health & Wellness</option>
                  <option>Education</option>
                  <option>Finance</option>
                  <option>Real Estate</option>
                  <option>Entertainment</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Website</label>
                <input
                  type="url"
                  placeholder="https://yourbusiness.com"
                  className="w-full h-10 px-3 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Description</label>
                <textarea
                  placeholder="Briefly describe your business and target audience..."
                  className="w-full h-24 p-3 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Brand Color</label>
                <div className="flex gap-2">
                  {["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EF4444", "#EC4899"].map((c) => (
                    <button
                      key={c}
                      className="w-8 h-8 rounded-md border-2 border-transparent hover:border-gray-400 transition-colors"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Logo</label>
                <div className="flex items-center justify-center w-full h-24 rounded-lg border-2 border-dashed border-gray-300 dark:border-dark-border hover:border-brand-500 transition-colors cursor-pointer">
                  <div className="text-center">
                    <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                    <p className="text-xs text-gray-400">Click to upload or drag & drop</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-4 border-t border-gray-200 dark:border-dark-border">
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                <Button onClick={() => setShowCreateModal(false)}>
                  <Building2 className="w-4 h-4 mr-1" />
                  Create Business
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
