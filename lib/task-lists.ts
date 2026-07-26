import type { SupabaseClient } from "@supabase/supabase-js";
import type { TaskList, TaskWithDetails } from "@/types";

// ---------------------------------------------------------------------------
// Fixed color palette
//
// A small, stable set of named colors rather than a free-form color picker.
// The stored value is the color key (e.g. "blue"), not a hex/CSS value, so
// the palette's exact shades can change without touching stored data.
// ---------------------------------------------------------------------------

export const LIST_COLOR_KEYS = [
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "gray",
] as const;

export type ListColorKey = (typeof LIST_COLOR_KEYS)[number];

export function isListColorKey(value: string): value is ListColorKey {
  return (LIST_COLOR_KEYS as readonly string[]).includes(value);
}

/** Swatch hex per color key. Chosen to be legible in both dark and light themes. */
export const LIST_COLOR_SWATCH: Record<ListColorKey, string> = {
  red: "#DC2626",
  orange: "#EA580C",
  yellow: "#EAB308",
  green: "#16A34A",
  blue: "#2563EB",
  purple: "#9333EA",
  pink: "#DB2777",
  gray: "#94A3B8",
};

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
  color: ListColorKey | null,
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
  color: ListColorKey | null
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
 *  via the `tasks.list_id` foreign key's `on delete set null`. */
export async function deleteTaskList(supabase: SupabaseClient, listId: string): Promise<void> {
  const { error } = await supabase.from("task_lists").delete().eq("id", listId);
  if (error) throw new Error("Couldn't delete the list.");
}

// ---------------------------------------------------------------------------
// Moving tasks between Lists
// ---------------------------------------------------------------------------

/** Moves a task to a List (or to Inbox, when `listId` is null). Ownership of
 *  the target List is enforced by RLS plus a database trigger — an attempt
 *  to move a task to a List the user doesn't own is rejected server-side. */
export async function moveTaskToList(
  supabase: SupabaseClient,
  taskId: string,
  listId: string | null
): Promise<void> {
  const { error } = await supabase.from("tasks").update({ list_id: listId }).eq("id", taskId);
  if (error) throw new Error("Couldn't move the task.");
}
