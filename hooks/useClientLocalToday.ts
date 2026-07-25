"use client";

import { useSyncExternalStore } from "react";
import { localTodayStr } from "@/utils/date";

// Keeps local-time-derived values correct across a midnight rollover (and
// after the tab regains focus) without ever calling setState from inside an
// effect: React re-renders automatically whenever the external snapshot
// changes, and the server snapshot keeps first paint hydration-safe.
function subscribeToLocalClock(callback: () => void) {
  const interval = setInterval(callback, 60_000);
  window.addEventListener("focus", callback);
  document.addEventListener("visibilitychange", callback);
  return () => {
    clearInterval(interval);
    window.removeEventListener("focus", callback);
    document.removeEventListener("visibilitychange", callback);
  };
}

/**
 * Returns the client's local "today" (YYYY-MM-DD), falling back to `serverToday`
 * (the server clock's guess, usually UTC) until hydration completes. Shared by
 * any page that needs a hydration-safe "today" — e.g. Journal and Dashboard.
 */
export function useClientLocalToday(serverToday: string): string {
  return useSyncExternalStore(subscribeToLocalClock, localTodayStr, () => serverToday);
}

/**
 * Returns the client's local hour of day (0–23), falling back to `serverHour`
 * until hydration completes. Used by the Dashboard's time-of-day greeting.
 */
export function useClientLocalHour(serverHour: number): number {
  return useSyncExternalStore(
    subscribeToLocalClock,
    () => new Date().getHours(),
    () => serverHour
  );
}
