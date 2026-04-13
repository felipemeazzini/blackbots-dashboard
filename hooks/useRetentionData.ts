"use client";

import { useFetch } from "./useFacebookData";
import { RetentionMetrics } from "@/types/stripe";

export function useRetentionData() {
  return useFetch<{ data: RetentionMetrics }>("/api/stripe/retention");
}
