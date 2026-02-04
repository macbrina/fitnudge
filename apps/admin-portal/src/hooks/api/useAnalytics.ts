"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { analyticsApi } from "@/lib/api";
import { queryKeys } from "./queryKeys";

async function unwrap<T>(promise: Promise<{ data?: T; error?: string }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw new Error(error);
  if (data === undefined) throw new Error("No data");
  return data;
}

export function useAnalyticsDashboard() {
  return useQuery({
    queryKey: queryKeys.analytics.dashboard(),
    queryFn: () => unwrap(analyticsApi.dashboard()),
  });
}

export function useAnalyticsUserGrowth(days: number = 30) {
  return useQuery({
    queryKey: queryKeys.analytics.userGrowth(days),
    queryFn: () => unwrap(analyticsApi.userGrowth(days)),
  });
}

export function useAnalyticsCheckinActivity(days: number = 30) {
  return useQuery({
    queryKey: queryKeys.analytics.checkinActivity(days),
    queryFn: () => unwrap(analyticsApi.checkinActivity(days)),
  });
}

export function useAnalyticsRetention() {
  return useQuery({
    queryKey: queryKeys.analytics.retention(),
    queryFn: () => unwrap(analyticsApi.retention()),
  });
}

export function useAnalyticsSubscriptionByPlatform() {
  return useQuery({
    queryKey: queryKeys.analytics.subscriptionByPlatform(),
    queryFn: () => unwrap(analyticsApi.subscriptionByPlatform()),
  });
}

export function useAnalyticsMrrTrend(days: number = 30) {
  return useQuery({
    queryKey: queryKeys.analytics.mrrTrend(days),
    queryFn: () => unwrap(analyticsApi.mrrTrend(days)),
  });
}

export function useAnalyticsReferrals() {
  return useQuery({
    queryKey: queryKeys.analytics.referrals(),
    queryFn: () => unwrap(analyticsApi.referrals()),
  });
}

export function useAnalyticsChurn(days: number = 30) {
  return useQuery({
    queryKey: queryKeys.analytics.churn(days),
    queryFn: () => unwrap(analyticsApi.churn(days)),
  });
}

export function useAnalyticsEngagement() {
  return useQuery({
    queryKey: queryKeys.analytics.engagement(),
    queryFn: () => unwrap(analyticsApi.engagement()),
  });
}

export function useAnalyticsBroadcastEngagement() {
  return useQuery({
    queryKey: queryKeys.analytics.broadcastEngagement(),
    queryFn: () => unwrap(analyticsApi.broadcastEngagement()),
  });
}

export function useAnalyticsClearCache() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(analyticsApi.clearCache()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
    },
  });
}
