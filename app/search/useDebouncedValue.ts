"use client";

import { useEffect, useState } from "react";

/** No debounce utility exists elsewhere in the codebase; this is a minimal,
 * dependency-free implementation rather than pulling in a library. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
