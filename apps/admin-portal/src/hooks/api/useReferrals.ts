"use client";

import { useQuery } from "@tanstack/react-query";
import { referralsApi } from "@/lib/api";
import { queryKeys } from "./queryKeys";

async function unwrap<T>(promise: Promise<{ data?: T; error?: string }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw new Error(error);
  if (data === undefined) throw new Error("No data");
  return data;
}

export function useReferralsList(params?: {
  page?: number;
  per_page?: number;
  status?: string;
  referrer_user_id?: string;
  referred_user_id?: string;
}) {
  return useQuery({
    queryKey: queryKeys.referrals.list(params ?? {}),
    queryFn: () => unwrap(referralsApi.list(params)),
  });
}
