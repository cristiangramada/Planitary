import type { SupabaseClient } from "@supabase/supabase-js";
import type { TaskList, TaskWithDetails } from "@/types";

// ---------------------------------------------------------------------------
// Fixed color palette — eight planet-inspired hexes (Mercury → Neptune),
// kept visually distinct.
// ---------------------------------------------------------------------------

const PLANET_COLORS = [
  { planet: "Mercury", color: "#94A3B8" }, // cool slate gray
  { planet: "Venus",   color: "#EAB308" }, // bright gold-yellow
  { planet: "Earth",   color: "#16A34A" }, // verdant green
  { planet: "Mars",    color: "#DC2626" }, // iron red
  { planet: "Jupiter", color: "#EA580C" }, // banded orange
  { planet: "Saturn",  color: "#D4A574" }, // pale bronze
  { planet: "Uranus",  color: "#14B8A6" }, // icy teal
  { planet: "Neptune", color: "#2563EB" }, // deep ocean blue
] as const;

export const LIST_COLORS = PLANET_COLORS.map((p) => p.color);

export type ListColor = (typeof PLANET_COLORS)[number]["color"];

/** @deprecated Prefer `ListColor`. Kept as an alias for existing call sites. */
export type ListColorKey = ListColor;

export function isListColor(value: string): value is ListColor {
  return (LIST_COLORS as readonly string[]).includes(value);
}

/** @deprecated Prefer `isListColor`. */
export const isListColorKey = isListColor;

/** Legacy named keys from the first Lists palette → planet hex, for display only. */
const LEGACY_LIST_COLOR_KEYS: Record<string, string> = {
  red: "#DC2626",
  orange: "#EA580C",
  yellow: "#EAB308",
  green: "#16A34A",
  blue: "#2563EB",
  purple: "#9333EA",
  pink: "#DB2777",
  gray: "#94A3B8",
};

/** Resolves a stored list color to a CSS hex for swatches. */
export function resolveListColor(color: string | null | undefined): string | null {
  if (!color) return null;
  if (isListColor(color)) return color;
  return LEGACY_LIST_COLOR_KEYS[color] ?? null;
}

const MAX_LIST_NAME_LENGTH = 50;

// ---------------------------------------------------------------------------
// Name validation — used both for instant client-side feedback and shared by
// the create/rename helpers. The database enforces the same case-insensitive
// uniqueness via a unique index, as the ultimate source of truth.
// ---------------------------------------------------------------------------

export interface ListNameValidationOk {
  valid: true;
  name: string;
}
export interface ListNameValidationErr {
  valid: false;
  error: string;
}
export type ListNameValidation = ListNameValidationOk | ListNameValidationErr;

/**
 * Validates a candidate List name: trims whitespace, rejects empty/overlong
 * names, and rejects a case-insensitive duplicate against `existingNames`
 * (pass the user's other List names; when renaming, exclude the list being
 * renamed).
 */
export function validateListName(
  rawName: string,
  existingNames: string[]
): ListNameValidation {
  const name = rawName.trim();
  if (name.length === 0) {
    return { valid: false, error: "List name can't be empty." };
  }
  if (name.length > MAX_LIST_NAME_LENGTH) {
    return { valid: false, error: `List name must be ${MAX_LIST_NAME_LENGTH} characters or fewer.` };
  }
  const lower = name.toLowerCase();
  if (existingNames.some((n) => n.trim().toLowerCase() === lower)) {
    return { valid: false, error: "A list with that name already exists." };
  }
  return { valid: true, name };
}

/** Postgres unique_violation error code, used to map a DB-level duplicate
 *  rejection (e.g. a race between two tabs) to the same friendly message. */
const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === UNIQUE_VIOLATION
  );
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/** Fetches all Lists for the signed-in user, ordered for stable display. */
export async function fetchTaskLists(supabase: SupabaseClient): Promise<TaskList[]> {
  const { data, error } = await supabase
    .from("task_lists")
    .select("*")
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data as TaskList[]) ?? [];
}

// ---------------------------------------------------------------------------
// Counts — derived client-side from the already-loaded task set (the Tasks
// page loads all of a user's tasks up front), so no extra query is needed
// and there's no N+1 per List.
// ---------------------------------------------------------------------------

/** Reserved key for the Inbox bucket (tasks with a null list_id). */
export const INBOX_COUNT_KEY = "inbox";

export type ListTaskCounts = Record<string, number>;

