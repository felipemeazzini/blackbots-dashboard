"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";

interface Budget {
  id: string;
  account_id: string;
  month: string;
  budget_amount: number;
}

export function useBudget(accountId: string | null) {
  const currentMonth = format(new Date(), "yyyy-MM");
  const [budget, setBudget] = useState<Budget | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchBudget = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/budgets?account_id=${accountId}&month=${currentMonth}`);
      if (res.ok) {
        const json = await res.json();
        setBudget(json.data?.[0] || null);
      }
    } catch {
      // optional
    } finally {
      setLoading(false);
    }
  }, [accountId, currentMonth]);

  useEffect(() => {
    fetchBudget();
  }, [fetchBudget]);

  const saveBudget = useCallback(
    async (amount: number) => {
      if (!accountId) return;
      const res = await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id: accountId, month: currentMonth, budget_amount: amount }),
      });
      if (res.ok) await fetchBudget();
    },
    [accountId, currentMonth, fetchBudget]
  );

  return { budget, loading, saveBudget, refetch: fetchBudget };
}
