/**
 * Per-account Tasks page column widths. Stored in localStorage and a cookie
 * keyed by user id so the server can paint the saved layout on first load —
 * cookie avoids the default-width flash before localStorage hydrates.
 */

export const TASKS_LAYOUT_DEFAULTS = {
  listsWidth: 240,
  tasksWidth: 480,
} as const;

export const TASKS_LAYOUT_LIMITS = {
  listsMin: 160,
  listsMax: 400,
  tasksMin: 280,
  // Soft ceiling only — live drag clamps against remaining row space / detailMin.
  tasksMax: 1600,
  detailMin: 400,
} as const;

export type TasksLayoutPreference = {
  listsWidth: number;
  tasksWidth: number;
};

function storageKey(userId: string): string {
  return `planitary:tasks-layout:${userId}`;
}

/** Cookie name (no colons — those are awkward in cookie headers). */
export function tasksLayoutCookieName(userId: string): string {
  return `planitary_tasks_layout_${userId}`;
}

const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 400; // ~13 months

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function clampListsWidth(width: number): number {
  return Math.min(
    TASKS_LAYOUT_LIMITS.listsMax,
    Math.max(TASKS_LAYOUT_LIMITS.listsMin, Math.round(width))
  );
}

export function clampTasksWidth(width: number): number {
  return Math.min(
    TASKS_LAYOUT_LIMITS.tasksMax,
    Math.max(TASKS_LAYOUT_LIMITS.tasksMin, Math.round(width))
  );
}

/** Parses a stored JSON layout value (cookie or localStorage). */
export function parseTasksLayoutPreferenceRaw(
  raw: string | null | undefined
): TasksLayoutPreference | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const { listsWidth, tasksWidth } = parsed as Record<string, unknown>;
    if (!isFiniteNumber(listsWidth) || !isFiniteNumber(tasksWidth)) return null;
    return {
      listsWidth: clampListsWidth(listsWidth),
      tasksWidth: clampTasksWidth(tasksWidth),
    };
  } catch {
    return null;
  }
}

function writeLayoutCookie(userId: string, layout: TasksLayoutPreference): void {
  try {
    const name = tasksLayoutCookieName(userId);
    const value = encodeURIComponent(
      JSON.stringify({
        listsWidth: clampListsWidth(layout.listsWidth),
        tasksWidth: clampTasksWidth(layout.tasksWidth),
      })
    );
    document.cookie = `${name}=${value}; path=/; max-age=${COOKIE_MAX_AGE_SEC}; SameSite=Lax`;
  } catch {
    // Private mode / disabled cookies — localStorage still works client-side.
  }
}

export function readTasksLayoutPreference(
  userId: string
): TasksLayoutPreference | null {
  try {
    return parseTasksLayoutPreferenceRaw(localStorage.getItem(storageKey(userId)));
  } catch {
    return null;
  }
}

export function writeTasksLayoutPreference(
  userId: string,
  layout: TasksLayoutPreference
): void {
  const clamped = {
    listsWidth: clampListsWidth(layout.listsWidth),
    tasksWidth: clampTasksWidth(layout.tasksWidth),
  };
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(clamped));
  } catch {
    // Quota / private mode — preference just won't persist in localStorage.
  }
  writeLayoutCookie(userId, clamped);
}
