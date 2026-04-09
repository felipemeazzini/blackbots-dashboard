"use client";

import { useMemo } from "react";
import { useAccounts } from "./useFacebookData";
import { useUserAccess } from "./useUserAccess";

export function useFilteredAccounts() {
  const { data: accountsData, loading: accountsLoading } = useAccounts();
  const { access } = useUserAccess();

  const accounts = useMemo(() => {
    const all = (accountsData?.data || []).filter(
      (a) =>
        Number(a.amount_spent) > 0 &&
        !a.name.includes("Read-Only") &&
        !a.name.includes("Test ")
    );

    // If user has specific allowed_accounts, filter
    if (access?.allowed_accounts && access.allowed_accounts.length > 0) {
      return all.filter((a) => access.allowed_accounts!.includes(a.id));
    }

    // Admin or no restriction — show all
    return all;
  }, [accountsData, access]);

  return { accounts, loading: accountsLoading, isAdmin: access?.is_admin || false };
}
