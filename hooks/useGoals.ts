"use client";

import { useState, useEffect, useCallback } from "react";
import { Goal, GoalFormData } from "@/types/goals";

export function useGoals(accountId: string | null, campaignId?: string | null) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchGoals = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("account_id", accountId);
      if (campaignId) params.set("campaign_id", campaignId);
      const res = await fetch(`/api/goals?${params}`);
      if (res.ok) {
        const json = await res.json();
        setGoals(json.data || []);
      }
    } catch {
      // goals are optional
    } finally {
      setLoading(false);
    }
  }, [accountId, campaignId]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const saveGoal = useCallback(
    async (formData: GoalFormData) => {
      if (!accountId) return;
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: accountId,
          campaign_id: formData.campaign_id || campaignId || null,
          ...formData,
        }),
      });
      if (res.ok) {
        await fetchGoals();
      }
    },
    [accountId, campaignId, fetchGoals]
  );

  const deleteGoal = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/goals?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        await fetchGoals();
      }
    },
    [fetchGoals]
  );

  return { goals, loading, saveGoal, deleteGoal, refetch: fetchGoals };
}
