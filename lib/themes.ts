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
  surface: string;
  primary: string;
  accent: string;
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
    description: "Deep navy for everyday focus.",
    unlockAt: null,
    preview: {
      background: "#070b14",
      surface: "#121826",
      primary: "#8b7cf6",
      accent: "#6366f1",
    },
  },
  {
    id: "light",
    label: "Light",
    description: "Warm bone-white workspace.",
    unlockAt: null,
    preview: {
      background: "#F5F1E8",
      surface: "#FFFDF8",
      primary: "#6b5ce0",
      accent: "#8b7cf6",
    },
  },
  {
    id: "mercury",
    label: "Mercury",
    description: "Restrained metallic graphite.",
    unlockAt: PLANET_UNLOCK_THRESHOLDS.mercury,
    preview: {
      background: "#1a1c1f",
      surface: "#2a2e33",
      primary: "#a8b4c0",
      accent: "#c5d0db",
    },
  },
  {
    id: "venus",
    label: "Venus",
    description: "Warm cream and burnished gold.",
    unlockAt: PLANET_UNLOCK_THRESHOLDS.venus,
    preview: {
      background: "#f3ebe0",
      surface: "#faf4eb",
      primary: "#b8893d",
      accent: "#c4784a",
    },
  },
  {
    id: "earth",
    label: "Earth",
    description: "Ocean blue and forest calm.",
    unlockAt: PLANET_UNLOCK_THRESHOLDS.earth,
    preview: {
      background: "#0c1a22",
      surface: "#152a33",
      primary: "#3d9b7a",
      accent: "#4a8fa8",
    },
  },
  {
    id: "mars",
    label: "Mars",
    description: "Rust and terracotta focus.",
    unlockAt: PLANET_UNLOCK_THRESHOLDS.mars,
    preview: {
      background: "#1a1210",
      surface: "#2a1c18",
      primary: "#d4784a",
      accent: "#a85a38",
    },
  },
  {
    id: "jupiter",
    label: "Jupiter",
    description: "Sand, caramel, and copper.",
    unlockAt: PLANET_UNLOCK_THRESHOLDS.jupiter,
    preview: {
      background: "#1c1612",
      surface: "#2a221c",
      primary: "#c4895a",
      accent: "#a85c4a",
    },
  },
  {
    id: "saturn",
    label: "Saturn",
    description: "Champagne elegance on charcoal.",
    unlockAt: PLANET_UNLOCK_THRESHOLDS.saturn,
    preview: {
      background: "#12141c",
      surface: "#1c2030",
      primary: "#c4a574",
      accent: "#8a7a5c",
    },
  },
  {
    id: "uranus",
    label: "Uranus",
    description: "Crisp ice blue and aqua.",
    unlockAt: PLANET_UNLOCK_THRESHOLDS.uranus,
    preview: {
      background: "#0e171c",
      surface: "#162228",
      primary: "#5eb8c4",
      accent: "#7ec8d4",
    },
  },
  {
    id: "neptune",
    label: "Neptune",
    description: "Midnight ocean and indigo.",
    unlockAt: PLANET_UNLOCK_THRESHOLDS.neptune,
    preview: {
      background: "#060b18",
      surface: "#0e1730",
      primary: "#6b6fd4",
      accent: "#8b5cf6",
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
