/**
 * Per-account Tasks sort preference. Stored in localStorage keyed by user id
 * so each signed-in account keeps its own choice on this device.
 */

export const TASKS_SORT_KEYS = [
  "priority",
  "due_date",
  "created_at",
  "created_oldest",
] as const;

export type TasksSortKey = (typeof TASKS_SORT_KEYS)[number];

function storageKey(userId: string): string {
  return `planitary:tasks-sort:${userId}`;
}

function isTasksSortKey(value: string): value is TasksSortKey {
  return (TASKS_SORT_KEYS as readonly string[]).includes(value);
}

export function readTasksSortPreference(userId: string): TasksSortKey | null {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (raw && isTasksSortKey(raw)) return raw;
    return null;
  } catch {
    return null;
  }
}

export function writeTasksSortPreference(userId: string, sort: TasksSortKey): void {
  try {
    localStorage.setItem(storageKey(userId), sort);
  } catch {
    // Quota / private mode — preference just won't persist.
  }
}
