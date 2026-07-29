import type { SupabaseClient } from "@supabase/supabase-js";
import type { Task, Subtask, TaskList, TaskWithDetails, Priority, RepeatOption } from "@/types";
import {
  nextRecurrenceDate,
  resolveRepeatFields,
  type ExistingRepeatState,
} from "@/lib/recurrence";

/** Canonical priority ordering used everywhere tasks are priority-sorted. */
export const TASK_PRIORITY_ORDER: Record<Priority, number> = {
  high: 0,
  medium: 1,
  low: 2,
  none: 3,
};

// ---------------------------------------------------------------------------
// Internal raw shape returned by Supabase nested select
// ---------------------------------------------------------------------------

interface RawTaskRow extends Omit<Task, "priority" | "status"> {
  priority: string;
  status: string;
  subtasks: Subtask[];
  task_lists: Pick<TaskList, "id" | "name" | "color" | "icon"> | null;
}

/** Normalizes the Supabase nested-select shape into TaskWithDetails. */
function normalize(raw: RawTaskRow): TaskWithDetails {
  const { task_lists, ...fields } = raw;
  return {
    ...(fields as unknown as Task),
    subtasks: raw.subtasks ?? [],
    list: task_lists ?? null,
  };
}

const TASK_SELECT = `
  *,
  subtasks ( * ),
  task_lists ( id, name, color, icon )
` as const;

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/** Fetches all tasks for the signed-in user (includes subtasks). */
export async function fetchTasksWithDetails(
  supabase: SupabaseClient
): Promise<TaskWithDetails[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return ((data as RawTaskRow[]) ?? []).map(normalize);
}

/** Fetches active tasks due on a specific local date (YYYY-MM-DD), for the Dashboard. */
export async function fetchTasksDueOn(
  supabase: SupabaseClient,
  dateStr: string
): Promise<TaskWithDetails[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("status", "active")
    .eq("due_date", dateStr)
    .order("due_time", { ascending: true, nullsFirst: false });

  if (error) throw error;
  return ((data as RawTaskRow[]) ?? []).map(normalize);
}

/** Re-fetches a single task by id. Used after mutations to get the full object. */
async function refetchTask(
  supabase: SupabaseClient,
  taskId: string
): Promise<TaskWithDetails> {
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("id", taskId)
    .single();

  if (error) throw error;
  return normalize(data as RawTaskRow);
}

// ---------------------------------------------------------------------------
// Task CRUD
// ---------------------------------------------------------------------------

export interface TaskFormData {
  title: string;
  notes: string | null;
  priority: Priority;
  due_date: string | null;
  due_time: string | null;
  /** The List this task belongs to, or null for Inbox. */
  list_id: string | null;
  repeat: RepeatOption;
}

/** Subtask items as represented in the form (new items have no id). */
export interface SubtaskFormItem {
  id?: string;
  title: string;
  is_completed: boolean;
}

/** Creates a task with subtasks. Returns the full TaskWithDetails. */
export async function createTask(
  supabase: SupabaseClient,
  userId: string,
  data: TaskFormData,
  subtasks: SubtaskFormItem[]
): Promise<TaskWithDetails> {
  const repeatFields = resolveRepeatFields(data.repeat, data.due_date, null);

  const { data: task, error: taskErr } = await supabase
    .from("tasks")
    .insert({
      user_id: userId,
      title: data.title,
      notes: data.notes,
      priority: data.priority,
      due_date: data.due_date,
      due_time: data.due_time,
      list_id: data.list_id,
      ...repeatFields,
    })
    .select("id")
    .single();
  if (taskErr) throw taskErr;
  const taskId = task.id as string;

  if (subtasks.length > 0) {
    const { error } = await supabase.from("subtasks").insert(
      subtasks.map((s) => ({
        task_id: taskId,
        user_id: userId,
        title: s.title,
        is_completed: s.is_completed,
      }))
    );
    if (error) throw error;
  }

  return refetchTask(supabase, taskId);
}

