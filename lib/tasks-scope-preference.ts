/**
 * Per-account last Tasks scope (Inbox or a List). Stored in localStorage keyed
 * by user id so returning to /tasks restores the same place on this device.
 */

import type { TasksScope } from "@/lib/tasks-url-state";

function storageKey(userId: string): string {
  return `planitary:tasks-scope:${userId}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readTasksScopePreference(
  userId: string,
  ownedListIds: ReadonlySet<string>
): TasksScope | null {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const { type, id } = parsed as Record<string, unknown>;
    if (type === "inbox") return { type: "inbox" };
    if (
      type === "list" &&
      typeof id === "string" &&
      UUID_RE.test(id) &&
      ownedListIds.has(id)
    ) {
      return { type: "list", id };
    }
    return null;
  } catch {
    return null;
  }
}

export function writeTasksScopePreference(
  userId: string,
  scope: TasksScope
): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(scope));
  } catch {
    // Quota / private mode — preference just won't persist.
  }
}
