"use client";

import { useState, useEffect, useCallback } from "react";
import { RetentionMetrics, RetentionCampaignData, RetentionOverview } from "@/types/stripe";

interface SubBatchItem {
  utmCampaign: string;
  isActive: boolean;
  lifetimeDays: number;
  monthlyPrice: number;
  ltv: number;
  canceledRecently: boolean;
}

function aggregateRetention(allSubs: SubBatchItem[]): RetentionMetrics {
  const now = Date.now() / 1000;
  const total = allSubs.length;
  const active = allSubs.filter((s) => s.isActive).length;
  const canceled = total - active;
  const recentCancels = allSubs.filter((s) => s.canceledRecently).length;
  const monthlyChurnRate = active > 0 ? (recentCancels / (active + recentCancels)) * 100 : 0;
  const avgLtv = total > 0 ? allSubs.reduce((s, d) => s + d.ltv, 0) / total : 0;
  const avgLifetimeDays = total > 0 ? allSubs.reduce((s, d) => s + d.lifetimeDays, 0) / total : 0;
  const avgMonthlyPrice = total > 0 ? allSubs.reduce((s, d) => s + d.monthlyPrice, 0) / total : 0;

  const overview: RetentionOverview = {
    totalSubscribers: total,
    activeSubscribers: active,
    canceledSubscribers: canceled,
    monthlyChurnRate,
    avgLtv,
    avgLifetimeMonths: avgLifetimeDays / 30,
    avgMonthlyPrice,
  };

  // Group by campaign
  const byCamp = new Map<string, SubBatchItem[]>();
  for (const sub of allSubs) {
    const arr = byCamp.get(sub.utmCampaign) || [];
    arr.push(sub);
    byCamp.set(sub.utmCampaign, arr);
  }

  const byCampaign: RetentionCampaignData[] = Array.from(byCamp.entries())
    .map(([utmCampaign, subs]) => {
      const tc = subs.length;
      const ac = subs.filter((s) => s.isActive).length;
      const cc = tc - ac;
      return {
        utmCampaign,
        totalCustomers: tc,
        activeCustomers: ac,
        canceledCustomers: cc,
        churnRate: tc > 0 ? (cc / tc) * 100 : 0,
        avgLifetimeDays: subs.reduce((s, d) => s + d.lifetimeDays, 0) / tc,
        avgLifetimeMonths: subs.reduce((s, d) => s + d.lifetimeDays, 0) / tc / 30,
        avgLtv: subs.reduce((s, d) => s + d.ltv, 0) / tc,
        totalLtv: subs.reduce((s, d) => s + d.ltv, 0),
        avgMonthlyPrice: subs.reduce((s, d) => s + d.monthlyPrice, 0) / tc,
      };
    })
    .sort((a, b) => b.totalLtv - a.totalLtv);

  return { overview, byCampaign };
}

export function useRetentionData() {
  const [data, setData] = useState<RetentionMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [allSubs, setAllSubs] = useState<SubBatchItem[]>([]);

  const fetchPage = useCallback(async (cursor?: string) => {
    try {
      const url = cursor
        ? `/api/stripe/retention?cursor=${cursor}`
        : "/api/stripe/retention";
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      const collected: SubBatchItem[] = [];
      let cursor: string | undefined;
      let done = false;

      while (!done && !cancelled) {
        const result = await fetchPage(cursor);
        if (!result || cancelled) break;

        // Check if full cached result
        if (result.data && result.done) {
          setData(result.data);
          setLoading(false);
          return;
        }

        if (result.batch) {
          collected.push(...result.batch);
          setProgress(collected.length);
          // Aggregate progressively so user sees partial data
          setData(aggregateRetention(collected));
        }

        cursor = result.nextCursor || undefined;
        done = result.done || !cursor;
      }

      if (!cancelled && collected.length > 0) {
        setAllSubs(collected);
        setData(aggregateRetention(collected));
      }
      setLoading(false);
    }

    loadAll();
    return () => { cancelled = true; };
  }, [fetchPage]);

  return { data, loading, progress };
}