/** Updates a task's fields and subtasks. Returns the full TaskWithDetails. */
export async function updateTask(
  supabase: SupabaseClient,
  taskId: string,
  userId: string,
  data: TaskFormData,
  subtasks: SubtaskFormItem[]
): Promise<TaskWithDetails> {
  const { data: existing, error: existingErr } = await supabase
    .from("tasks")
    .select("repeat, recurrence_id, recurrence_anchor_day, due_date")
    .eq("id", taskId)
    .single();
  if (existingErr) throw existingErr;
  const repeatFields = resolveRepeatFields(
    data.repeat,
    data.due_date,
    existing as ExistingRepeatState
  );

  const { error: taskErr } = await supabase
    .from("tasks")
    .update({
      title: data.title,
      notes: data.notes,
      priority: data.priority,
      due_date: data.due_date,
      due_time: data.due_time,
      list_id: data.list_id,
      ...repeatFields,
    })
    .eq("id", taskId);
  if (taskErr) throw taskErr;

  // Sync subtasks — delete all then re-insert to keep it simple.
  // We preserve is_completed from the form items.
  const { error: delSubErr } = await supabase
    .from("subtasks")
    .delete()
    .eq("task_id", taskId);
  if (delSubErr) throw delSubErr;

  if (subtasks.length > 0) {
    const { error } = await supabase.from("subtasks").insert(
      subtasks.map((s) => ({
        task_id: taskId,
        user_id: userId,
        title: s.title,
        is_completed: s.is_completed,
      }))
    );
    if (error) throw error;
  }

  return refetchTask(supabase, taskId);
}

/** Updates only title and notes — leaves priority, schedule, and subtasks alone. */
export async function updateTaskTitleNotes(
  supabase: SupabaseClient,
  taskId: string,
  title: string,
  notes: string | null
): Promise<void> {
  const { error } = await supabase
    .from("tasks")
    .update({ title, notes })
    .eq("id", taskId);
  if (error) throw error;
}

/**
 * Patches selected task fields without touching subtasks. When `repeat` is
 * included, resolves recurrence_id/recurrence_anchor_day against the task's
 * current series state (fetched fresh) and returns the full set of fields
 * actually written, so callers can merge an accurate patch into local state.
 */
export async function patchTaskFields(
  supabase: SupabaseClient,
  taskId: string,
  fields: Partial<Pick<Task, "priority" | "due_date" | "due_time" | "title" | "notes">> & {
    repeat?: RepeatOption;
  }
): Promise<Partial<Task>> {
  const { repeat, ...rest } = fields;
  let payload: Partial<Task> = { ...rest };

  if (repeat !== undefined) {
    const { data: existing, error: fetchErr } = await supabase
      .from("tasks")
      .select("repeat, recurrence_id, recurrence_anchor_day, due_date")
      .eq("id", taskId)
      .single();
    if (fetchErr) throw fetchErr;
    const dueDate =
      fields.due_date !== undefined ? fields.due_date : (existing.due_date as string | null);
    payload = {
      ...payload,
      due_date: dueDate,
      ...resolveRepeatFields(repeat, dueDate, existing as ExistingRepeatState),
    };
  }

  const { error } = await supabase.from("tasks").update(payload).eq("id", taskId);
  if (error) throw error;
  return payload;
}

/** Replaces all subtasks for a task (delete + insert), preserving completion flags. */
export async function replaceTaskSubtasks(
  supabase: SupabaseClient,
  taskId: string,
  userId: string,
  subtasks: SubtaskFormItem[]
): Promise<Subtask[]> {
  const { error: delErr } = await supabase.from("subtasks").delete().eq("task_id", taskId);
  if (delErr) throw delErr;

  if (subtasks.length === 0) return [];

  const { data, error } = await supabase
    .from("subtasks")
    .insert(
      subtasks.map((s) => ({
        task_id: taskId,
        user_id: userId,
        title: s.title,
        is_completed: s.is_completed,
      }))
    )
    .select("*");
  if (error) throw error;
  return (data as Subtask[]) ?? [];
}

