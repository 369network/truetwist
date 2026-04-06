"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  UserPlus, MoreHorizontal, Mail, Shield, Eye, Pencil, Crown,
  Trash2, Clock, CheckCircle2, XCircle, Users, Activity,
} from "lucide-react";

type TeamRole = "owner" | "admin" | "editor" | "viewer";
type InviteStatus = "pending" | "accepted" | "revoked" | "expired";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  avatar: string;
  joinedAt: string;
  businessAccess: string[];
}

interface TeamInvite {
  id: string;
  email: string;
  role: TeamRole;
  sentAt: string;
  expiresAt: string;
  status: InviteStatus;
  invitedBy: string;
}

interface ActivityEntry {
  id: string;
  user: string;
  action: string;
  target: string;
  timestamp: string;
}

const roleIcons: Record<TeamRole, typeof Crown> = {
  owner: Crown,
  admin: Shield,
  editor: Pencil,
  viewer: Eye,
};

const roleColors: Record<TeamRole, string> = {
  owner: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  admin: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  editor: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  viewer: "bg-gray-100 text-gray-800 dark:bg-gray-700/30 dark:text-gray-400",
};

// Demo data - in production, fetched from API
const demoMembers: TeamMember[] = [
  { id: "1", name: "Alex Johnson", email: "alex@company.com", role: "owner", avatar: "AJ", joinedAt: "2026-01-15", businessAccess: [] },
  { id: "2", name: "Sarah Chen", email: "sarah@company.com", role: "admin", avatar: "SC", joinedAt: "2026-02-01", businessAccess: [] },
  { id: "3", name: "Mike Rivera", email: "mike@company.com", role: "editor", avatar: "MR", joinedAt: "2026-03-10", businessAccess: ["biz-1"] },
  { id: "4", name: "Emma Liu", email: "emma@company.com", role: "viewer", avatar: "EL", joinedAt: "2026-03-20", businessAccess: ["biz-1", "biz-2"] },
];

const demoPendingInvites: TeamInvite[] = [
  { id: "inv-1", email: "newguy@company.com", role: "editor", sentAt: "2 days ago", expiresAt: "5 days", status: "pending", invitedBy: "Alex Johnson" },
];

const demoActivity: ActivityEntry[] = [
  { id: "a1", user: "Alex Johnson", action: "invited", target: "newguy@company.com as Editor", timestamp: "2 days ago" },
  { id: "a2", user: "Sarah Chen", action: "approved post", target: '"Spring Sale Campaign"', timestamp: "3 days ago" },
  { id: "a3", user: "Mike Rivera", action: "created post", target: '"Product Launch Teaser"', timestamp: "4 days ago" },
  { id: "a4", user: "Alex Johnson", action: "changed role", target: "Sarah Chen from Editor to Admin", timestamp: "1 week ago" },
];

const PERMISSIONS_MATRIX = [
  { permission: "Create content", owner: true, admin: true, editor: true, viewer: false },
  { permission: "Edit content", owner: true, admin: true, editor: true, viewer: false },
  { permission: "Approve/reject posts", owner: true, admin: true, editor: false, viewer: false },
  { permission: "Publish posts", owner: true, admin: true, editor: false, viewer: false },
  { permission: "View analytics", owner: true, admin: true, editor: true, viewer: true },
  { permission: "Manage billing", owner: true, admin: false, editor: false, viewer: false },
  { permission: "Invite members", owner: true, admin: true, editor: false, viewer: false },
  { permission: "Remove members", owner: true, admin: true, editor: false, viewer: false },
  { permission: "Manage team settings", owner: true, admin: false, editor: false, viewer: false },
  { permission: "Create businesses", owner: true, admin: true, editor: false, viewer: false },
];

type TabId = "members" | "invites" | "permissions" | "activity";

