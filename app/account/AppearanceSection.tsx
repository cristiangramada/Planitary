"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/utils/cn";
import { AccountCard } from "./AccountCard";

/**
 * Uses useSyncExternalStore to correctly detect client-side rendering without
 * triggering the react-hooks/set-state-in-effect lint rule (same pattern as
 * ThemeToggle).
 */
function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

const OPTIONS = [
  { value: "dark", label: "Dark", icon: Moon },
  { value: "light", label: "Light", icon: Sun },
] as const;

export function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const isClient = useIsClient();

  return (
    <AccountCard title="Appearance" description="Choose how Planitary looks on this device.">
      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-2 gap-2">
        {OPTIONS.map(({ value, label, icon: Icon }) => {
          const selected = isClient && theme === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setTheme(value)}
              className={cn(
                "flex flex-col items-center gap-1.5 px-3 py-3 rounded-lg border text-sm font-medium transition-colors cursor-pointer",
                selected
                  ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 text-[hsl(var(--foreground))]"
                  : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
              )}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>
    </AccountCard>
  );
}