/** Deletes a task (cascades subtasks via DB constraints). */
export async function deleteTask(
  supabase: SupabaseClient,
  taskId: string
): Promise<void> {
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Completion toggles + recurrence — completing a recurring task creates one
// next occurrence.
// ---------------------------------------------------------------------------

/** Minimal shape of a recurring task row needed to build its next occurrence. */
export interface RecurrenceSourceTask {
  user_id: string;
  title: string;
  notes: string | null;
  priority: Priority;
  due_date: string;
  due_time: string | null;
  list_id: string | null;
  repeat: RepeatOption;
  recurrence_id: string;
  recurrence_anchor_day: number;
}

/** Pure: builds the insert payload for a recurring task's next occurrence. */
export function buildNextOccurrenceInsert(source: RecurrenceSourceTask) {
  const due_date = nextRecurrenceDate(
    source.due_date,
    source.repeat as Exclude<RepeatOption, "never">,
    source.recurrence_anchor_day
  );
  return {
    user_id: source.user_id,
    title: source.title,
    notes: source.notes,
    priority: source.priority,
    due_date,
    due_time: source.due_time,
    list_id: source.list_id,
    repeat: source.repeat,
    recurrence_id: source.recurrence_id,
    recurrence_anchor_day: source.recurrence_anchor_day,
  };
}

/** Pure: builds fresh (incomplete) subtask rows copied onto a next occurrence. */
export function buildNextOccurrenceSubtasks(
  sourceSubtasks: { title: string }[],
  userId: string,
  newTaskId: string
) {
  return sourceSubtasks.map((s) => ({
    task_id: newTaskId,
    user_id: userId,
    title: s.title,
    is_completed: false,
  }));
}

async function createNextOccurrence(
  supabase: SupabaseClient,
  sourceTaskId: string,
  source: RecurrenceSourceTask
): Promise<TaskWithDetails | null> {
  const { data: inserted, error } = await supabase
    .from("tasks")
    .insert(buildNextOccurrenceInsert(source))
    .select("id")
    .single();

  if (error) {
    // Unique violation on (user_id, recurrence_id, due_date) means the next
    // occurrence already exists — a double-click, retry, or race. Treat as
    // an idempotent no-op rather than surfacing a duplicate-creation error.
    if ((error as { code?: string }).code === "23505") return null;
    throw error;
  }

  const newTaskId = inserted.id as string;

  const { data: sourceSubtasks, error: subFetchErr } = await supabase
    .from("subtasks")
    .select("title")
    .eq("task_id", sourceTaskId);
  if (subFetchErr) throw subFetchErr;

  if (sourceSubtasks && sourceSubtasks.length > 0) {
    const { error: subErr } = await supabase
      .from("subtasks")
      .insert(buildNextOccurrenceSubtasks(sourceSubtasks as { title: string }[], source.user_id, newTaskId));
    if (subErr) throw subErr;
  }

  return refetchTask(supabase, newTaskId);
}

export interface SetTaskCompleteResult {
  task: Pick<Task, "status" | "completed_at">;
  /**
   * The newly created next occurrence, when completing a recurring task
   * produced one. Null when reopening, the task doesn't repeat, or the
   * occurrence already existed (idempotent retry/race).
   */
  nextTask: TaskWithDetails | null;
}

/** Marks a task as completed or reopens it. Reopening never creates a next occurrence. */
export async function setTaskComplete(
  supabase: SupabaseClient,
  taskId: string,
  completed: boolean
): Promise<SetTaskCompleteResult> {
  const { data: current, error: fetchErr } = await supabase
    .from("tasks")
    .select(
      "user_id, title, notes, priority, due_date, due_time, list_id, repeat, recurrence_id, recurrence_anchor_day"
    )
    .eq("id", taskId)
    .single();
  if (fetchErr) throw fetchErr;

  const update = completed
    ? { status: "completed" as const, completed_at: new Date().toISOString() }
    : { status: "active" as const, completed_at: null };

  const { data, error } = await supabase
    .from("tasks")
    .update(update)
    .eq("id", taskId)
    .select("status, completed_at")
    .single();
  if (error) throw error;

  let nextTask: TaskWithDetails | null = null;
  if (
    completed &&
    current.repeat !== "never" &&
    current.recurrence_id &&
    current.recurrence_anchor_day != null &&
    current.due_date
  ) {
    nextTask = await createNextOccurrence(supabase, taskId, current as RecurrenceSourceTask);
  }

  return { task: data as Pick<Task, "status" | "completed_at">, nextTask };
}

/** Toggles a subtask's is_completed flag. */
export async function setSubtaskComplete(
  supabase: SupabaseClient,
  subtaskId: string,
  completed: boolean
): Promise<void> {
  const { error } = await supabase
    .from("subtasks")
    .update({ is_completed: completed })
    .eq("id", subtaskId);
  if (error) throw error;
}