export default function TeamSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("members");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamRole>("viewer");
  const [editingMember, setEditingMember] = useState<string | null>(null);

  const tabs: { id: TabId; label: string; icon: typeof Users; count?: number }[] = [
    { id: "members", label: "Members", icon: Users, count: demoMembers.length },
    { id: "invites", label: "Invites", icon: Mail, count: demoPendingInvites.length },
    { id: "permissions", label: "Permissions", icon: Shield },
    { id: "activity", label: "Activity", icon: Activity },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Team Management</h1>
        <p className="text-sm text-gray-500 dark:text-dark-muted mt-1">
          Manage your team members, roles, and permissions
        </p>
      </div>

      {/* Invite Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invite Team Member</CardTitle>
          <CardDescription>
            Send an email invite to add a colleague ({demoMembers.length} of 10 seats used)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@company.com"
              className="flex-1 h-10 px-3 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as TeamRole)}
              className="h-10 px-3 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="admin">Admin</option>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <Button disabled={!inviteEmail}>
              <UserPlus className="w-4 h-4 mr-1" />
              Invite
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-dark-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-brand-500 text-brand-600 dark:text-brand-400"
                : "border-transparent text-gray-500 dark:text-dark-muted hover:text-gray-700 dark:hover:text-dark-text"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count !== undefined && (
              <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-dark-surface-2">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Members Tab */}
      {activeTab === "members" && (
        <Card>
          <CardContent className="pt-6">
            <div className="divide-y divide-gray-100 dark:divide-dark-border">
              {demoMembers.map((member) => {
                const RoleIcon = roleIcons[member.role];
                return (
                  <div key={member.id} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full gradient-brand flex items-center justify-center text-white text-xs font-semibold">
                        {member.avatar}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{member.name}</p>
                        <p className="text-xs text-gray-400 dark:text-dark-muted">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {member.businessAccess.length > 0 && (
                        <span className="text-xs text-gray-400 dark:text-dark-muted">
                          {member.businessAccess.length} business{member.businessAccess.length > 1 ? "es" : ""}
                        </span>
                      )}
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${roleColors[member.role]}`}>
                        <RoleIcon className="w-3 h-3" />
                        {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                      </span>
                      {member.role !== "owner" && (
                        <div className="relative">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setEditingMember(editingMember === member.id ? null : member.id)}
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                          {editingMember === member.id && (
                            <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-dark-surface-2 rounded-lg shadow-lg border border-gray-200 dark:border-dark-border py-1 z-50">
                              <button className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-dark-surface flex items-center gap-2">
                                <Shield className="w-4 h-4" /> Change Role
                              </button>
                              <button className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-dark-surface flex items-center gap-2">
                                <Eye className="w-4 h-4" /> Manage Access
                              </button>
                              <button className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 flex items-center gap-2">
                                <Trash2 className="w-4 h-4" /> Remove
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invites Tab */}
      {activeTab === "invites" && (
        <Card>
          <CardContent className="pt-6">
            {demoPendingInvites.length === 0 ? (
              <div className="text-center py-8 text-gray-400 dark:text-dark-muted">
                <Mail className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No pending invites</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-dark-border">
                {demoPendingInvites.map((invite) => (
                  <div key={invite.id} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-dark-surface-2 flex items-center justify-center">
                        <Mail className="w-4 h-4 text-gray-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{invite.email}</p>
                        <p className="text-xs text-gray-400 dark:text-dark-muted">
                          Invited by {invite.invitedBy} &middot; Sent {invite.sentAt} &middot; Expires in {invite.expiresAt}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {invite.role.charAt(0).toUpperCase() + invite.role.slice(1)}
                      </Badge>
                      <Button variant="ghost" size="sm" className="text-xs text-red-500 hover:text-red-600">
                        Revoke
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Permissions Tab */}
      {activeTab === "permissions" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Permission Matrix</CardTitle>
            <CardDescription>Overview of what each role can do</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-dark-border">
                    <th className="text-left py-3 pr-4 font-medium text-gray-500 dark:text-dark-muted">Permission</th>
                    {(["owner", "admin", "editor", "viewer"] as TeamRole[]).map((role) => {
                      const Icon = roleIcons[role];
                      return (
                        <th key={role} className="text-center py-3 px-4 font-medium">
                          <div className="flex flex-col items-center gap-1">
                            <Icon className="w-4 h-4" />
                            <span className="text-xs">{role.charAt(0).toUpperCase() + role.slice(1)}</span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {PERMISSIONS_MATRIX.map((row) => (
                    <tr key={row.permission} className="border-b border-gray-100 dark:border-dark-border last:border-0">
                      <td className="py-3 pr-4 text-gray-700 dark:text-dark-text">{row.permission}</td>
                      {(["owner", "admin", "editor", "viewer"] as TeamRole[]).map((role) => (
                        <td key={role} className="text-center py-3 px-4">
                          {row[role] ? (
                            <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto" />
                          ) : (
                            <XCircle className="w-5 h-5 text-gray-300 dark:text-gray-600 mx-auto" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activity Tab */}
      {activeTab === "activity" && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {demoActivity.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-dark-surface-2 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Activity className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm">
                      <span className="font-medium">{entry.user}</span>{" "}
                      <span className="text-gray-500 dark:text-dark-muted">{entry.action}</span>{" "}
                      <span className="font-medium">{entry.target}</span>
                    </p>
                    <p className="text-xs text-gray-400 dark:text-dark-muted mt-0.5">{entry.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
