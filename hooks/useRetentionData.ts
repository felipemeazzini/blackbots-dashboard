"use client";

import { useFetch } from "./useFacebookData";
import { RetentionMetrics } from "@/types/stripe";

export function useRetentionData() {
  const { data, loading, error } = useFetch<{ data: RetentionMetrics | null; done?: boolean }>(
    "/api/stripe/retention"
  );

  return {
    data: data?.data || null,
    loading,
    error,
  };
}
