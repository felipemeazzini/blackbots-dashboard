"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { getPreviousPeriodRange } from "@/lib/date-ranges";

interface DateRangeState {
  preset: string;
  customSince?: string;
  customUntil?: string;
}

interface AppContextType {
  selectedAccountId: string;
  setSelectedAccountId: (id: string) => void;
  dateRange: DateRangeState;
  setPreset: (preset: string) => void;
  setCustomRange: (since: string, until: string) => void;
  dateQueryString: string;
  autoRefreshInterval: number;
  setAutoRefreshInterval: (ms: number) => void;
  previousDateQueryString: string | null;
}

const AppContext = createContext<AppContextType | null>(null);

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [selectedAccountId, setSelectedAccountIdState] = useState<string>("");
  const [dateRange, setDateRange] = useState<DateRangeState>({ preset: "last_7d" });
  const [autoRefreshInterval, setAutoRefreshIntervalState] = useState<number>(300000);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSelectedAccountIdState(loadFromStorage("bb_account", ""));
    setDateRange(loadFromStorage("bb_dateRange", { preset: "last_7d" }));
    setAutoRefreshIntervalState(loadFromStorage("bb_autoRefresh", 300000));
    setHydrated(true);
  }, []);

  const setSelectedAccountId = useCallback((id: string) => {
    setSelectedAccountIdState(id);
    localStorage.setItem("bb_account", JSON.stringify(id));
  }, []);

  const setPreset = useCallback((preset: string) => {
    const newRange = { ...dateRange, preset };
    setDateRange(newRange);
    localStorage.setItem("bb_dateRange", JSON.stringify(newRange));
  }, [dateRange]);

  const setCustomRange = useCallback((since: string, until: string) => {
    const newRange: DateRangeState = { preset: "custom", customSince: since, customUntil: until };
    setDateRange(newRange);
    localStorage.setItem("bb_dateRange", JSON.stringify(newRange));
  }, []);

  const setAutoRefreshInterval = useCallback((ms: number) => {
    setAutoRefreshIntervalState(ms);
    localStorage.setItem("bb_autoRefresh", JSON.stringify(ms));
  }, []);

  const dateQueryString = (() => {
    const params = new URLSearchParams();
    if (dateRange.customSince && dateRange.customUntil) {
      params.set("preset", "custom");
      params.set("since", dateRange.customSince);
      params.set("until", dateRange.customUntil);
    } else {
      params.set("preset", dateRange.preset);
    }
    return params.toString();
  })();

  const previousDateQueryString = (() => {
    const prev = getPreviousPeriodRange(dateRange.customSince, dateRange.customUntil);
    if (!prev) return null;
    const params = new URLSearchParams();
    params.set("preset", "custom");
    params.set("since", prev.since);
    params.set("until", prev.until);
    return params.toString();
  })();

  if (!hydrated) {
    return <div className="min-h-screen bg-bg-primary" />;
  }

  return (
    <AppContext.Provider
      value={{
        selectedAccountId,
        setSelectedAccountId,
        dateRange,
        setPreset,
        setCustomRange,
        dateQueryString,
        autoRefreshInterval,
        setAutoRefreshInterval,
        previousDateQueryString,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppContext must be used within AppProvider");
  return context;
}
