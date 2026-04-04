"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

const socialPlatforms = [
  { id: "instagram", name: "Instagram", icon: "📷", color: "#e91e63" },
  { id: "twitter", name: "X (Twitter)", icon: "🐦", color: "#1da1f2" },
  { id: "facebook", name: "Facebook", icon: "📘", color: "#1877f2" },
  { id: "linkedin", name: "LinkedIn", icon: "💼", color: "#0077b5" },
  { id: "tiktok", name: "TikTok", icon: "🎵", color: "#00f2ea" },
];

export default function SettingsPage() {
  const [profile, setProfile] = useState<any>({ full_name: "", plan: "free" });
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data) setProfile(data);
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
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-2">Settings</h1>
      <p className="text-sm mb-8" style={{ color: "var(--tt-text-muted)" }}>Manage your account and connected platforms.</p>

      {/* Profile */}
      <div className="p-6 rounded-2xl mb-6" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
        <h3 className="font-semibold mb-4">Profile</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Full Name</label>
            <input type="text" value={profile.full_name || ""} onChange={e => setProfile({ ...profile, full_name: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Plan</label>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-full text-xs font-medium capitalize" style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc" }}>{profile.plan}</span>
              <button className="text-xs font-medium" style={{ color: "#a5b4fc" }}>Upgrade</button>
            </div>
          </div>
          <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition hover:-translate-y-0.5 disabled:opacity-50" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Connected Accounts */}
      <div className="p-6 rounded-2xl" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
        <h3 className="font-semibold mb-4">Connected Accounts</h3>
        <div className="space-y-3">
          {socialPlatforms.map(p => (
            <div key={p.id} className="flex items-center justify-between p-4 rounded-xl" style={{ background: "var(--tt-surface-2)" }}>
              <div className="flex items-center gap-3">
                <span className="text-xl">{p.icon}</span>
                <div>
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-xs" style={{ color: "var(--tt-text-muted)" }}>Not connected</div>
                </div>
              </div>
              <button className="px-4 py-2 rounded-lg text-xs font-medium transition" style={{ border: `1px solid ${p.color}40`, color: p.color }}>
                Connect
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
