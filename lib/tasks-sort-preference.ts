/**
 * Per-account Tasks sort preference. Stored in localStorage and a cookie
 * keyed by user id so the server can paint the saved sort on first load —
 * cookie avoids the default-"Priority" flash before localStorage hydrates.
 */

export const TASKS_SORT_KEYS = [
  "priority",
  "due_date",
  "created_at",
  "created_oldest",
  "custom",
] as const;

export type TasksSortKey = (typeof TASKS_SORT_KEYS)[number];

function storageKey(userId: string): string {
  return `planitary:tasks-sort:${userId}`;
}

/** Cookie name (no colons — those are awkward in cookie headers). */
export function tasksSortCookieName(userId: string): string {
  return `planitary_tasks_sort_${userId}`;
}

const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 400; // ~13 months

function isTasksSortKey(value: string): value is TasksSortKey {
  return (TASKS_SORT_KEYS as readonly string[]).includes(value);
}

/** Parses a stored sort value (cookie or localStorage). */
export function parseTasksSortPreferenceRaw(
  raw: string | null | undefined
): TasksSortKey | null {
  if (!raw) return null;
  return isTasksSortKey(raw) ? raw : null;
}

function writeSortCookie(userId: string, sort: TasksSortKey): void {
  try {
    const name = tasksSortCookieName(userId);
    const value = encodeURIComponent(sort);
    document.cookie = `${name}=${value}; path=/; max-age=${COOKIE_MAX_AGE_SEC}; SameSite=Lax`;
  } catch {
    // Private mode / disabled cookies — localStorage still works client-side.
  }
}

export function readTasksSortPreference(userId: string): TasksSortKey | null {
  try {
    return parseTasksSortPreferenceRaw(localStorage.getItem(storageKey(userId)));
  } catch {
    return null;
  }
}

export function writeTasksSortPreference(userId: string, sort: TasksSortKey): void {
  try {
    localStorage.setItem(storageKey(userId), sort);
  } catch {
    // Quota / private mode — preference just won't persist in localStorage.
  }
  writeSortCookie(userId, sort);
}
