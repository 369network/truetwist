"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Save } from "lucide-react";

export default function ProfileSettingsPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Business Information</CardTitle>
          <CardDescription>Update your business profile and brand details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Business Name</label>
              <input
                type="text"
                defaultValue="TrueTwist Agency"
                className="w-full h-10 px-3 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Industry</label>
              <input
                type="text"
                defaultValue="Digital Marketing"
                className="w-full h-10 px-3 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Business Description</label>
            <textarea
              defaultValue="AI-powered social media management platform helping businesses grow their online presence."
              className="w-full h-24 p-3 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Website</label>
            <input
              type="url"
              defaultValue="https://truetwist.com"
              className="w-full h-10 px-3 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Brand Assets</CardTitle>
          <CardDescription>Upload your logo and set brand colors</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Logo Upload */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Logo</label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-lg gradient-brand flex items-center justify-center text-white text-xl font-bold">
                TT
              </div>
              <Button variant="outline" size="sm">
                <Upload className="w-4 h-4 mr-1" />
                Upload Logo
              </Button>
            </div>
          </div>

          {/* Brand Colors */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Brand Colors</label>
            <div className="flex gap-3">
              {["#6366F1", "#4F46E5", "#FF6B6B", "#A855F7"].map((color) => (
                <div key={color} className="flex flex-col items-center gap-1">
                  <div className="w-10 h-10 rounded-md border-2 border-gray-200 dark:border-dark-border" style={{ backgroundColor: color }} />
                  <span className="text-[10px] text-gray-400 font-mono">{color}</span>
                </div>
              ))}
              <button className="w-10 h-10 rounded-md border-2 border-dashed border-gray-300 dark:border-dark-border flex items-center justify-center text-gray-400 hover:border-brand-500 hover:text-brand-500 transition-colors">
                +
              </button>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-dark-border">
            <Button>
              <Save className="w-4 h-4 mr-1" />
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
