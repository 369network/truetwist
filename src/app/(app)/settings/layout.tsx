"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  User,
  Share2,
  CreditCard,
  Users,
  Building2,
  Bell,
  Key,
  Webhook,
  Shield,
} from "lucide-react";

const settingsTabs = [
  { href: "/settings/profile", label: "Business Profile", icon: User },
  { href: "/settings/accounts", label: "Social Accounts", icon: Share2 },
  { href: "/settings/billing", label: "Billing", icon: CreditCard },
  { href: "/settings/team", label: "Team", icon: Users },
  { href: "/settings/business", label: "Businesses", icon: Building2 },
  { href: "/settings/account", label: "Account", icon: Shield },
  { href: "/settings/notifications", label: "Notifications", icon: Bell },
  { href: "/settings/api-keys", label: "API Keys", icon: Key },
  { href: "/settings/webhooks", label: "Webhooks", icon: Webhook },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-gray-500 dark:text-dark-muted mt-1">Manage your account and preferences</p>
      </div>

      <div className="flex gap-1 border-b border-gray-200 dark:border-dark-border overflow-x-auto scrollbar-hide">
        {settingsTabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex items-center gap-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px",
              pathname === tab.href || pathname.startsWith(tab.href + "/")
                ? "border-brand-500 text-brand-600 dark:text-brand-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-dark-muted dark:hover:text-dark-text"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </Link>
        ))}
      </div>

      {children}
    </div>
  );
}
