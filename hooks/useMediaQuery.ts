"use client";

import { useEffect, useState } from "react";

/**
 * Tracks whether a CSS media query currently matches, centralizing the
 * `window.matchMedia` breakpoint checks that were previously duplicated
 * ad hoc across components (e.g. Tasks' resize logic).
 *
 * Returns `false` during SSR/first paint (no layout shift risk since callers
 * use this only to toggle JS-driven behavior, not initial CSS layout).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches
  );

  useEffect(() => {
    const mql = window.matchMedia(query);

    function onChange(e: MediaQueryListEvent) {
      setMatches(e.matches);
    }

    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** Matches the app's `lg` breakpoint (1024px) — the same cutoff used by the
 * sidebar, Tasks lists panel, and other desktop/mobile layout splits. */
export function useIsMobile(): boolean {
  return !useMediaQuery("(min-width: 1024px)");
}
