/**
 * Central theme definitions and unlock rules for Planitary appearance.
 * Thresholds live here only — UI, validation, and unlock checks must import from this module.
 */

export const THEME_IDS = [
  "dark",
  "light",
  "mercury",
  "venus",
  "earth",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export const DEFAULT_THEME: ThemeId = "dark";

/** Always available — not gated by productive days. */
export const FREE_THEME_IDS = ["dark", "light"] as const satisfies readonly ThemeId[];

export type FreeThemeId = (typeof FREE_THEME_IDS)[number];

export type PlanetThemeId = Exclude<ThemeId, FreeThemeId>;

/** Cumulative unique productive days required to unlock each planet theme. */
export const PLANET_UNLOCK_THRESHOLDS = {
  mercury: 3,
  venus: 7,
  earth: 14,
  mars: 21,
  jupiter: 35,
  saturn: 50,
  uranus: 75,
  neptune: 100,
} as const satisfies Record<PlanetThemeId, number>;

export interface ThemeSwatchPreview {
  background: string;
  card: string;
  primary: string;
  border: string;
}

export interface ThemeDefinition {
  id: ThemeId;
  label: string;
  description: string;
  /** null = always unlocked */
  unlockAt: number | null;
  preview: ThemeSwatchPreview;
}

export const THEME_DEFINITIONS: readonly ThemeDefinition[] = [
  {
    id: "dark",
    label: "Dark",
    description: "Deep violet workspace.",
    unlockAt: null,
    preview: {
      background: "#05080F",
      card: "#0D121C",
      primary: "#735DEF",
      border: "#242C38",
    },
  },
  {
    id: "light",
    label: "Light",
    description: "Warm bone-white workspace.",
    unlockAt: null,
    preview: {
      background: "#F5F1EB",
      card: "#FBF9F4",
      primary: "#735DEF",
      border: "#DBD6CC",
    },
  },
  {
    id: "mercury",
    label: "Mercury",
    description: "Brushed silver and steel graphite.",
    unlockAt: PLANET_UNLOCK_THRESHOLDS.mercury,
    preview: {
      background: "#1A1C1E",
      card: "#232629",
      primary: "#A2AFB9",
      border: "#3A3D41",
    },
  },
  {
    id: "venus",
    label: "Venus",
    description: "Hazy bronze and candlelight amber.",
    unlockAt: PLANET_UNLOCK_THRESHOLDS.venus,
    preview: {
      background: "#201913",
      card: "#2E2219",
      primary: "#C89451",
      border: "#4B3B2F",
    },
  },
  {
    id: "earth",
    label: "Earth",
    description: "Gentle sage and earthy green.",
    unlockAt: PLANET_UNLOCK_THRESHOLDS.earth,
    preview: {
      background: "#121C1B",
      card: "#182523",
      primary: "#5A8772",
      border: "#243330",
    },
  },
  {
    id: "mars",
    label: "Mars",
    description: "Rust red and terracotta clay.",
    unlockAt: PLANET_UNLOCK_THRESHOLDS.mars,
    preview: {
      background: "#1C1412",
      card: "#291D19",
      primary: "#AB5A49",
      border: "#43312D",
    },
  },
  {
    id: "jupiter",
    label: "Jupiter",
    description: "Caramel sand and warm brown.",
    unlockAt: PLANET_UNLOCK_THRESHOLDS.jupiter,
    preview: {
      background: "#1C1712",
      card: "#28211B",
      primary: "#C38955",
      border: "#403830",
    },
  },
  {
    id: "saturn",
    label: "Saturn",
    description: "Champagne gold on midnight navy.",
    unlockAt: PLANET_UNLOCK_THRESHOLDS.saturn,
    preview: {
      background: "#0F111A",
      card: "#171A26",
      primary: "#BD9F6B",
      border: "#303340",
    },
  },
  {
    id: "uranus",
    label: "Uranus",
    description: "Frosted cyan and glacial aqua.",
    unlockAt: PLANET_UNLOCK_THRESHOLDS.uranus,
    preview: {
      background: "#0E1D25",
      card: "#152833",
      primary: "#5A9CB5",
      border: "#1E3948",
    },
  },
  {
    id: "neptune",
    label: "Neptune",
    description: "Abyssal indigo and ocean blue.",
    unlockAt: PLANET_UNLOCK_THRESHOLDS.neptune,
    preview: {
      background: "#0A0F1E",
      card: "#121A30",
      primary: "#3557B6",
      border: "#1E2948",
    },
  },
] as const;

const THEME_ID_SET = new Set<string>(THEME_IDS);

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && THEME_ID_SET.has(value);
}

export function isPlanetThemeId(value: ThemeId): value is PlanetThemeId {
  return value !== "dark" && value !== "light";
}

export function getThemeDefinition(id: ThemeId): ThemeDefinition {
  const def = THEME_DEFINITIONS.find((t) => t.id === id);
  if (!def) throw new Error(`Unknown theme: ${id}`);
  return def;
}

/** Resolve a stored preference to a safe ThemeId (invalid → Dark). */
export function resolveStoredTheme(value: unknown): ThemeId {
  return isThemeId(value) ? value : DEFAULT_THEME;
}

/**
 * Whether a theme is unlocked given the user's cumulative productive-day count.
 * Dark and Light are always unlocked.
 */
export function isThemeUnlocked(themeId: ThemeId, productiveDayCount: number): boolean {
  if (!isPlanetThemeId(themeId)) return true;
  return productiveDayCount >= PLANET_UNLOCK_THRESHOLDS[themeId];
}

/**
 * Validate a preferred theme against unlock progress.
 * Locked or invalid values fall back to Dark.
 */
export function resolveActiveTheme(
  preferred: unknown,
  productiveDayCount: number
): ThemeId {
  const theme = resolveStoredTheme(preferred);
  return isThemeUnlocked(theme, productiveDayCount) ? theme : DEFAULT_THEME;
}

/** Planet themes whose unlock threshold equals exactly `productiveDayCount`. */
export function themesUnlockedAtCount(productiveDayCount: number): PlanetThemeId[] {
  return (Object.keys(PLANET_UNLOCK_THRESHOLDS) as PlanetThemeId[]).filter(
    (id) => PLANET_UNLOCK_THRESHOLDS[id] === productiveDayCount
  );
}

/** Themes unlocked at or below the given count (including free themes). */
export function unlockedThemes(productiveDayCount: number): ThemeId[] {
  return THEME_IDS.filter((id) => isThemeUnlocked(id, productiveDayCount));
}

export function daysUntilUnlock(themeId: PlanetThemeId, productiveDayCount: number): number {
  return Math.max(0, PLANET_UNLOCK_THRESHOLDS[themeId] - productiveDayCount);
}

export function unlockProgress(themeId: PlanetThemeId, productiveDayCount: number): {
  current: number;
  required: number;
  remaining: number;
  unlocked: boolean;
} {
  const required = PLANET_UNLOCK_THRESHOLDS[themeId];
  const current = Math.min(productiveDayCount, required);
  return {
    current,
    required,
    remaining: Math.max(0, required - productiveDayCount),
    unlocked: productiveDayCount >= required,
  };
}
