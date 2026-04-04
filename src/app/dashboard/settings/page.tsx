"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

/* ─── TRUA-41: Settings — Profile, Billing, Team, Notifications, API Keys ─── */

const tabs = [
  { id: "profile", label: "Profile" },
  { id: "accounts", label: "Accounts" },
  { id: "billing", label: "Billing" },
  { id: "team", label: "Team" },
  { id: "notifications", label: "Notifications" },
  { id: "api", label: "API Keys" },
];

const socialPlatforms = [
  { id: "instagram", name: "Instagram", color: "#E4405F", connected: false },
  { id: "twitter", name: "X (Twitter)", color: "#1DA1F2", connected: false },
  { id: "facebook", name: "Facebook", color: "#1877F2", connected: false },
  { id: "linkedin", name: "LinkedIn", color: "#0A66C2", connected: false },
  { id: "tiktok", name: "TikTok", color: "#ff0050", connected: false },
];

const plans = [
  { name: "Free", price: "$0", period: "forever", features: ["5 AI posts/month", "1 social account", "Basic templates"], current: true },
  { name: "Starter", price: "$29", period: "/mo", features: ["50 AI posts/month", "3 social accounts", "Smart scheduling", "Basic analytics"], current: false },
  { name: "Pro", price: "$79", period: "/mo", features: ["Unlimited AI posts", "10 accounts", "Advanced AI", "Full analytics", "Priority support"], current: false, popular: true },
  { name: "Business", price: "$199", period: "/mo", features: ["Everything in Pro", "Unlimited accounts", "Team collaboration", "API access", "Dedicated manager"], current: false },
];

