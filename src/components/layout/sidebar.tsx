"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import {
  LayoutDashboard,
  Wand2,
  CalendarDays,
  BarChart3,
  Settings,
  ChevronLeft,
  Zap,
  Moon,
  Sun,
  Flame,
  FlaskConical,
  Video,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/content-studio", label: "Content Studio", icon: Wand2 },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/trends", label: "Viral Trends", icon: Flame },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/ab-testing", label: "A/B Testing", icon: FlaskConical },
  { href: "/video-ab-testing", label: "Video A/B Testing", icon: Video },
  { href: "/settings/profile", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar, darkMode, toggleDarkMode } = useAppStore();

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col h-screen border-r border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface transition-all duration-300 sticky top-0",
        sidebarOpen ? "w-64" : "w-[68px]"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-gray-200 dark:border-dark-border">
        <div className="w-8 h-8 rounded-lg gradient-brand flex items-center justify-center flex-shrink-0">
          <Zap className="w-5 h-5 text-white" />
        </div>
        {sidebarOpen && (
          <span className="font-bold text-lg bg-gradient-to-r from-brand-600 to-purple-600 bg-clip-text text-transparent">
            TrueTwist
          </span>
        )}
        <button
          onClick={toggleSidebar}
          className={cn(
            "ml-auto p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-dark-surface-2 transition-colors",
            !sidebarOpen && "ml-0"
          )}
        >
          <ChevronLeft
            className={cn("w-4 h-4 text-gray-400 transition-transform", !sidebarOpen && "rotate-180")}
          />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400"
                  : "text-gray-600 dark:text-dark-muted hover:bg-gray-50 dark:hover:bg-dark-surface-2 hover:text-gray-900 dark:hover:text-dark-text"
              )}
            >
              <item.icon className={cn("w-5 h-5 flex-shrink-0", isActive && "text-brand-500")} />
              {sidebarOpen && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Dark mode toggle */}
      <div className="p-3 border-t border-gray-200 dark:border-dark-border">
        <button
          onClick={toggleDarkMode}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm text-gray-600 dark:text-dark-muted hover:bg-gray-50 dark:hover:bg-dark-surface-2 transition-colors"
        >
          {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          {sidebarOpen && <span>{darkMode ? "Light Mode" : "Dark Mode"}</span>}
        </button>
      </div>
    </aside>
  );
}
