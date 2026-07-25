import type { SupabaseClient } from "@supabase/supabase-js";
import type { Task, Subtask, Tag, TaskWithDetails, Priority } from "@/types";

/** Canonical priority ordering used everywhere tasks are priority-sorted. */
export const TASK_PRIORITY_ORDER: Record<Priority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

// ---------------------------------------------------------------------------
// Internal raw shape returned by Supabase nested select
// ---------------------------------------------------------------------------

interface RawTaskRow extends Omit<Task, "priority" | "status"> {
  priority: string;
  status: string;
  subtasks: Subtask[];
  task_tags: Array<{ tags: Tag | null }>;
}

/** Normalizes the Supabase nested-select shape into TaskWithDetails. */
function normalize(raw: RawTaskRow): TaskWithDetails {
  const { task_tags, ...fields } = raw;
  return {
    ...(fields as unknown as Task),
    subtasks: raw.subtasks ?? [],
    tags: (task_tags ?? [])
      .map((tt) => tt.tags)
      .filter((t): t is Tag => t !== null),
  };
}

const TASK_SELECT = `
  *,
  subtasks ( * ),
  task_tags ( tags ( * ) )
` as const;

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/** Fetches all tasks for the signed-in user (includes subtasks + tags). */
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

/** Fetches all tags for the signed-in user. */
export async function fetchAllTags(supabase: SupabaseClient): Promise<Tag[]> {
  const { data, error } = await supabase
    .from("tags")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw error;
  return (data as Tag[]) ?? [];
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
}

/** Subtask items as represented in the form (new items have no id). */
export interface SubtaskFormItem {
  id?: string;
  title: string;
  is_completed: boolean;
}

/** Tag items as represented in the form (new items have no id). */
export interface TagFormItem {
  id?: string;
  name: string;
  color: string | null;
}

/** Eight planet-inspired tag colors (Mercury → Neptune), kept visually distinct. */
export const PLANET_TAG_COLORS = [
  { planet: "Mercury", color: "#94A3B8" }, // cool slate gray
  { planet: "Venus",   color: "#EAB308" }, // bright gold-yellow
  { planet: "Earth",   color: "#16A34A" }, // verdant green
  { planet: "Mars",    color: "#DC2626" }, // iron red
  { planet: "Jupiter", color: "#EA580C" }, // banded orange
  { planet: "Saturn",  color: "#D4A574" }, // pale bronze
  { planet: "Uranus",  color: "#14B8A6" }, // icy teal
  { planet: "Neptune", color: "#2563EB" }, // deep ocean blue
] as const;

const TAG_COLORS = PLANET_TAG_COLORS.map((p) => p.color);

function pickColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

/**
 * Resolves tag form items to tag IDs, creating new tags in Supabase as needed.
 * Returns IDs for all tags.
 */
async function resolveTagIds(
  supabase: SupabaseClient,
  userId: string,
  tags: TagFormItem[]
): Promise<string[]> {
  const ids: string[] = [];

  for (const tag of tags) {
    if (tag.id) {
      ids.push(tag.id);
    } else {
      // Upsert so duplicate names are handled gracefully
      const { data, error } = await supabase
        .from("tags")
        .upsert(
          { user_id: userId, name: tag.name, color: tag.color ?? pickColor(tag.name) },
          { onConflict: "user_id,name", ignoreDuplicates: false }
        )
        .select("id")
        .single();
      if (error) throw error;
      ids.push(data.id as string);
    }
  }

  return ids;
}

/** Creates a task with subtasks and tags. Returns the full TaskWithDetails. */
export async function createTask(
  supabase: SupabaseClient,
  userId: string,
  data: TaskFormData,
  subtasks: SubtaskFormItem[],
  tags: TagFormItem[]
): Promise<TaskWithDetails> {
  // 1. Resolve / create tags
  const tagIds = await resolveTagIds(supabase, userId, tags);

  // 2. Insert task
  const { data: task, error: taskErr } = await supabase
    .from("tasks")
    .insert({
      user_id: userId,
      title: data.title,
      notes: data.notes,
      priority: data.priority,
      due_date: data.due_date,
      due_time: data.due_time,
    })
    .select("id")
    .single();
  if (taskErr) throw taskErr;
  const taskId = task.id as string;

  // 3. Insert subtasks
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

  // 4. Insert task_tags
  if (tagIds.length > 0) {
    const { error } = await supabase.from("task_tags").insert(
      tagIds.map((tagId) => ({ task_id: taskId, tag_id: tagId }))
    );
    if (error) throw error;
  }

  return refetchTask(supabase, taskId);
}

/** Updates a task's fields, subtasks, and tags. Returns the full TaskWithDetails. */
export async function updateTask(
  supabase: SupabaseClient,
  taskId: string,
  userId: string,
  data: TaskFormData,
  subtasks: SubtaskFormItem[],
  tags: TagFormItem[]
): Promise<TaskWithDetails> {
  // 1. Resolve / create tags
  const tagIds = await resolveTagIds(supabase, userId, tags);

  // 2. Update task fields
  const { error: taskErr } = await supabase
    .from("tasks")
    .update({
      title: data.title,
      notes: data.notes,
      priority: data.priority,
      due_date: data.due_date,
      due_time: data.due_time,
    })
    .eq("id", taskId);
  if (taskErr) throw taskErr;

  // 3. Sync subtasks — delete all then re-insert to keep it simple.
  //    We preserve is_completed from the form items.
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

  // 4. Sync task_tags — delete all then re-insert
  const { error: delTagErr } = await supabase
    .from("task_tags")
    .delete()
    .eq("task_id", taskId);
  if (delTagErr) throw delTagErr;

  if (tagIds.length > 0) {
    const { error } = await supabase.from("task_tags").insert(
      tagIds.map((tagId) => ({ task_id: taskId, tag_id: tagId }))
    );
    if (error) throw error;
  }

  return refetchTask(supabase, taskId);
}

/** Deletes a task (cascades subtasks and task_tags via DB constraints). */
export async function deleteTask(
  supabase: SupabaseClient,
  taskId: string
): Promise<void> {
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) throw error;
}

/** Deletes a tag (cascades task_tags via DB constraints). */
export async function deleteTag(
  supabase: SupabaseClient,
  tagId: string
): Promise<void> {
  const { error } = await supabase.from("tags").delete().eq("id", tagId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Completion toggles
// ---------------------------------------------------------------------------

/** Marks a task as completed or reopens it. Returns updated task partial. */
export async function setTaskComplete(
  supabase: SupabaseClient,
  taskId: string,
  completed: boolean
): Promise<Pick<Task, "status" | "completed_at">> {
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
  return data as Pick<Task, "status" | "completed_at">;
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