const notificationTypes = [
  { id: "post_published", label: "Post Published", desc: "When a scheduled post goes live" },
  { id: "post_failed", label: "Post Failed", desc: "When a post fails to publish" },
  { id: "engagement_spike", label: "Engagement Spike", desc: "When a post gets unusual engagement" },
  { id: "trend_alert", label: "Trend Alert", desc: "When a trend matches your niche" },
  { id: "weekly_report", label: "Weekly Report", desc: "Summary of your weekly performance" },
  { id: "credit_low", label: "Credits Running Low", desc: "When AI credits drop below 20%" },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("profile");
  const [profile, setProfile] = useState<any>({ full_name: "", plan: "free" });
  const [saving, setSaving] = useState(false);
  const [notifications, setNotifications] = useState<Record<string, { email: boolean; push: boolean }>>({});
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data) setProfile(data);
      // Init notification prefs
      const notifPrefs: Record<string, { email: boolean; push: boolean }> = {};
      notificationTypes.forEach(n => { notifPrefs[n.id] = { email: true, push: false }; });
      setNotifications(notifPrefs);
    }
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("profiles").update({ full_name: profile.full_name }).eq("id", user.id);
    setSaving(false);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-heading)" }}>Settings</h1>
      <p className="text-sm mb-8" style={{ color: "var(--tt-text-muted)" }}>Manage your account, billing, and preferences.</p>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-8 overflow-x-auto pb-1" style={{ borderBottom: "1px solid var(--tt-border)" }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap relative"
            style={{
              color: activeTab === tab.id ? "#a5b4fc" : "var(--tt-text-muted)",
            }}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: "#6366f1" }} />
            )}
          </button>
        ))}
      </div>

      {/* ─── Profile Tab ─── */}
      {activeTab === "profile" && (
        <div className="max-w-2xl space-y-6">
          <div className="p-6 rounded-2xl" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
            <h3 className="font-semibold mb-4" style={{ fontFamily: "var(--font-heading)" }}>Profile Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Full Name</label>
                <input
                  type="text"
                  value={profile.full_name || ""}
                  onChange={e => setProfile({ ...profile, full_name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition"
                  style={{ background: "var(--tt-surface-2)", border: "1px solid var(--tt-border)", color: "var(--tt-text)" }}
                  placeholder="Your full name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  value={profile.email || ""}
                  disabled
                  className="w-full px-4 py-2.5 rounded-xl text-sm opacity-60"
                  style={{ background: "var(--tt-surface-2)", border: "1px solid var(--tt-border)", color: "var(--tt-text)" }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Current Plan</label>
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-full text-xs font-medium capitalize" style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc" }}>
                    {profile.plan || "Free"}
                  </span>
                  <button onClick={() => setActiveTab("billing")} className="text-xs font-medium transition hover:underline" style={{ color: "#a5b4fc" }}>
                    Upgrade
                  </button>
                </div>
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>

          <div className="p-6 rounded-2xl" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
            <h3 className="font-semibold mb-4" style={{ fontFamily: "var(--font-heading)" }}>Password</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Current Password</label>
                <input type="password" className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--tt-surface-2)", border: "1px solid var(--tt-border)", color: "var(--tt-text)" }} placeholder="Enter current password" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">New Password</label>
                <input type="password" className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--tt-surface-2)", border: "1px solid var(--tt-border)", color: "var(--tt-text)" }} placeholder="Enter new password" />
              </div>
              <button className="px-5 py-2.5 rounded-xl text-sm font-semibold transition" style={{ background: "var(--tt-surface-2)", border: "1px solid var(--tt-border)", color: "var(--tt-text)" }}>
                Update Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Accounts Tab ─── */}
      {activeTab === "accounts" && (
        <div className="max-w-2xl">
          <div className="p-6 rounded-2xl" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
            <h3 className="font-semibold mb-4" style={{ fontFamily: "var(--font-heading)" }}>Connected Accounts</h3>
            <p className="text-sm mb-6" style={{ color: "var(--tt-text-muted)" }}>Connect your social media accounts to start posting.</p>
            <div className="space-y-3">
              {socialPlatforms.map(p => (
                <div key={p.id} className="flex items-center justify-between p-4 rounded-xl" style={{ background: "var(--tt-surface-2)" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${p.color}15` }}>
                      <div className="w-3 h-3 rounded-full" style={{ background: p.color }} />
                    </div>
                    <div>
                      <div className="text-sm font-medium">{p.name}</div>
                      <div className="text-xs" style={{ color: p.connected ? "#10b981" : "var(--tt-text-muted)" }}>
                        {p.connected ? "Connected" : "Not connected"}
                      </div>
                    </div>
                  </div>
                  <button
                    className="px-4 py-2 rounded-lg text-xs font-medium transition"
                    style={{
                      border: `1px solid ${p.color}40`,
                      color: p.color,
                    }}
                  >
                    {p.connected ? "Disconnect" : "Connect"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Billing Tab (TRUA-37/41) ─── */}
      {activeTab === "billing" && (
        <div className="space-y-6">
          {/* Current Plan */}
          <div className="p-6 rounded-2xl" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold" style={{ fontFamily: "var(--font-heading)" }}>Current Plan</h3>
              <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc" }}>Free</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 rounded-xl text-center" style={{ background: "var(--tt-surface-2)" }}>
                <div className="text-lg font-bold" style={{ color: "#6366f1" }}>3/5</div>
                <div className="text-xs" style={{ color: "var(--tt-text-muted)" }}>AI Posts Used</div>
              </div>
              <div className="p-3 rounded-xl text-center" style={{ background: "var(--tt-surface-2)" }}>
                <div className="text-lg font-bold" style={{ color: "#a855f7" }}>0/1</div>
                <div className="text-xs" style={{ color: "var(--tt-text-muted)" }}>Accounts Connected</div>
              </div>
              <div className="p-3 rounded-xl text-center" style={{ background: "var(--tt-surface-2)" }}>
                <div className="text-lg font-bold" style={{ color: "#10b981" }}>Free</div>
                <div className="text-xs" style={{ color: "var(--tt-text-muted)" }}>Current Tier</div>
              </div>
            </div>
          </div>

          {/* Plan Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map((plan, i) => (
              <div
                key={i}
                className={`p-6 rounded-2xl relative ${plan.popular ? "animate-pulse-glow" : ""}`}
                style={{
                  background: "var(--tt-surface)",
                  border: plan.popular ? "2px solid #6366f1" : plan.current ? "2px solid #10b981" : "1px solid var(--tt-border)",
                }}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold text-white" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
                    Recommended
                  </div>
                )}
                {plan.current && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold text-white" style={{ background: "#10b981" }}>
                    Current
                  </div>
                )}
                <h4 className="font-semibold mb-1">{plan.name}</h4>
                <div className="mb-4">
                  <span className="text-3xl font-extrabold" style={{ fontFamily: "var(--font-heading)" }}>{plan.price}</span>
                  <span className="text-xs" style={{ color: "var(--tt-text-muted)" }}>{plan.period}</span>
                </div>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-xs">
                      <span style={{ color: "#10b981" }}>&#10003;</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  className={`w-full py-2.5 rounded-xl text-sm font-semibold transition ${plan.current ? "" : plan.popular ? "btn-primary" : ""}`}
                  style={plan.current ? { background: "var(--tt-surface-2)", color: "var(--tt-text-muted)", border: "1px solid var(--tt-border)" } : !plan.popular ? { background: "var(--tt-surface-2)", border: "1px solid var(--tt-border)", color: "white" } : {}}
                  disabled={plan.current}
                >
                  {plan.current ? "Current Plan" : "Upgrade"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Team Tab (TRUA-38/41) ─── */}
      {activeTab === "team" && (
        <div className="max-w-3xl space-y-6">
          <div className="p-6 rounded-2xl" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold" style={{ fontFamily: "var(--font-heading)" }}>Team Members</h3>
              <button className="btn-primary px-4 py-2 text-sm">Invite Member</button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: "var(--tt-surface-2)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold text-white" style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}>
                    {profile?.full_name?.[0] || "U"}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{profile?.full_name || "You"}</div>
                    <div className="text-xs" style={{ color: "var(--tt-text-muted)" }}>{profile?.email}</div>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc" }}>Owner</span>
              </div>
            </div>
            <div className="mt-6 p-4 rounded-xl text-center" style={{ background: "var(--tt-surface-2)", border: "1px dashed var(--tt-border)" }}>
              <p className="text-sm" style={{ color: "var(--tt-text-muted)" }}>
                Team collaboration is available on Business plan and above.
              </p>
              <button onClick={() => setActiveTab("billing")} className="text-xs font-medium mt-2" style={{ color: "#a5b4fc" }}>
                Upgrade to Business
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Notifications Tab ─── */}
      {activeTab === "notifications" && (
        <div className="max-w-2xl">
          <div className="p-6 rounded-2xl" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
            <h3 className="font-semibold mb-6" style={{ fontFamily: "var(--font-heading)" }}>Notification Preferences</h3>
            <div className="space-y-1">
              <div className="grid grid-cols-[1fr,60px,60px] gap-4 mb-3 text-xs font-medium" style={{ color: "var(--tt-text-muted)" }}>
                <span>Notification</span>
                <span className="text-center">Email</span>
                <span className="text-center">Push</span>
              </div>
              {notificationTypes.map((n) => (
                <div key={n.id} className="grid grid-cols-[1fr,60px,60px] gap-4 items-center py-3" style={{ borderTop: "1px solid var(--tt-border)" }}>
                  <div>
                    <div className="text-sm font-medium">{n.label}</div>
                    <div className="text-xs" style={{ color: "var(--tt-text-muted)" }}>{n.desc}</div>
                  </div>
                  <div className="flex justify-center">
                    <button
                      onClick={() => setNotifications(prev => ({
                        ...prev,
                        [n.id]: { ...prev[n.id], email: !prev[n.id]?.email }
                      }))}
                      className="w-9 h-5 rounded-full transition-colors relative"
                      style={{ background: notifications[n.id]?.email ? "#6366f1" : "var(--tt-surface-3)" }}
                    >
                      <div
                        className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                        style={{ left: notifications[n.id]?.email ? "18px" : "2px" }}
                      />
                    </button>
                  </div>
                  <div className="flex justify-center">
                    <button
                      onClick={() => setNotifications(prev => ({
                        ...prev,
                        [n.id]: { ...prev[n.id], push: !prev[n.id]?.push }
                      }))}
                      className="w-9 h-5 rounded-full transition-colors relative"
                      style={{ background: notifications[n.id]?.push ? "#6366f1" : "var(--tt-surface-3)" }}
                    >
                      <div
                        className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                        style={{ left: notifications[n.id]?.push ? "18px" : "2px" }}
                      />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── API Keys Tab (TRUA-39/41) ─── */}
      {activeTab === "api" && (
        <div className="max-w-3xl space-y-6">
          <div className="p-6 rounded-2xl" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold" style={{ fontFamily: "var(--font-heading)" }}>API Keys</h3>
                <p className="text-xs mt-1" style={{ color: "var(--tt-text-muted)" }}>Manage your API keys for programmatic access.</p>
              </div>
              <button className="btn-primary px-4 py-2 text-sm">Generate Key</button>
            </div>

            <div className="p-4 rounded-xl text-center" style={{ background: "var(--tt-surface-2)", border: "1px dashed var(--tt-border)" }}>
              <svg className="w-12 h-12 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="var(--tt-text-muted)" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
              </svg>
              <p className="text-sm mb-2" style={{ color: "var(--tt-text-muted)" }}>No API keys yet</p>
              <p className="text-xs" style={{ color: "var(--tt-text-muted)" }}>API access is available on Pro plan and above.</p>
              <button onClick={() => setActiveTab("billing")} className="text-xs font-medium mt-2" style={{ color: "#a5b4fc" }}>
                Upgrade to Pro
              </button>
            </div>
          </div>

          {/* Webhooks */}
          <div className="p-6 rounded-2xl" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
            <h3 className="font-semibold mb-4" style={{ fontFamily: "var(--font-heading)" }}>Webhooks</h3>
            <p className="text-xs mb-4" style={{ color: "var(--tt-text-muted)" }}>
              Receive real-time notifications when events happen in your account.
            </p>
            <div className="p-4 rounded-xl text-center" style={{ background: "var(--tt-surface-2)", border: "1px dashed var(--tt-border)" }}>
              <p className="text-sm" style={{ color: "var(--tt-text-muted)" }}>
                Webhooks require an active API key. Generate one above to get started.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
