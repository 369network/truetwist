"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: "📊" },
  { href: "/dashboard/generate", label: "AI Generate", icon: "✨" },
  { href: "/dashboard/posts", label: "Posts", icon: "📝" },
  { href: "/dashboard/calendar", label: "Calendar", icon: "📅" },
  { href: "/dashboard/analytics", label: "Analytics", icon: "📈" },
  { href: "/dashboard/settings", label: "Settings", icon: "⚙️" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push("/auth/login");
      else setUser(data.user);
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <div className="min-h-screen flex" style={{ background: "var(--tt-bg)" }}>
      {/* Sidebar */}
      <aside className="w-64 shrink-0 p-4 hidden md:flex flex-col" style={{ borderRight: "1px solid var(--tt-border)" }}>
        <Link href="/" className="flex items-center gap-2 mb-8 px-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}>T</div>
          <span className="text-lg font-bold">TrueTwist</span>
        </Link>
        <nav className="flex-1 space-y-1">
          {navItems.map(item => (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${pathname === item.href ? "text-white" : ""}`}
              style={{
                background: pathname === item.href ? "rgba(99,102,241,0.15)" : "transparent",
                color: pathname === item.href ? "white" : "var(--tt-text-muted)",
              }}>
              <span>{item.icon}</span> {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto pt-4" style={{ borderTop: "1px solid var(--tt-border)" }}>
          <div className="px-3 py-2 text-sm" style={{ color: "var(--tt-text-muted)" }}>
            {user?.email}
          </div>
          <button onClick={handleLogout} className="w-full px-3 py-2 rounded-xl text-sm text-left transition hover:bg-red-500/10 text-red-400">
            Log out
          </button>
        </div>
      </aside>
      {/* Main */}
      <main className="flex-1 p-6 md:p-8 overflow-auto">{children}</main>
    </div>
  );
}
