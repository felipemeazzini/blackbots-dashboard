"use client";

import { useState, useCallback } from "react";

export interface DateRangeState {
  preset: string;
  customSince?: string;
  customUntil?: string;
}

export function useDateRange(defaultPreset = "last_7d") {
  const [state, setState] = useState<DateRangeState>({
    preset: defaultPreset,
  });

  const setPreset = useCallback((preset: string) => {
    setState((prev) => ({ ...prev, preset }));
  }, []);

  const setCustomRange = useCallback((since: string, until: string) => {
    setState({ preset: "custom", customSince: since, customUntil: until });
  }, []);

  const queryParams = new URLSearchParams();
  queryParams.set("preset", state.preset);
  if (state.preset === "custom" && state.customSince && state.customUntil) {
    queryParams.set("since", state.customSince);
    queryParams.set("until", state.customUntil);
  }

  return {
    ...state,
    setPreset,
    setCustomRange,
    queryString: queryParams.toString(),
  };
}
