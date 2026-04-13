"use client";

import { useFetch } from "./useFacebookData";
import { StripeMetrics } from "@/types/stripe";

export function useStripeData(dateQueryString: string, pollingInterval?: number) {
  return useFetch<{ data: StripeMetrics }>(
    `/api/stripe?${dateQueryString}`,
    { pollingInterval }
  );
}
