"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { DisableNativeContextMenu } from "./DisableNativeContextMenu";
import { ClientTimeZone } from "./ClientTimeZone";
import { createClient } from "@/lib/supabase/client";
import { countProductiveDays } from "@/lib/productive-days";
import {
  DEFAULT_THEME,
  THEME_IDS,
  isThemeId,
  resolveActiveTheme,
} from "@/lib/themes";

/**
 * Signed-out surfaces (welcome, login, signup) always render the default
 * theme, regardless of the visitor's stored preference. This is a visual
 * override only — it must never write to the persisted theme preference,
 * so a returning user's theme survives sign-out and reappears on sign-in.
 */
const THEME_LOCKED_PATHS = ["/", "/login", "/signup"];

function isThemeLockedPath(pathname: string): boolean {
  return THEME_LOCKED_PATHS.includes(pathname);
}

interface ThemeProviderProps {
  children: ReactNode;
}

// next-themes injects an inline <script> to prevent theme flash. React 19 /
// Next 16 warn about <script> inside components; the script still runs correctly
// during SSR. Filter that known false positive in development only.
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    const first = args[0];
    if (
      typeof first === "string" &&
      first.includes("Encountered a script tag while rendering React component")
    ) {
      return;
    }
    originalError.apply(console, args);
  };
}

/**
 * If localStorage holds a locked planet theme (or an invalid id), fall back to Dark.
 * Unlock state is derived from durable productive-day rows in Supabase.
 */
function ThemeUnlockGuard({ children }: { children: ReactNode }) {
  const { theme, setTheme, resolvedTheme, forcedTheme } = useTheme();
  const checked = useRef(false);

  useEffect(() => {
    // A locked page already forces the default theme visually — leave the
    // stored preference untouched so it's there when the user signs back in.
    if (forcedTheme) return;
    if (checked.current) return;
    const candidate = theme ?? resolvedTheme;
    if (!candidate) return;

    let cancelled = false;

    async function validate() {
      if (!isThemeId(candidate)) {
        setTheme(DEFAULT_THEME);
        checked.current = true;
        return;
      }

      // Free themes never need a network round-trip.
      if (candidate === "dark" || candidate === "light") {
        checked.current = true;
        return;
      }

      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          // Signed-out user with a planet theme stored (e.g. mid sign-out
          // redirect) — nothing to validate here; locked pages already
          // force the default theme visually without touching storage.
          checked.current = true;
          return;
        }
        const count = await countProductiveDays(supabase);
        if (cancelled) return;
        const safe = resolveActiveTheme(candidate, count);
        if (safe !== candidate) setTheme(safe);
        checked.current = true;
      } catch {
        if (!cancelled) setTheme(DEFAULT_THEME);
        checked.current = true;
      }
    }

    void validate();
    return () => {
      cancelled = true;
    };
  }, [theme, resolvedTheme, setTheme, forcedTheme]);

  return children;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const pathname = usePathname();
  const forcedTheme = isThemeLockedPath(pathname) ? DEFAULT_THEME : undefined;

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={DEFAULT_THEME}
      enableSystem={false}
      disableTransitionOnChange
      themes={[...THEME_IDS]}
      forcedTheme={forcedTheme}
    >
      <ThemeUnlockGuard>
        <DisableNativeContextMenu />
        <ClientTimeZone />
        {children}
      </ThemeUnlockGuard>
    </NextThemesProvider>
  );
}
