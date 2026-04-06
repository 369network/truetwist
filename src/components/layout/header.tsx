"use client";

import { Search, Menu } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { NotificationBell } from "./notification-bell";
import { BusinessSwitcher } from "./business-switcher";

export function Header() {
  const { toggleSidebar } = useAppStore();

  return (
    <header className="sticky top-0 z-40 flex items-center gap-4 h-16 px-4 md:px-6 border-b border-gray-200 dark:border-dark-border bg-white/80 dark:bg-dark-surface/80 backdrop-blur-xl">
      <button
        onClick={toggleSidebar}
        className="md:hidden p-2 rounded-md hover:bg-gray-100 dark:hover:bg-dark-surface-2"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Search */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search content, analytics..."
            className="w-full h-9 pl-9 pr-4 rounded-md bg-gray-50 dark:bg-dark-surface-2 border border-gray-200 dark:border-dark-border text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Business Switcher */}
        <BusinessSwitcher />

        {/* Notifications */}
        <NotificationBell />

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full gradient-brand flex items-center justify-center text-white text-sm font-semibold">
          T
        </div>
      </div>
    </header>
  );
}
