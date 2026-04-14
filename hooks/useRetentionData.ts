"use client";

import { useFetch } from "./useFacebookData";
import { StripeSubscriptionData } from "@/types/stripe";

export function useRetentionData() {
  const { data, loading, error } = useFetch<{ data: StripeSubscriptionData[] }>(
    "/api/stripe/retention"
  );

  return {
    subscriptions: data?.data || [],
    loading,
    error,
  };
}
