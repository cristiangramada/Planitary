/**
 * Per-account Tasks page column widths. Stored in localStorage keyed by user id
 * so each signed-in account keeps its own layout on this device.
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

export function readTasksLayoutPreference(
  userId: string
): TasksLayoutPreference | null {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
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

export function writeTasksLayoutPreference(
  userId: string,
  layout: TasksLayoutPreference
): void {
  try {
    localStorage.setItem(
      storageKey(userId),
      JSON.stringify({
        listsWidth: clampListsWidth(layout.listsWidth),
        tasksWidth: clampTasksWidth(layout.tasksWidth),
      })
    );
  } catch {
    // Quota / private mode — preference just won't persist.
  }
}
