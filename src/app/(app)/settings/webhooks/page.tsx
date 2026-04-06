"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Webhook,
  Plus,
  Trash2,
  Pencil,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  AlertCircle,
  Copy,
  X,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";

interface WebhookEndpoint {
  id: string;
  url: string;
  description: string;
  events: string[];
  status: "active" | "failing" | "disabled";
  secret: string;
  createdAt: string;
  lastDelivery: {
    timestamp: string;
    status: number;
    duration: string;
    success: boolean;
  } | null;
  recentDeliveries: {
    id: string;
    event: string;
    timestamp: string;
    status: number;
    duration: string;
    success: boolean;
  }[];
}

const webhooks: WebhookEndpoint[] = [
  {
    id: "wh-1",
    url: "https://api.myapp.com/webhooks/truetwist",
    description: "Production webhook for post events",
    events: ["post.published", "post.failed", "post.scheduled"],
    status: "active",
    secret: "whsec_a1b2c3d4e5f6",
    createdAt: "Mar 10, 2026",
    lastDelivery: { timestamp: "2 min ago", status: 200, duration: "145ms", success: true },
    recentDeliveries: [
      { id: "d1", event: "post.published", timestamp: "2 min ago", status: 200, duration: "145ms", success: true },
      { id: "d2", event: "post.published", timestamp: "1 hour ago", status: 200, duration: "132ms", success: true },
      { id: "d3", event: "post.scheduled", timestamp: "3 hours ago", status: 200, duration: "198ms", success: true },
      { id: "d4", event: "post.failed", timestamp: "Yesterday", status: 200, duration: "210ms", success: true },
    ],
  },
  {
    id: "wh-2",
    url: "https://hooks.zapier.com/hooks/catch/12345/abcdef",
    description: "Zapier automation trigger",
    events: ["post.published", "analytics.report"],
    status: "failing",
    secret: "whsec_x7y8z9",
    createdAt: "Feb 28, 2026",
    lastDelivery: { timestamp: "1 hour ago", status: 500, duration: "3200ms", success: false },
    recentDeliveries: [
      { id: "d5", event: "post.published", timestamp: "1 hour ago", status: 500, duration: "3200ms", success: false },
      { id: "d6", event: "post.published", timestamp: "3 hours ago", status: 500, duration: "3100ms", success: false },
      { id: "d7", event: "analytics.report", timestamp: "Yesterday", status: 200, duration: "450ms", success: true },
    ],
  },
];

const availableEvents = [
  { category: "Posts", events: ["post.created", "post.scheduled", "post.published", "post.failed", "post.deleted"] },
  { category: "Analytics", events: ["analytics.report", "analytics.milestone"] },
  { category: "Team", events: ["team.member_joined", "team.member_removed", "team.invite_sent"] },
  { category: "Billing", events: ["billing.payment_success", "billing.payment_failed", "billing.subscription_changed"] },
  { category: "AI", events: ["ai.generation_complete", "ai.credits_low"] },
];

