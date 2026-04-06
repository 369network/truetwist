"use client";

import { create } from "zustand";

export interface BusinessInfo {
  id: string;
  name: string;
  industry?: string | null;
  logoUrl?: string | null;
  colors?: { primary?: string; secondary?: string; accent?: string };
}

interface BusinessState {
  businesses: BusinessInfo[];
  activeBusiness: BusinessInfo | null;
  setBusinesses: (businesses: BusinessInfo[]) => void;
  setActiveBusiness: (business: BusinessInfo) => void;
}

export const useBusinessStore = create<BusinessState>((set) => ({
  businesses: [
    { id: "demo-1", name: "Acme Corp", industry: "Technology", colors: { primary: "#3B82F6" } },
    { id: "demo-2", name: "Fresh Bakery", industry: "Food & Beverage", colors: { primary: "#10B981" } },
    { id: "demo-3", name: "Style Studio", industry: "Fashion", colors: { primary: "#8B5CF6" } },
  ],
  activeBusiness: { id: "demo-1", name: "Acme Corp", industry: "Technology", colors: { primary: "#3B82F6" } },
  setBusinesses: (businesses) => set({ businesses }),
  setActiveBusiness: (business) => set({ activeBusiness: business }),
}));
