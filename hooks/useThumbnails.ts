"use client";

import { useState, useEffect, useCallback } from "react";

export function useThumbnails(adIds: string[]) {
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});

  const fetchThumbnails = useCallback(async () => {
    if (adIds.length === 0) return;
    // Only fetch IDs we don't already have
    const missing = adIds.filter((id) => !thumbnails[id]);
    if (missing.length === 0) return;

    try {
      const res = await fetch(`/api/facebook/thumbnails?ids=${missing.join(",")}`);
      if (res.ok) {
        const json = await res.json();
        setThumbnails((prev) => ({ ...prev, ...json.data }));
      }
    } catch {
      // optional
    }
  }, [adIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchThumbnails();
  }, [fetchThumbnails]);

  return thumbnails;
}
