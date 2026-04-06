"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UseFetchOptions {
  enabled?: boolean;
  pollingInterval?: number;
}

export function useFetch<T>(
  url: string | null,
  options: UseFetchOptions = {}
) {
  const { enabled = true, pollingInterval = 0 } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (!url || !enabled || fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading((prev) => !prev ? true : prev);
    setError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [url, enabled]);

  // Fetch inicial
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Polling
  useEffect(() => {
    if (!url || !enabled || !pollingInterval || pollingInterval <= 0) return;
    const interval = setInterval(fetchData, pollingInterval);
    return () => clearInterval(interval);
  }, [url, enabled, pollingInterval, fetchData]);

  return { data, loading, error, refetch: fetchData };
}

export function useAccounts() {
  return useFetch<{ data: Array<{ id: string; name: string; account_status: number; currency: string; amount_spent: string; balance: string }> }>(
    "/api/facebook/accounts"
  );
}

export function useCampaigns(accountId: string | null, status?: string, pollingInterval?: number) {
  const params = new URLSearchParams();
  if (accountId) params.set("account_id", accountId);
  if (status) params.set("status", status);

  return useFetch<{ data: Array<{ id: string; name: string; status: string; effective_status: string; objective: string; daily_budget?: string; lifetime_budget?: string }> }>(
    accountId ? `/api/facebook/campaigns?${params}` : null,
    { pollingInterval }
  );
}

export function useAdSets(accountId: string | null, campaignId?: string, pollingInterval?: number) {
  const params = new URLSearchParams();
  if (accountId) params.set("account_id", accountId);
  if (campaignId) params.set("campaign_id", campaignId);

  return useFetch<{ data: Array<{ id: string; name: string; status: string; effective_status: string; campaign_id: string }> }>(
    accountId ? `/api/facebook/adsets?${params}` : null,
    { pollingInterval }
  );
}

export function useAds(accountId: string | null, adsetId?: string, pollingInterval?: number) {
  const params = new URLSearchParams();
  if (accountId) params.set("account_id", accountId);
  if (adsetId) params.set("adset_id", adsetId);

  return useFetch<{ data: Array<{ id: string; name: string; status: string; effective_status: string; campaign_id: string; adset_id: string; thumbnail_url?: string }> }>(
    accountId ? `/api/facebook/ads?${params}` : null,
    { pollingInterval }
  );
}

export function useInsights(
  objectId: string | null,
  dateQuery: string,
  level?: string,
  timeIncrement?: string,
  pollingInterval?: number
) {
  const params = new URLSearchParams(dateQuery);
  if (objectId) params.set("object_id", objectId);
  if (level) params.set("level", level);
  if (timeIncrement) params.set("time_increment", timeIncrement);

  return useFetch<{ data: Array<{ spend: number; impressions: number; clicks: number; reach: number; ctr: number; cpc: number; cpm: number; frequency: number; uniqueClicks: number; conversions: number; purchases: number; costPerSale: number; cac: number; roas: number; purchaseValue: number; dateStart?: string; dateStop?: string }> }>(
    objectId ? `/api/facebook/insights?${params}` : null,
    { pollingInterval }
  );
}
