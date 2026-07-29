// ---------------------------------------------------------------------------
// Database row types — mirror the schema in supabase/migrations/0001_initial_schema.sql
// ---------------------------------------------------------------------------

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
}

/** Recurrence cadence for a task. `never` means the task does not repeat. */
export type RepeatOption = "never" | "daily" | "weekly" | "monthly" | "yearly";

export interface Task {
  id: string;
  user_id: string;
  title: string;
  notes: string | null;
  priority: "none" | "low" | "medium" | "high";
  status: "active" | "completed";
  due_date: string | null;   // ISO date string (YYYY-MM-DD)
  due_time: string | null;   // HH:MM:SS
  completed_at: string | null;
  list_id: string | null;
  /** Recurrence cadence; "never" (default) means this task does not repeat. */
  repeat: RepeatOption;
  /** Shared by every task in a recurring series; null when `repeat` is "never". */
  recurrence_id: string | null;
  /** Day-of-month (1-31) the series anchors to for monthly/yearly clamping; null when `repeat` is "never". */
  recurrence_anchor_day: number | null;
  created_at: string;
  updated_at: string;
}

/** A user-owned container for Tasks (e.g. "Work", "Personal"). A task with a
 *  null `list_id` belongs to no List and appears in the "Inbox" system view. */
export interface TaskList {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  icon: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Subtask {
  id: string;
  task_id: string;
  user_id: string;
  title: string;
  is_completed: boolean;
  created_at: string;
}

export interface CalendarEvent {
  id: string;
  user_id: string;
  title: string;
  details: string | null;
  start_time: string;        // ISO datetime with timezone
  end_time: string | null;
  created_at: string;
  updated_at: string;
}

export interface JournalEntry {
  id: string;
  user_id: string;
  entry_date: string;        // ISO date string (YYYY-MM-DD)
  content: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Composite / view types
// ---------------------------------------------------------------------------

/** Task row joined with its subtasks */
export interface TaskWithDetails extends Task {
  subtasks: Subtask[];
  /** Populated from the joined `task_lists` row; null when `list_id` is null. */
  list: Pick<TaskList, "id" | "name" | "color" | "icon"> | null;
}

// Search types (SearchEntityType, SearchResult, SearchFilters, etc.) live in
// types/search.ts — they're substantial enough to warrant their own module,
// and are kept independent from lib/ai/types.ts so a future AI layer can
// produce the same structured search input without any coupling.

// ---------------------------------------------------------------------------
// UI helper types
// ---------------------------------------------------------------------------

export type Priority = Task["priority"];
export type TaskStatus = Task["status"];
