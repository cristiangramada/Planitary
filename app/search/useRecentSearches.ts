"use client";

import { useCallback, useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Recent searches — local browser storage only (no Supabase table for V1).
// Stores a small number of unique, non-empty query strings, most recent first.
// ---------------------------------------------------------------------------

const STORAGE_KEY = "planitary:recent-searches";
const MAX_RECENT = 8;

function readStored(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writeStored(values: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
  } catch {
    // Storage unavailable (private browsing, quota, etc.) — recent searches
    // are a convenience feature, not required for search to function.
  }
}

export function useRecentSearches() {
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- hydrate from localStorage after mount */
    setRecentSearches(readStored());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const addRecentSearch = useCallback((query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setRecentSearches((prev) => {
      const next = [trimmed, ...prev.filter((q) => q.toLowerCase() !== trimmed.toLowerCase())].slice(
        0,
        MAX_RECENT
      );
      writeStored(next);
      return next;
    });
  }, []);

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    writeStored([]);
  }, []);

  return { recentSearches, addRecentSearch, clearRecentSearches };
}
