import type { Metadata } from "next";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { CalendarClient } from "./CalendarClient";
import type { TaskWithDetails, Tag, Task, TaskList, Subtask } from "@/types";

export const metadata: Metadata = { title: "Calendar" };

// Flatten the Supabase nested shape into TaskWithDetails
function normalizeTask(row: Record<string, unknown>): TaskWithDetails {
  const taskTags = (row.task_tags as Array<{ tags: Tag | null }> | null) ?? [];
  const list = (row.task_lists as Pick<TaskList, "id" | "name" | "color" | "icon"> | null) ?? null;
  return {
    ...(row as unknown as Task),
    subtasks: (row.subtasks as Subtask[]) ?? [],
    tags: taskTags.map((tt) => tt.tags).filter((t): t is Tag => t !== null),
    list,
  };
}

export default async function CalendarPage() {
  const supabase = await createClient();

  // Fetch calendar events
  const { data: eventRows, error: eventsError } = await supabase
    .from("calendar_events")
    .select("*")
    .order("start_time", { ascending: true });

  if (eventsError) {
    console.error("Failed to load calendar events:", eventsError.message);
  }

  // Fetch tasks that have a due date (for calendar display)
  const { data: taskRows, error: tasksError } = await supabase
    .from("tasks")
    .select(`
      *,
      subtasks ( * ),
      task_tags ( tags ( * ) ),
      task_lists ( id, name, color, icon )
    `)
    .not("due_date", "is", null)
    .order("due_date", { ascending: true });

  if (tasksError) {
    console.error("Failed to load tasks:", tasksError.message);
  }

  // Fetch tags (for the task creation/editing form)
  const { data: tagRows, error: tagsError } = await supabase
    .from("tags")
    .select("*")
    .order("name", { ascending: true });

  if (tagsError) {
    console.error("Failed to load tags:", tagsError.message);
  }

  const tasks = (taskRows ?? []).map((r) =>
    normalizeTask(r as Record<string, unknown>)
  );

  return (
    // Suspense required because CalendarClient uses useSearchParams (for the
    // /calendar?event=<id>&date=<date> deep-link opened from Search results).
    <Suspense fallback={null}>
      <CalendarClient
        initialEvents={eventRows ?? []}
        initialTasks={tasks}
        allTags={(tagRows as Tag[]) ?? []}
      />
    </Suspense>
  );
}
