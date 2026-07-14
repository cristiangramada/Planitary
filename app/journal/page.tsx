import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { fetchJournalEntries } from "@/lib/journal";
import { JournalClient } from "./JournalClient";
import type { Task } from "@/types";

export const metadata: Metadata = { title: "Journal" };

/**
 * Server Component — fetches journal entries and completed tasks (for the
 * "Completed That Day" panel), then hands off to the interactive client.
 */
export default async function JournalPage() {
  const supabase = await createClient();

  const [entries, completedTasksResult] = await Promise.all([
    fetchJournalEntries(supabase).catch(() => []),
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
    <JournalClient initialEntries={entries} completedTasks={completedTasks} />
  );
}
