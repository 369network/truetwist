"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Lock,
  Shield,
  Smartphone,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Save,
  LogOut,
  Copy,
  X,
} from "lucide-react";

export default function AccountSettingsPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [show2faModal, setShow2faModal] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Profile Info */}
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Your account details and profile settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full gradient-brand flex items-center justify-center text-white text-xl font-bold">
              AJ
            </div>
            <div>
              <Button variant="outline" size="sm">Change Avatar</Button>
              <p className="text-xs text-gray-400 mt-1">JPG, PNG or GIF. Max 2MB.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">First Name</label>
              <input
                type="text"
                defaultValue="Alex"
                className="w-full h-10 px-3 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Last Name</label>
              <input
                type="text"
                defaultValue="Johnson"
                className="w-full h-10 px-3 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Email Address</label>
            <div className="flex gap-2">
              <input
                type="email"
                defaultValue="alex@truetwist.com"
                className="flex-1 h-10 px-3 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <Badge variant="success" className="self-center">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Verified
              </Badge>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Phone Number</label>
            <input
              type="tel"
              defaultValue="+1 (555) 123-4567"
              className="w-full h-10 px-3 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Timezone</label>
            <select className="w-full h-10 px-3 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option>America/Los_Angeles (PST, UTC-8)</option>
              <option>America/New_York (EST, UTC-5)</option>
              <option>America/Chicago (CST, UTC-6)</option>
              <option>Europe/London (GMT, UTC+0)</option>
              <option>Europe/Berlin (CET, UTC+1)</option>
              <option>Asia/Tokyo (JST, UTC+9)</option>
            </select>
          </div>
          <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-dark-border">
            <Button>
              <Save className="w-4 h-4 mr-1" />
              Save Profile
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-gray-400" />
            <div>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your password to keep your account secure</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Current Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter current password"
                className="w-full h-10 px-3 pr-10 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">New Password</label>
            <input
              type="password"
              placeholder="Enter new password"
              className="w-full h-10 px-3 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <p className="text-xs text-gray-400 mt-1.5">Min 8 characters, include uppercase, lowercase, and a number</p>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Confirm New Password</label>
            <input
              type="password"
              placeholder="Re-enter new password"
              className="w-full h-10 px-3 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div className="flex justify-end">
            <Button>Update Password</Button>
          </div>
        </CardContent>
      </Card>

      {/* Two-Factor Auth */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-gray-400" />
              <div>
                <CardTitle>Two-Factor Authentication</CardTitle>
                <CardDescription>Add an extra layer of security to your account</CardDescription>
              </div>
            </div>
            <Badge variant={twoFactorEnabled ? "success" : "warning"}>
              {twoFactorEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {twoFactorEnabled ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 rounded-md bg-green-50 dark:bg-green-900/10 text-sm text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                Two-factor authentication is enabled via authenticator app.
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Recovery Codes</p>
                <p className="text-xs text-gray-500 dark:text-dark-muted mb-3">
                  Store these codes in a safe place. Each code can only be used once.
                </p>
                <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 dark:bg-dark-surface-2 rounded-md font-mono text-xs">
                  <span>a1b2-c3d4-e5f6</span>
                  <span>g7h8-i9j0-k1l2</span>
                  <span>m3n4-o5p6-q7r8</span>
                  <span>s9t0-u1v2-w3x4</span>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button variant="outline" size="sm">
                    <Copy className="w-3 h-3 mr-1" />
                    Copy Codes
                  </Button>
                  <Button variant="outline" size="sm">Regenerate</Button>
                </div>
              </div>
              <Button variant="destructive" size="sm" onClick={() => setTwoFactorEnabled(false)}>
                Disable 2FA
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 rounded-md bg-yellow-50 dark:bg-yellow-900/10 text-sm text-yellow-600 dark:text-yellow-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                We strongly recommend enabling 2FA to protect your account.
              </div>
              <div className="flex gap-3">
                <Button onClick={() => setShow2faModal(true)}>
                  <Smartphone className="w-4 h-4 mr-1" />
                  Set Up Authenticator App
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2FA Setup Modal */}
      {show2faModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Set Up 2FA</CardTitle>
                <button onClick={() => setShow2faModal(false)} className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-dark-surface-2">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-500 dark:text-dark-muted">
                Scan the QR code below with your authenticator app (Google Authenticator, Authy, etc.)
              </p>
              {/* QR Code placeholder */}
              <div className="flex justify-center">
                <div className="w-48 h-48 bg-gray-100 dark:bg-dark-surface-2 rounded-lg flex items-center justify-center border border-gray-200 dark:border-dark-border">
                  <div className="text-center">
                    <Shield className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-xs text-gray-400">QR Code</p>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Or enter this code manually:</p>
                <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-dark-surface-2 rounded-md">
                  <code className="text-sm font-mono flex-1">JBSWY3DPEHPK3PXP</code>
                  <Button variant="ghost" size="sm">
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Verification Code</label>
                <input
                  type="text"
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  className="w-full h-10 px-3 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 text-sm font-mono text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShow2faModal(false)}>Cancel</Button>
                <Button onClick={() => { setTwoFactorEnabled(true); setShow2faModal(false); }}>
                  Verify & Enable
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Active Sessions */}
      <Card>
        <CardHeader>
          <CardTitle>Active Sessions</CardTitle>
          <CardDescription>Manage devices where you&apos;re currently logged in</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { device: "Chrome on macOS", location: "San Francisco, CA", current: true, lastActive: "Now" },
              { device: "Safari on iPhone", location: "San Francisco, CA", current: false, lastActive: "2 hours ago" },
              { device: "Firefox on Windows", location: "New York, NY", current: false, lastActive: "3 days ago" },
            ].map((session, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-dark-border">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-md bg-gray-100 dark:bg-dark-surface-2 flex items-center justify-center">
                    <Smartphone className="w-4 h-4 text-gray-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{session.device}</p>
                      {session.current && <Badge variant="success" className="text-[10px]">Current</Badge>}
                    </div>
                    <p className="text-xs text-gray-400 dark:text-dark-muted">
                      {session.location} &middot; {session.lastActive}
                    </p>
                  </div>
                </div>
                {!session.current && (
                  <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 text-xs">
                    <LogOut className="w-3 h-3 mr-1" />
                    Revoke
                  </Button>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Button variant="outline" size="sm" className="text-red-500 border-red-200 hover:bg-red-50">
              <LogOut className="w-3 h-3 mr-1" />
              Sign Out All Other Sessions
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200 dark:border-red-900/30">
        <CardHeader>
          <CardTitle className="text-red-500">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Delete Account</p>
              <p className="text-xs text-gray-500 dark:text-dark-muted">Permanently delete your account and all data. This cannot be undone.</p>
            </div>
            <Button variant="destructive" size="sm">Delete Account</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