export default function WebhooksSettingsPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedWebhook, setExpandedWebhook] = useState<string | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  const toggleEvent = (event: string) => {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  const toggleCategory = (events: string[]) => {
    const allSelected = events.every((e) => selectedEvents.includes(e));
    if (allSelected) {
      setSelectedEvents((prev) => prev.filter((e) => !events.includes(e)));
    } else {
      setSelectedEvents((prev) => Array.from(new Set([...prev, ...events])));
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Webhooks</h2>
          <p className="text-sm text-gray-500 dark:text-dark-muted">Receive real-time event notifications to your endpoints</p>
        </div>
        <Button onClick={() => { setShowCreateModal(true); setSelectedEvents([]); }}>
          <Plus className="w-4 h-4 mr-1" />
          Add Endpoint
        </Button>
      </div>

      {/* Webhook Endpoints */}
      {webhooks.map((wh) => (
        <Card key={wh.id} className={wh.status === "failing" ? "border-red-200 dark:border-red-900/30" : ""}>
          <CardContent className="p-5">
            {/* Endpoint Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Webhook className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <code className="text-sm font-mono truncate">{wh.url}</code>
                  <Badge
                    variant={wh.status === "active" ? "success" : wh.status === "failing" ? "destructive" : "secondary"}
                  >
                    {wh.status}
                  </Badge>
                </div>
                {wh.description && (
                  <p className="text-xs text-gray-500 dark:text-dark-muted pl-6">{wh.description}</p>
                )}
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Button variant="ghost" size="sm"><Pencil className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Events & Last Delivery */}
            <div className="flex items-center gap-4 pl-6 mb-3">
              <div className="flex flex-wrap gap-1">
                {wh.events.map((ev) => (
                  <Badge key={ev} variant="secondary" className="text-[10px] font-mono">{ev}</Badge>
                ))}
              </div>
            </div>

            {wh.lastDelivery && (
              <div className="flex items-center gap-4 pl-6 text-xs text-gray-400 dark:text-dark-muted">
                <span className="flex items-center gap-1">
                  {wh.lastDelivery.success ? (
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                  ) : (
                    <XCircle className="w-3 h-3 text-red-500" />
                  )}
                  Last: {wh.lastDelivery.timestamp}
                </span>
                <span>HTTP {wh.lastDelivery.status}</span>
                <span>{wh.lastDelivery.duration}</span>
                {wh.status === "failing" && (
                  <Button variant="ghost" size="sm" className="text-xs text-brand-600 h-auto py-0.5">
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Retry
                  </Button>
                )}
              </div>
            )}

            {/* Expandable Delivery Log */}
            <div className="mt-3 pl-6">
              <button
                onClick={() => setExpandedWebhook(expandedWebhook === wh.id ? null : wh.id)}
                className="flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 hover:underline"
              >
                {expandedWebhook === wh.id ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
                Recent Deliveries ({wh.recentDeliveries.length})
              </button>

              {expandedWebhook === wh.id && (
                <div className="mt-2 space-y-1.5">
                  {wh.recentDeliveries.map((delivery) => (
                    <div
                      key={delivery.id}
                      className="flex items-center gap-3 p-2 rounded-md bg-gray-50 dark:bg-dark-surface-2 text-xs"
                    >
                      {delivery.success ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                      )}
                      <Badge variant="secondary" className="text-[10px] font-mono">{delivery.event}</Badge>
                      <span className="text-gray-500 dark:text-dark-muted">{delivery.timestamp}</span>
                      <span className={delivery.success ? "text-green-600" : "text-red-500"}>
                        {delivery.status}
                      </span>
                      <span className="text-gray-400">{delivery.duration}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Signing Secret */}
            <div className="mt-3 pl-6 flex items-center gap-2 text-xs text-gray-400">
              <span>Secret:</span>
              <code className="bg-gray-100 dark:bg-dark-surface-2 px-1.5 py-0.5 rounded font-mono">{wh.secret.slice(0, 8)}...</code>
              <button className="hover:text-gray-600"><Copy className="w-3 h-3" /></button>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Webhook Payload Example */}
      <Card>
        <CardHeader>
          <CardTitle>Payload Format</CardTitle>
          <CardDescription>Example webhook payload for a post.published event</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-900 dark:bg-dark-bg rounded-lg p-4 overflow-x-auto">
            <pre className="text-sm text-gray-300 font-mono">{`{
  "id": "evt_abc123",
  "type": "post.published",
  "created": "2026-04-05T12:00:00Z",
  "data": {
    "postId": "post_xyz789",
    "platform": "twitter",
    "url": "https://twitter.com/acme/status/...",
    "text": "Hello world! #marketing",
    "publishedAt": "2026-04-05T12:00:00Z"
  }
}`}</pre>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Copy className="w-3 h-3 mr-1" />
              Copy
            </Button>
            <span className="text-xs text-gray-400">
              Verify webhooks using the X-TrueTwist-Signature header
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Create Endpoint Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Add Webhook Endpoint</CardTitle>
                <button onClick={() => setShowCreateModal(false)} className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-dark-surface-2">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Endpoint URL *</label>
                <input
                  type="url"
                  placeholder="https://your-app.com/webhooks/truetwist"
                  className="w-full h-10 px-3 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Description</label>
                <input
                  type="text"
                  placeholder="What this endpoint is for..."
                  className="w-full h-10 px-3 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Events to Subscribe *</label>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {availableEvents.map((category) => (
                    <div key={category.category}>
                      <label className="flex items-center gap-2 mb-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={category.events.every((e) => selectedEvents.includes(e))}
                          onChange={() => toggleCategory(category.events)}
                          className="w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                        />
                        <span className="text-sm font-semibold">{category.category}</span>
                      </label>
                      <div className="ml-6 space-y-1">
                        {category.events.map((event) => (
                          <label key={event} className="flex items-center gap-2 cursor-pointer py-0.5">
                            <input
                              type="checkbox"
                              checked={selectedEvents.includes(event)}
                              onChange={() => toggleEvent(event)}
                              className="w-3.5 h-3.5 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                            />
                            <code className="text-xs font-mono text-gray-600 dark:text-dark-muted">{event}</code>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-md bg-gray-50 dark:bg-dark-surface-2 text-xs text-gray-500 dark:text-dark-muted">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                A signing secret will be generated automatically to verify webhook authenticity.
              </div>
              <div className="flex gap-2 justify-end pt-2 border-t border-gray-200 dark:border-dark-border">
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                <Button disabled={selectedEvents.length === 0} onClick={() => setShowCreateModal(false)}>
                  <Webhook className="w-4 h-4 mr-1" />
                  Create Endpoint
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
