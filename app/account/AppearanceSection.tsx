"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Lock } from "lucide-react";
import { cn } from "@/utils/cn";
import { AccountCard } from "./AccountCard";
import {
  THEME_DEFINITIONS,
  daysUntilUnlock,
  isPlanetThemeId,
  isThemeUnlocked,
  unlockProgress,
  type ThemeId,
} from "@/lib/themes";

/**
 * Uses useSyncExternalStore to correctly detect client-side rendering without
 * triggering the react-hooks/set-state-in-effect lint rule.
 */
function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

interface AppearanceSectionProps {
  productiveDayCount: number;
}

function ThemeSwatch({
  background,
  surface,
  primary,
  accent,
}: {
  background: string;
  surface: string;
  primary: string;
  accent: string;
}) {
  return (
    <span className="flex items-center gap-1" aria-hidden="true">
      <span className="size-3 rounded-full border border-black/10" style={{ background }} />
      <span className="size-3 rounded-full border border-black/10" style={{ background: surface }} />
      <span className="size-3 rounded-full border border-black/10" style={{ background: primary }} />
      <span className="size-3 rounded-full border border-black/10" style={{ background: accent }} />
    </span>
  );
}

export function AppearanceSection({ productiveDayCount }: AppearanceSectionProps) {
  const { theme, setTheme } = useTheme();
  const isClient = useIsClient();

  function handleSelect(id: ThemeId, unlocked: boolean) {
    if (!unlocked) return;
    setTheme(id);
  }

  return (
    <AccountCard
      description="Themes unlock as you complete tasks on more days."
      className="p-4 gap-3 [@media(max-height:820px)]:gap-2"
    >
      <p className="text-xs text-[hsl(var(--muted-foreground))] -mt-1">
        {productiveDayCount === 0
          ? "No productive days yet — complete a task to start unlocking planet themes."
          : `${productiveDayCount} productive day${productiveDayCount === 1 ? "" : "s"} earned.`}
      </p>

      <div
        role="radiogroup"
        aria-label="Theme"
        className="grid grid-cols-1 gap-2 sm:grid-cols-2 [@media(max-height:820px)]:gap-1.5"
      >
        {THEME_DEFINITIONS.map((def) => {
          const unlocked = isThemeUnlocked(def.id, productiveDayCount);
          const selected = isClient && theme === def.id;
          const progress = isPlanetThemeId(def.id)
            ? unlockProgress(def.id, productiveDayCount)
            : null;
          const remaining = isPlanetThemeId(def.id)
            ? daysUntilUnlock(def.id, productiveDayCount)
            : 0;
          const planet = isPlanetThemeId(def.id);

          return (
            <button
              key={def.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-disabled={!unlocked}
              tabIndex={0}
              onClick={() => handleSelect(def.id, unlocked)}
              onKeyDown={(e) => {
                if (!unlocked && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                }
              }}
              className={cn(
                "relative flex flex-col items-start gap-2 rounded-lg border px-3 py-3 text-left text-sm transition-colors",
                "[@media(max-height:820px)]:gap-1.5 [@media(max-height:820px)]:py-2",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--background))]",
                selected
                  ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 text-[hsl(var(--foreground))]"
                  : unlocked
                    ? "border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] cursor-pointer"
                    : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] opacity-80 cursor-default"
              )}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="font-medium">{def.label}</span>
                <div className="flex items-center gap-1.5">
                  {!unlocked && <Lock className="size-3.5 shrink-0" aria-hidden="true" />}
                  <ThemeSwatch {...def.preview} />
                </div>
              </div>

              <span className="text-xs text-[hsl(var(--muted-foreground))]">{def.description}</span>

              {!unlocked && progress && (
                <div className="mt-0.5 flex w-full flex-col gap-1.5 [@media(max-height:820px)]:gap-1">
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">
                    Complete tasks on {progress.required} different days
                  </span>
                  <div
                    className="h-1.5 w-full rounded-full bg-[hsl(var(--muted))] overflow-hidden"
                    role="progressbar"
                    aria-valuenow={progress.current}
                    aria-valuemin={0}
                    aria-valuemax={progress.required}
                    aria-label={`${def.label} unlock progress`}
                  >
                    <div
                      className="h-full rounded-full bg-[hsl(var(--primary))]/70"
                      style={{ width: `${(progress.current / progress.required) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">
                    {progress.current} / {progress.required} productive days
                    {remaining > 0
                      ? ` — ${def.label} is ${remaining} productive day${remaining === 1 ? "" : "s"} away.`
                      : null}
                  </span>
                </div>
              )}

              {unlocked && planet && (
                <span className="text-xs text-[hsl(var(--muted-foreground))]">Unlocked</span>
              )}
            </button>
          );
        })}
      </div>
    </AccountCard>
  );
}
