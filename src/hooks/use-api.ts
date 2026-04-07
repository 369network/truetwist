"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  aiApi,
  postsApi,
  calendarApi,
  analyticsApi,
  socialAccountsApi,
  trendsApi,
  abTestApi,
  aiSuggestionsApi,
  videoAbTestApi,
} from "@/lib/api-client";

// ── AI Generation ──

export function useGenerateText() {
  return useMutation({
    mutationFn: (data: Parameters<typeof aiApi.generateText>[0]) =>
      aiApi.generateText(data),
  });
}

export function useGenerateImages() {
  return useMutation({
    mutationFn: (data: Parameters<typeof aiApi.generateImages>[0]) =>
      aiApi.generateImages(data),
  });
}

// ── Posts ──

export function usePosts(params?: Parameters<typeof postsApi.list>[0]) {
  return useQuery({
    queryKey: ["posts", params],
    queryFn: () => postsApi.list(params),
  });
}

export function usePost(id: string) {
  return useQuery({
    queryKey: ["posts", id],
    queryFn: () => postsApi.get(id),
    enabled: !!id,
  });
}

export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof postsApi.create>[0]) =>
      postsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["posts"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}

export function useUpdatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: { id: string } & Parameters<typeof postsApi.update>[1]) =>
      postsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => postsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["posts"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}

export function useSchedulePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      postId,
      ...data
    }: {
      postId: string;
      socialAccountId: string;
      platform: string;
      scheduledAt: string;
    }) => postsApi.schedule(postId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["posts"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}

export function useReschedulePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      postId,
      scheduleId,
      scheduledAt,
    }: {
      postId: string;
      scheduleId: string;
      scheduledAt: string;
    }) => postsApi.reschedule(postId, scheduleId, scheduledAt),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}

// ── Calendar ──

export function useCalendarEvents(start: string, end: string) {
  return useQuery({
    queryKey: ["calendar", start, end],
    queryFn: async () => {
      const res = await calendarApi.getEvents(start, end);
      // Flatten the grouped response into a flat array of events for the calendar
      const events = res.data.days.flatMap((day) => day.schedules);
      return { data: events, meta: res.data };
    },
    enabled: !!start && !!end,
    refetchInterval: 30000, // Poll every 30 seconds for status updates
  });
}

// ── Analytics ──

export function useAnalytics(range: string, businessId?: string) {
  return useQuery({
    queryKey: ["analytics", range, businessId],
    queryFn: () => analyticsApi.getSummary(range, businessId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ── Social Accounts ──

export function useSocialAccounts() {
  return useQuery({
    queryKey: ["socialAccounts"],
    queryFn: () => socialAccountsApi.list(),
  });
}

export function useConnectAccount() {
  return useMutation({
    mutationFn: (platform: string) => socialAccountsApi.connect(platform),
    onSuccess: (data) => {
      // Open OAuth popup
      const { authorizationUrl } = data.data;
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      window.open(
        authorizationUrl,
        "oauth-popup",
        `width=${width},height=${height},left=${left},top=${top},popup=yes`
      );
    },
  });
}

export function useDisconnectAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => socialAccountsApi.disconnect(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["socialAccounts"] });
    },
  });
}

// ── Viral Trends ──

export function useTrends(params?: Parameters<typeof trendsApi.list>[0]) {
  return useQuery({
    queryKey: ["trends", params],
    queryFn: () => trendsApi.list(params),
    refetchInterval: 60000, // Refresh every minute for real-time feel
  });
}

export function useTrendDetail(id: string) {
  return useQuery({
    queryKey: ["trends", id],
    queryFn: () => trendsApi.get(id),
    enabled: !!id,
  });
}

export function useTrendAlerts() {
  return useQuery({
    queryKey: ["trendAlerts"],
    queryFn: () => trendsApi.getAlerts(),
    refetchInterval: 60000,
  });
}

// ── A/B Testing ──

export function useAbTests(params?: Parameters<typeof abTestApi.list>[0]) {
  return useQuery({
    queryKey: ["abTests", params],
    queryFn: () => abTestApi.list(params),
  });
}

export function useAbTest(id: string) {
  return useQuery({
    queryKey: ["abTests", id],
    queryFn: () => abTestApi.get(id),
    enabled: !!id,
    refetchInterval: 10000, // Poll running tests
  });
}

export function useCreateAbTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof abTestApi.create>[0]) =>
      abTestApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["abTests"] });
    },
  });
}

export function useStopAbTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => abTestApi.stop(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["abTests"] });
    },
  });
}

// ── Video A/B Testing ──

export function useVideoAbTests(params?: Parameters<typeof videoAbTestApi.list>[0]) {
  return useQuery({
    queryKey: ["videoAbTests", params],
    queryFn: () => videoAbTestApi.list(params),
  });
}

export function useVideoAbTest(id: string) {
  return useQuery({
    queryKey: ["videoAbTests", id],
    queryFn: () => videoAbTestApi.get(id),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.data?.status;
      // Poll more frequently during generation, less during running
      if (status === 'generating') return 5000;
      if (status === 'running') return 15000;
      return false;
    },
  });
}

export function useCreateVideoAbTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof videoAbTestApi.create>[0]) =>
      videoAbTestApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["videoAbTests"] });
    },
  });
}

export function useVideoAbTestAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      action,
      winnerId,
    }: {
      id: string;
      action: 'generate' | 'complete' | 'cancel';
      winnerId?: string;
    }) => videoAbTestApi.action(id, action, winnerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["videoAbTests"] });
    },
  });
}

export function useUpdateVideoVariantMetrics() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      testId,
      variantId,
      ...metrics
    }: {
      testId: string;
      variantId: string;
      impressions?: number;
      clicks?: number;
      watchTimeSeconds?: number;
      completionRate?: number;
      conversions?: number;
      engagements?: number;
    }) => videoAbTestApi.updateMetrics(testId, variantId, metrics),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["videoAbTests"] });
    },
  });
}

export function useSelectVideoAbTestWinner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ testId, winnerId }: { testId: string; winnerId?: string }) =>
      videoAbTestApi.selectWinner(testId, winnerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["videoAbTests"] });
    },
  });
}

// ── AI Calendar Suggestions ──

export function useAiSuggestionSlots(start: string, end: string) {
  return useQuery({
    queryKey: ["aiSlots", start, end],
    queryFn: () => aiSuggestionsApi.getOptimalSlots({ start, end }),
    enabled: !!start && !!end,
    staleTime: 10 * 60 * 1000,
  });
}

export function useGenerateWeek() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof aiSuggestionsApi.generateWeek>[0]) =>
      aiSuggestionsApi.generateWeek(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendar"] });
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
  });
}
