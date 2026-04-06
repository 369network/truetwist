"use client";

import { useEffect, useCallback, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSocialAccounts, useConnectAccount, useDisconnectAccount } from "@/hooks/use-api";
import { useQueryClient } from "@tanstack/react-query";
import {
  RefreshCw,
  ExternalLink,
  Unlink,
  Loader2,
  AlertCircle,
  CheckCircle2,
  WifiOff,
  Shield,
} from "lucide-react";

const platformConfigs: Record<string, { color: string; label: string }> = {
  instagram: { color: "bg-platform-instagram", label: "Instagram" },
  twitter: { color: "bg-platform-twitter", label: "Twitter/X" },
  linkedin: { color: "bg-platform-linkedin", label: "LinkedIn" },
  facebook: { color: "bg-platform-facebook", label: "Facebook" },
  tiktok: { color: "bg-gray-900", label: "TikTok" },
  youtube: { color: "bg-red-600", label: "YouTube" },
  pinterest: { color: "bg-red-700", label: "Pinterest" },
  threads: { color: "bg-gray-800", label: "Threads" },
};

const allPlatforms = Object.keys(platformConfigs);

export default function AccountsSettingsPage() {
  const { data: accountsData, isLoading, isError, error } = useSocialAccounts();
  const connectAccount = useConnectAccount();
  const disconnectAccount = useDisconnectAccount();
  const queryClient = useQueryClient();
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [connectionSuccess, setConnectionSuccess] = useState(false);

  const accounts = accountsData?.data || [];

  // Check for OAuth callback success
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "true") {
      setConnectionSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["socialAccounts"] });
      // Clean the URL
      window.history.replaceState({}, "", window.location.pathname);
      setTimeout(() => setConnectionSuccess(false), 5000);
    }
    if (params.get("error")) {
      // Error handled below in UI
    }
  }, [queryClient]);

  // Listen for OAuth popup completion
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "oauth-complete") {
        queryClient.invalidateQueries({ queryKey: ["socialAccounts"] });
        setConnectingPlatform(null);
        setConnectionSuccess(true);
        setTimeout(() => setConnectionSuccess(false), 5000);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [queryClient]);

  const handleConnect = useCallback(
    (platform: string) => {
      setConnectingPlatform(platform);
      connectAccount.mutate(platform, {
        onError: () => setConnectingPlatform(null),
      });
    },
    [connectAccount]
  );

  const handleDisconnect = useCallback(
    (id: string) => {
      setDisconnectingId(id);
      disconnectAccount.mutate(id, {
        onSettled: () => setDisconnectingId(null),
      });
    },
    [disconnectAccount]
  );

  // Build combined list: connected accounts + unconnected platforms
  const connectedPlatforms = new Set(accounts.map((a) => a.platform));
  const unconnectedPlatforms = allPlatforms.filter((p) => !connectedPlatforms.has(p));

  const getTokenStatusBadge = (status: string, expiresAt: string | null) => {
    if (status === "valid") {
      return <Badge variant="success"><CheckCircle2 className="w-3 h-3 mr-1" /> Healthy</Badge>;
    }
    if (status === "expired") {
      return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" /> Expired</Badge>;
    }
    // Check if expiring soon (within 7 days)
    if (expiresAt) {
      const expiryDate = new Date(expiresAt);
      const daysUntilExpiry = (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (daysUntilExpiry < 7 && daysUntilExpiry > 0) {
        return <Badge variant="warning"><Shield className="w-3 h-3 mr-1" /> Token Expiring</Badge>;
      }
    }
    return <Badge variant="secondary">Unknown</Badge>;
  };

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Success banner */}
      {connectionSuccess && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-green-50 dark:bg-green-900/10 text-green-600 text-sm">
          <CheckCircle2 className="w-4 h-4" />
          Account connected successfully!
        </div>
      )}

      {/* Error banner */}
      {connectAccount.isError && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-red-50 dark:bg-red-900/10 text-red-500 text-sm">
          <AlertCircle className="w-4 h-4" />
          Failed to initiate connection. Please try again.
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-brand-500 animate-spin mb-3" />
            <p className="text-sm text-gray-400">Loading accounts...</p>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {isError && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <WifiOff className="w-8 h-8 text-red-400 mb-3" />
            <p className="text-sm text-red-500">Failed to load accounts</p>
            <p className="text-xs text-gray-400 mt-1">{(error as Error)?.message}</p>
          </CardContent>
        </Card>
      )}

      {/* Connected Accounts */}
      {!isLoading && !isError && (
        <Card>
          <CardHeader>
            <CardTitle>Connected Platforms</CardTitle>
            <CardDescription>Manage your social media account connections</CardDescription>
          </CardHeader>
          <CardContent>
            {accounts.length === 0 && unconnectedPlatforms.length > 0 ? (
              <div className="text-center py-8">
                <ExternalLink className="w-10 h-10 text-gray-300 dark:text-dark-border mx-auto mb-3" />
                <p className="text-sm text-gray-500 font-medium">No accounts connected</p>
                <p className="text-xs text-gray-400 mt-1">Connect your social media accounts to start posting</p>
              </div>
            ) : null}

            <div className="divide-y divide-gray-100 dark:divide-dark-border">
              {/* Connected accounts */}
              {accounts.map((account) => {
                const config = platformConfigs[account.platform] || {
                  color: "bg-gray-400",
                  label: account.platform,
                };
                const isDisconnecting = disconnectingId === account.id;

                return (
                  <div key={account.id} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg ${config.color} flex items-center justify-center text-white text-xs font-bold`}>
                        {config.label.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{config.label}</p>
                          {getTokenStatusBadge(account.tokenStatus, account.tokenExpiresAt)}
                        </div>
                        <p className="text-xs text-gray-400 dark:text-dark-muted mt-0.5">
                          {account.accountHandle || account.accountName || "Connected"}
                          {account.followerCount > 0 && ` · ${account.followerCount.toLocaleString()} followers`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {account.tokenStatus === "expired" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleConnect(account.platform)}
                          disabled={connectingPlatform === account.platform}
                        >
                          {connectingPlatform === account.platform ? (
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3 h-3 mr-1" />
                          )}
                          Reconnect
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => handleDisconnect(account.id)}
                        disabled={isDisconnecting}
                      >
                        {isDisconnecting ? (
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <Unlink className="w-3 h-3 mr-1" />
                        )}
                        Disconnect
                      </Button>
                    </div>
                  </div>
                );
              })}

              {/* Unconnected platforms */}
              {unconnectedPlatforms.map((platform) => {
                const config = platformConfigs[platform];
                const isConnecting = connectingPlatform === platform;

                return (
                  <div key={platform} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-dark-surface-2 flex items-center justify-center text-gray-400 text-xs font-bold">
                        {config.label.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm text-gray-500">{config.label}</p>
                          <Badge variant="secondary">Not Connected</Badge>
                        </div>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => handleConnect(platform)}
                      disabled={isConnecting}
                    >
                      {isConnecting ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <ExternalLink className="w-3 h-3 mr-1" />
                      )}
                      Connect
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
