"use client";

import { useState, useRef, useEffect } from "react";
import { Building2, ChevronDown, Plus, Check } from "lucide-react";
import { useBusinessStore } from "@/stores/business-store";

export function BusinessSwitcher() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { businesses, activeBusiness, setActiveBusiness } = useBusinessStore();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (businesses.length <= 1) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 h-9 px-3 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 hover:bg-gray-50 dark:hover:bg-dark-surface text-sm transition-colors"
      >
        <Building2 className="w-4 h-4 text-gray-400" />
        <span className="max-w-[140px] truncate font-medium">
          {activeBusiness?.name || "Select Business"}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-dark-surface-2 rounded-lg shadow-lg border border-gray-200 dark:border-dark-border py-1 z-50">
          <div className="px-3 py-2 text-xs font-medium text-gray-400 dark:text-dark-muted uppercase tracking-wider">
            Your Businesses
          </div>
          {businesses.map((biz) => (
            <button
              key={biz.id}
              onClick={() => {
                setActiveBusiness(biz);
                setOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-dark-surface transition-colors"
            >
              <div
                className="w-8 h-8 rounded-md flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ backgroundColor: biz.colors?.primary || "#3B82F6" }}
              >
                {biz.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium truncate">{biz.name}</p>
                {biz.industry && (
                  <p className="text-xs text-gray-400 dark:text-dark-muted truncate">{biz.industry}</p>
                )}
              </div>
              {activeBusiness?.id === biz.id && (
                <Check className="w-4 h-4 text-brand-500 flex-shrink-0" />
              )}
            </button>
          ))}
          <div className="border-t border-gray-200 dark:border-dark-border mt-1 pt-1">
            <button className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-brand-600 dark:text-brand-400 hover:bg-gray-50 dark:hover:bg-dark-surface transition-colors">
              <Plus className="w-4 h-4" />
              Add New Business
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
