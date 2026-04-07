"use client";

import { useState, useEffect, useCallback } from "react";
import { CampaignGoal } from "@/types/goals";

export function useGoals(accountId: string | null) {
  const [goals, setGoals] = useState<CampaignGoal[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchGoals = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/goals?account_id=${accountId}`);
      if (res.ok) {
        const json = await res.json();
        setGoals(json.data || []);
      }
    } catch {
      // goals are optional
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const saveGoal = useCallback(
    async (data: Record<string, unknown>) => {
      if (!accountId) return;
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id: accountId, ...data }),
      });
      if (res.ok) await fetchGoals();
    },
    [accountId, fetchGoals]
  );

  const deleteGoal = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/goals?id=${id}`, { method: "DELETE" });
      if (res.ok) await fetchGoals();
    },
    [fetchGoals]
  );

  return { goals, loading, saveGoal, deleteGoal, refetch: fetchGoals };
}
