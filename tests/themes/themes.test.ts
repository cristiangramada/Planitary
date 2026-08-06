import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_THEME,
  FREE_THEME_IDS,
  PLANET_UNLOCK_THRESHOLDS,
  THEME_DEFINITIONS,
  THEME_IDS,
  daysUntilUnlock,
  isThemeId,
  isThemeUnlocked,
  resolveActiveTheme,
  resolveStoredTheme,
  themesUnlockedAtCount,
  unlockProgress,
  unlockedThemes,
  type PlanetThemeId,
} from "@/lib/themes";
import { formatThemeUnlockMessage } from "@/lib/theme-unlock-message";
import { isValidProductiveDate } from "@/lib/productive-days";

describe("theme metadata and thresholds", () => {
  test("exposes exactly ten themes including Dark and Light", () => {
    assert.equal(THEME_IDS.length, 10);
    assert.deepEqual([...THEME_IDS].slice(0, 2), ["dark", "light"]);
    assert.equal(THEME_DEFINITIONS.length, 10);
  });

  test("planet unlock thresholds match the product milestones", () => {
    assert.deepEqual(PLANET_UNLOCK_THRESHOLDS, {
      mercury: 3,
      venus: 7,
      earth: 14,
      mars: 21,
      jupiter: 35,
      saturn: 50,
      uranus: 75,
      neptune: 100,
    });
  });

  test("each definition unlockAt matches the central threshold map", () => {
    for (const def of THEME_DEFINITIONS) {
      if (def.id === "dark" || def.id === "light") {
        assert.equal(def.unlockAt, null);
      } else {
        assert.equal(def.unlockAt, PLANET_UNLOCK_THRESHOLDS[def.id]);
      }
    }
  });

  test("default theme is Dark", () => {
    assert.equal(DEFAULT_THEME, "dark");
  });
});

describe("Dark and Light always unlocked", () => {
  test("free themes are unlocked at zero productive days", () => {
    for (const id of FREE_THEME_IDS) {
      assert.equal(isThemeUnlocked(id, 0), true);
    }
  });

  test("free themes remain unlocked at high counts", () => {
    for (const id of FREE_THEME_IDS) {
      assert.equal(isThemeUnlocked(id, 1000), true);
    }
  });
});

describe("planet unlock boundaries", () => {
  const cases: [PlanetThemeId, number][] = [
    ["mercury", 3],
    ["venus", 7],
    ["earth", 14],
    ["mars", 21],
    ["jupiter", 35],
    ["saturn", 50],
    ["uranus", 75],
    ["neptune", 100],
  ];

  for (const [id, required] of cases) {
    test(`${id} locks below ${required} and unlocks at exactly ${required}`, () => {
      assert.equal(isThemeUnlocked(id, required - 1), false);
      assert.equal(isThemeUnlocked(id, required), true);
      assert.equal(isThemeUnlocked(id, required + 1), true);
    });
  }

  test("themesUnlockedAtCount returns only themes that hit the exact milestone", () => {
    assert.deepEqual(themesUnlockedAtCount(3), ["mercury"]);
    assert.deepEqual(themesUnlockedAtCount(7), ["venus"]);
    assert.deepEqual(themesUnlockedAtCount(4), []);
    assert.deepEqual(themesUnlockedAtCount(0), []);
  });

  test("unlockedThemes grows cumulatively", () => {
    assert.deepEqual(unlockedThemes(0), ["dark", "light"]);
    assert.deepEqual(unlockedThemes(3), ["dark", "light", "mercury"]);
    assert.deepEqual(unlockedThemes(7), ["dark", "light", "mercury", "venus"]);
    assert.ok(unlockedThemes(100).includes("neptune"));
    assert.equal(unlockedThemes(100).length, 10);
  });

  test("unlockProgress and daysUntilUnlock report remaining work", () => {
    assert.deepEqual(unlockProgress("mars", 14), {
      current: 14,
      required: 21,
      remaining: 7,
      unlocked: false,
    });
    assert.equal(daysUntilUnlock("mars", 14), 7);
    assert.deepEqual(unlockProgress("mars", 21), {
      current: 21,
      required: 21,
      remaining: 0,
      unlocked: true,
    });
  });
});

describe("stored theme validation", () => {
  test("invalid stored themes fall back to Dark", () => {
    assert.equal(resolveStoredTheme("neon"), DEFAULT_THEME);
    assert.equal(resolveStoredTheme(null), DEFAULT_THEME);
    assert.equal(resolveStoredTheme(undefined), DEFAULT_THEME);
    assert.equal(resolveStoredTheme(42), DEFAULT_THEME);
    assert.equal(isThemeId("dark"), true);
    assert.equal(isThemeId("pluto"), false);
  });

  test("locked planet themes fall back to Dark", () => {
    assert.equal(resolveActiveTheme("mars", 0), "dark");
    assert.equal(resolveActiveTheme("neptune", 99), "dark");
    assert.equal(resolveActiveTheme("mercury", 2), "dark");
  });

  test("existing unlocked theme selection persists", () => {
    assert.equal(resolveActiveTheme("light", 0), "light");
    assert.equal(resolveActiveTheme("dark", 0), "dark");
    assert.equal(resolveActiveTheme("mercury", 3), "mercury");
    assert.equal(resolveActiveTheme("neptune", 100), "neptune");
  });
});

describe("productive date validation", () => {
  test("accepts valid YYYY-MM-DD calendar dates", () => {
    assert.equal(isValidProductiveDate("2026-08-05"), true);
    assert.equal(isValidProductiveDate("2024-02-29"), true);
  });

  test("rejects malformed or impossible dates", () => {
    assert.equal(isValidProductiveDate("2026-13-01"), false);
    assert.equal(isValidProductiveDate("2026-02-30"), false);
    assert.equal(isValidProductiveDate("08-05-2026"), false);
    assert.equal(isValidProductiveDate(""), false);
  });
});

describe("unique productive-day counting semantics", () => {
  test("multiple completions on one date still count as one day toward unlock", () => {
    // Simulate a Set of productive dates — the durable table enforces uniqueness.
    const days = new Set<string>();
    for (const date of ["2026-08-01", "2026-08-01", "2026-08-01", "2026-08-02"]) {
      days.add(date);
    }
    assert.equal(days.size, 2);
    assert.equal(isThemeUnlocked("mercury", days.size), false);
    days.add("2026-08-03");
    assert.equal(isThemeUnlocked("mercury", days.size), true);
  });
});

describe("unlock toast copy", () => {
  test("names a single unlocked theme", () => {
    assert.match(formatThemeUnlockMessage(["mercury"]), /Mercury theme unlocked/);
  });

  test("names multiple unlocked themes", () => {
    const msg = formatThemeUnlockMessage(["mercury", "venus"]);
    assert.match(msg, /Mercury/);
    assert.match(msg, /Venus/);
  });
});
