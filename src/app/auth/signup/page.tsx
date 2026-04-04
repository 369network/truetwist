"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName } }
    });
    if (error) { setError(error.message); setLoading(false); return; }
    setSuccess(true);
    setTimeout(() => router.push("/dashboard"), 1500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--tt-bg)" }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg" style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}>T</div>
            <span className="text-2xl font-bold">TrueTwist</span>
          </Link>
          <h1 className="text-2xl font-bold">Create your account</h1>
          <p className="text-sm mt-1" style={{ color: "var(--tt-text-muted)" }}>Start creating viral content today</p>
        </div>
        <form onSubmit={handleSignup} className="p-8 rounded-2xl space-y-5" style={{ background: "var(--tt-surface)", border: "1px solid var(--tt-border)" }}>
          {error && <div className="p-3 rounded-lg text-sm text-red-400" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>{error}</div>}
          {success && <div className="p-3 rounded-lg text-sm text-green-400" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)" }}>Account created! Redirecting to dashboard...</div>}
          <div>
            <label className="block text-sm font-medium mb-2">Full Name</label>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your name" required className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" required minLength={6} className="input-field" />
          </div>
          <button type="submit" disabled={loading} className="w-full py-3 rounded-xl text-white font-semibold transition hover:-translate-y-0.5 disabled:opacity-50" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
            {loading ? "Creating account..." : "Create Account"}
          </button>
          <p className="text-center text-sm" style={{ color: "var(--tt-text-muted)" }}>
            Already have an account? <Link href="/auth/login" className="font-medium" style={{ color: "#a5b4fc" }}>Log in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
