import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { fetchJournalEntriesByDate } from "@/lib/journal";
import { localTodayStr } from "@/utils/date";
import { JournalClient } from "./JournalClient";
import type { Task } from "@/types";

export const metadata: Metadata = { title: "Journal" };

/**
 * Server Component — fetches today's journal entries (best-effort guess of
 * "today" using the server's clock; JournalClient self-corrects on mount if
 * the client's local date differs) plus all completed tasks, used to show
 * completed-task context for whichever date is selected.
 */
export default async function JournalPage() {
  const supabase = await createClient();
  const initialDate = localTodayStr();

  const [entries, completedTasksResult] = await Promise.all([
    fetchJournalEntriesByDate(supabase, initialDate).catch(() => []),
    supabase
      .from("tasks")
      .select("id, title, priority, status, completed_at")
      .eq("status", "completed")
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false }),
  ]);

  const completedTasks = (completedTasksResult.data as Pick<
    Task,
    "id" | "title" | "priority" | "status" | "completed_at"
  >[]) ?? [];

  return (
    <JournalClient
      initialDate={initialDate}
      initialEntries={entries}
      completedTasks={completedTasks}
    />
  );
}
