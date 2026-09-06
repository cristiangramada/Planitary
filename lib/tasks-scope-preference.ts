/**
 * Per-account last Tasks scope (Inbox or a List). Stored in localStorage and a
 * cookie keyed by user id so returning to /tasks restores the same place —
 * cookie lets the server redirect before any Inbox flash can paint.
 */

import {
  buildTasksScopeParams,
  type TasksScope,
} from "@/lib/tasks-url-state";

function storageKey(userId: string): string {
  return `planitary:tasks-scope:${userId}`;
}

/** Cookie name (no colons — those are awkward in cookie headers). */
export function tasksScopeCookieName(userId: string): string {
  return `planitary_tasks_scope_${userId}`;
}

/** Device-local last Tasks href for sidebar links (avoids bare /tasks). */
function lastHrefStorageKey(userId: string): string {
  return `planitary:tasks-last-href:${userId}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 400; // ~13 months

/** Parses a stored JSON scope value. When `ownedListIds` is omitted, list ids
 *  are only checked for UUID shape (server redirect before lists are loaded). */
export function parseTasksScopePreferenceRaw(
  raw: string | null | undefined,
  ownedListIds?: ReadonlySet<string>
): TasksScope | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const { type, id } = parsed as Record<string, unknown>;
    if (type === "inbox") return { type: "inbox" };
    if (type === "list" && typeof id === "string" && UUID_RE.test(id)) {
      if (ownedListIds && !ownedListIds.has(id)) return null;
      return { type: "list", id };
    }
    return null;
  } catch {
    return null;
  }
}

export function tasksScopeToHref(scope: TasksScope): string {
  return `/tasks?${buildTasksScopeParams(scope).toString()}`;
}

function writeScopeCookie(userId: string, scope: TasksScope): void {
  try {
    const name = tasksScopeCookieName(userId);
    const value = encodeURIComponent(JSON.stringify(scope));
    document.cookie = `${name}=${value}; path=/; max-age=${COOKIE_MAX_AGE_SEC}; SameSite=Lax`;
  } catch {
    // Private mode / disabled cookies — localStorage still works client-side.
  }
}

export function readTasksScopePreference(
  userId: string,
  ownedListIds: ReadonlySet<string>
): TasksScope | null {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return parseTasksScopePreferenceRaw(raw, ownedListIds);
  } catch {
    return null;
  }
}

export function writeTasksScopePreference(
  userId: string,
  scope: TasksScope
): void {
  const serialized = JSON.stringify(scope);
  const href = tasksScopeToHref(scope);
  try {
    localStorage.setItem(storageKey(userId), serialized);
    localStorage.setItem(lastHrefStorageKey(userId), href);
  } catch {
    // Quota / private mode — preference just won't persist in localStorage.
  }
  writeScopeCookie(userId, scope);
}

/** Best-effort last Tasks URL for nav links. Falls back to migrating the
 *  current user's stored scope when the dedicated href key is missing. */
export function peekTasksScopeHref(userId: string): string {
  try {
    const lastHrefKey = lastHrefStorageKey(userId);
    const last = localStorage.getItem(lastHrefKey);
    if (last && last.startsWith("/tasks")) return last;

    const scope = parseTasksScopePreferenceRaw(
      localStorage.getItem(storageKey(userId))
    );
    if (!scope) return "/tasks";
    const href = tasksScopeToHref(scope);
    localStorage.setItem(lastHrefKey, href);
    return href;
  } catch {
    // ignore
  }
  return "/tasks";
}
