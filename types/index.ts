// ---------------------------------------------------------------------------
// Database row types — mirror the schema in supabase/migrations/0001_initial_schema.sql
// ---------------------------------------------------------------------------

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  notes: string | null;
  priority: "low" | "medium" | "high";
  status: "active" | "completed";
  due_date: string | null;   // ISO date string (YYYY-MM-DD)
  due_time: string | null;   // HH:MM:SS
  completed_at: string | null;
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

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
}

export interface TaskTag {
  task_id: string;
  tag_id: string;
}

// ---------------------------------------------------------------------------
// Composite / view types
// ---------------------------------------------------------------------------

/** Task row joined with its subtasks and tags */
export interface TaskWithDetails extends Task {
  subtasks: Subtask[];
  tags: Tag[];
}

export interface SearchResult {
  type: "task" | "event" | "journal";
  id: string;
  title: string;
  preview: string;
  date: string;
  href: string;
}

// ---------------------------------------------------------------------------
// UI helper types
// ---------------------------------------------------------------------------

export type Priority = Task["priority"];
export type TaskStatus = Task["status"];
