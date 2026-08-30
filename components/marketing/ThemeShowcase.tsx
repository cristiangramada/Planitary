import { THEME_DEFINITIONS, PLANET_UNLOCK_THRESHOLDS, isPlanetThemeId } from "@/lib/themes";

/**
 * Compact swatch grid built directly from the central theme definitions —
 * no separate hardcoded palette. Each swatch mimics a tiny app window.
 */
export function ThemeShowcase() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
      {THEME_DEFINITIONS.map((theme) => (
        <div
          key={theme.id}
          className="flex flex-col items-center gap-2.5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3"
        >
          <div
            aria-hidden="true"
            className="h-14 w-full rounded-lg border flex items-center gap-1.5 px-2.5"
            style={{ backgroundColor: theme.preview.background, borderColor: theme.preview.border }}
          >
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: theme.preview.primary }} />
            <span className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: theme.preview.card }} />
          </div>
          <div className="text-center">
            <p className="text-xs font-semibold">{theme.label}</p>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
              {isPlanetThemeId(theme.id) ? `Day ${PLANET_UNLOCK_THRESHOLDS[theme.id]}` : "Included"}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
