"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Key,
  Plus,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Clock,
  Shield,
  X,
} from "lucide-react";

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsed: string | null;
  expiresAt: string | null;
  scopes: string[];
  status: "active" | "expired" | "revoked";
}

const apiKeys: ApiKey[] = [
  {
    id: "key-1",
    name: "Production App",
    prefix: "tt_live_abc1",
    createdAt: "Mar 15, 2026",
    lastUsed: "2 hours ago",
    expiresAt: null,
    scopes: ["posts:read", "posts:write", "analytics:read"],
    status: "active",
  },
  {
    id: "key-2",
    name: "Development",
    prefix: "tt_test_xyz9",
    createdAt: "Feb 20, 2026",
    lastUsed: "5 days ago",
    expiresAt: "Jun 20, 2026",
    scopes: ["posts:read", "posts:write", "analytics:read", "ai:generate"],
    status: "active",
  },
  {
    id: "key-3",
    name: "Legacy Integration",
    prefix: "tt_live_old4",
    createdAt: "Dec 1, 2025",
    lastUsed: "2 months ago",
    expiresAt: "Mar 1, 2026",
    scopes: ["posts:read"],
    status: "expired",
  },
];

const availableScopes = [
  { id: "posts:read", label: "Read Posts", description: "View posts and content" },
  { id: "posts:write", label: "Write Posts", description: "Create, edit, delete posts" },
  { id: "analytics:read", label: "Read Analytics", description: "View analytics data" },
  { id: "ai:generate", label: "AI Generation", description: "Use AI content generation" },
  { id: "social:manage", label: "Manage Social", description: "Connect/disconnect accounts" },
  { id: "team:read", label: "Read Team", description: "View team members" },
  { id: "team:manage", label: "Manage Team", description: "Invite/remove members" },
  { id: "billing:read", label: "Read Billing", description: "View billing info" },
];

export default function ApiKeysSettingsPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyVisible, setNewKeyVisible] = useState(false);
  const [newKeyValue] = useState("tt_live_sk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0");
  const [showNewKey, setShowNewKey] = useState(false);
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleScope = (scopeId: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scopeId) ? prev.filter((s) => s !== scopeId) : [...prev, scopeId]
    );
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">API Keys</h2>
          <p className="text-sm text-gray-500 dark:text-dark-muted">Generate and manage API keys for programmatic access</p>
        </div>
        <Button onClick={() => { setShowCreateModal(true); setShowNewKey(false); setSelectedScopes([]); }}>
          <Plus className="w-4 h-4 mr-1" />
          Create API Key
        </Button>
      </div>

      {/* Security Notice */}
      <div className="flex items-start gap-2 p-3 rounded-md bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/30 text-sm">
        <Shield className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium text-yellow-700 dark:text-yellow-400">Keep your API keys secure</p>
          <p className="text-yellow-600 dark:text-yellow-500 text-xs mt-0.5">
            Never share API keys in public repositories, client-side code, or unencrypted channels. Rotate keys periodically.
          </p>
        </div>
      </div>

      {/* Keys List */}
      <Card>
        <CardHeader>
          <CardTitle>Your API Keys</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-gray-100 dark:divide-dark-border">
            {apiKeys.map((key) => (
              <div key={key.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Key className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-sm">{key.name}</span>
                      <Badge
                        variant={key.status === "active" ? "success" : key.status === "expired" ? "warning" : "destructive"}
                      >
                        {key.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <code className="text-xs font-mono bg-gray-100 dark:bg-dark-surface-2 px-2 py-0.5 rounded">
                        {key.prefix}...
                      </code>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {key.scopes.map((scope) => (
                        <Badge key={scope} variant="secondary" className="text-[10px]">
                          {scope}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-dark-muted">
                      <span>Created: {key.createdAt}</span>
                      {key.lastUsed && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Last used: {key.lastUsed}
                        </span>
                      )}
                      {key.expiresAt && (
                        <span className={key.status === "expired" ? "text-red-400" : ""}>
                          Expires: {key.expiresAt}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {key.status === "active" && (
                      <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50 text-xs">
                        <Trash2 className="w-3 h-3 mr-1" />
                        Revoke
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* API Usage */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Start</CardTitle>
          <CardDescription>Use your API key to authenticate requests</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-900 dark:bg-dark-bg rounded-lg p-4 overflow-x-auto">
            <pre className="text-sm text-gray-300 font-mono">
              <span className="text-green-400">curl</span> -X POST https://api.truetwist.com/v1/posts \{"\n"}
              {"  "}-H <span className="text-yellow-300">&quot;Authorization: Bearer tt_live_sk_...&quot;</span> \{"\n"}
              {"  "}-H <span className="text-yellow-300">&quot;Content-Type: application/json&quot;</span> \{"\n"}
              {"  "}-d <span className="text-yellow-300">&apos;{`{"text": "Hello world!", "platforms": ["twitter"]}`}&apos;</span>
            </pre>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy}>
              <Copy className="w-3 h-3 mr-1" />
              {copied ? "Copied!" : "Copy"}
            </Button>
            <span className="text-xs text-gray-400">
              Full API documentation at docs.truetwist.com
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Create Key Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{showNewKey ? "API Key Created" : "Create API Key"}</CardTitle>
                <button onClick={() => setShowCreateModal(false)} className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-dark-surface-2">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {showNewKey ? (
                /* Key Created View */
                <>
                  <div className="flex items-center gap-2 p-3 rounded-md bg-green-50 dark:bg-green-900/10 text-sm text-green-600">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    API key created successfully
                  </div>
                  <div className="p-3 rounded-md bg-gray-50 dark:bg-dark-surface-2 border border-gray-200 dark:border-dark-border">
                    <p className="text-xs text-gray-500 mb-2">Your API key (copy it now - it won&apos;t be shown again):</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs font-mono break-all">
                        {newKeyVisible ? newKeyValue : "tt_live_sk_" + "•".repeat(40)}
                      </code>
                      <button onClick={() => setNewKeyVisible(!newKeyVisible)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                        {newKeyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-2.5 rounded-md bg-yellow-50 dark:bg-yellow-900/10 text-xs text-yellow-600">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    This is the only time this key will be displayed. Store it securely.
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={handleCopy}>
                      <Copy className="w-3 h-3 mr-1" />
                      {copied ? "Copied!" : "Copy Key"}
                    </Button>
                    <Button size="sm" onClick={() => setShowCreateModal(false)}>Done</Button>
                  </div>
                </>
              ) : (
                /* Create Form */
                <>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Key Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Production App"
                      className="w-full h-10 px-3 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Expiration</label>
                    <select className="w-full h-10 px-3 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                      <option value="">Never</option>
                      <option value="30">30 days</option>
                      <option value="90">90 days</option>
                      <option value="180">6 months</option>
                      <option value="365">1 year</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Permissions</label>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {availableScopes.map((scope) => (
                        <label
                          key={scope.id}
                          className="flex items-center gap-3 p-2.5 rounded-md border border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-surface-2 cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedScopes.includes(scope.id)}
                            onChange={() => toggleScope(scope.id)}
                            className="w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{scope.label}</p>
                            <p className="text-xs text-gray-400">{scope.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end pt-2 border-t border-gray-200 dark:border-dark-border">
                    <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                    <Button onClick={() => setShowNewKey(true)}>
                      <Key className="w-4 h-4 mr-1" />
                      Generate Key
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