/** Counts active (non-completed) tasks per list, plus an "inbox" bucket for
 *  unassigned tasks. Completed tasks are intentionally excluded. */
export function computeListTaskCounts(tasks: TaskWithDetails[]): ListTaskCounts {
  const counts: ListTaskCounts = {};
  for (const task of tasks) {
    if (task.status !== "active") continue;
    const key = task.list_id ?? INBOX_COUNT_KEY;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Create / rename / delete
// ---------------------------------------------------------------------------

/** Creates a List at the bottom of the user's list order. Throws a friendly
 *  Error on validation or duplicate-name failure. */
export async function createTaskList(
  supabase: SupabaseClient,
  userId: string,
  name: string,
  color: ListColor | null,
  existingLists: TaskList[]
): Promise<TaskList> {
  const validation = validateListName(name, existingLists.map((l) => l.name));
  if (!validation.valid) throw new Error(validation.error);

  const nextPosition =
    existingLists.length > 0 ? Math.max(...existingLists.map((l) => l.position)) + 1 : 0;

  const { data, error } = await supabase
    .from("task_lists")
    .insert({
      user_id: userId,
      name: validation.name,
      color,
      position: nextPosition,
    })
    .select("*")
    .single();

  if (error) {
    if (isUniqueViolation(error)) {
      throw new Error("A list with that name already exists.");
    }
    throw new Error("Couldn't create the list.");
  }
  return data as TaskList;
}

/** Renames a List. Throws a friendly Error on validation or duplicate-name failure. */
export async function renameTaskList(
  supabase: SupabaseClient,
  listId: string,
  name: string,
  existingLists: TaskList[]
): Promise<TaskList> {
  const validation = validateListName(
    name,
    existingLists.filter((l) => l.id !== listId).map((l) => l.name)
  );
  if (!validation.valid) throw new Error(validation.error);

  const { data, error } = await supabase
    .from("task_lists")
    .update({ name: validation.name })
    .eq("id", listId)
    .select("*")
    .single();

  if (error) {
    if (isUniqueViolation(error)) {
      throw new Error("A list with that name already exists.");
    }
    throw new Error("Couldn't rename the list.");
  }
  return data as TaskList;
}

/** Updates a List's color (or clears it with `null`). */
export async function updateTaskListColor(
  supabase: SupabaseClient,
  listId: string,
  color: ListColor | null
): Promise<TaskList> {
  const { data, error } = await supabase
    .from("task_lists")
    .update({ color })
    .eq("id", listId)
    .select("*")
    .single();

  if (error) throw new Error("Couldn't update the list color.");
  return data as TaskList;
}

/** Deletes a List. Its Tasks are preserved and moved to Inbox automatically
 *  via the `tasks.list_id` foreign key's `on delete set null`. Their manual
 *  Custom positions are cleared first so they land at the bottom of Inbox
 *  instead of interleaving by a position that meant something in the old List. */
export async function deleteTaskList(supabase: SupabaseClient, listId: string): Promise<void> {
  const { error: clearErr } = await supabase
    .from("tasks")
    .update({ custom_position: null })
    .eq("list_id", listId);
  if (clearErr) throw new Error("Couldn't delete the list.");

  const { error } = await supabase.from("task_lists").delete().eq("id", listId);
  if (error) throw new Error("Couldn't delete the list.");
}

/** Persists a new List order by writing contiguous `position` values (0..n-1). */
export async function reorderTaskLists(
  supabase: SupabaseClient,
  orderedIds: string[]
): Promise<void> {
  const results = await Promise.all(
    orderedIds.map((id, position) =>
      supabase.from("task_lists").update({ position }).eq("id", id)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error("Couldn't reorder lists.");
}

// ---------------------------------------------------------------------------
// Moving tasks between Lists
// ---------------------------------------------------------------------------

/** Moves a task to a List (or to Inbox, when `listId` is null). Ownership of
 *  the target List is enforced by RLS plus a database trigger — an attempt
 *  to move a task to a List the user doesn't own is rejected server-side.
 *  The manual Custom position is cleared so the task lands at the bottom of
 *  its destination rather than in the middle of it. */
export async function moveTaskToList(
  supabase: SupabaseClient,
  taskId: string,
  listId: string | null
): Promise<void> {
  const { error } = await supabase
    .from("tasks")
    .update({ list_id: listId, custom_position: null })
    .eq("id", taskId);
  if (error) throw new Error("Couldn't move the task.");
}
