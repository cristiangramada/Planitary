import type { Metadata } from "next";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { fetchJournalEntriesByDate } from "@/lib/journal";
import { localTodayStr } from "@/utils/date";
import { JournalClient } from "./JournalClient";
import type { Task } from "@/types";

export const metadata: Metadata = { title: "Journal" };

/**
 * Server Component — fetches a best-effort "today" using the server clock
 * (UTC on Vercel). JournalClient uses the client's local date and refetches
 * when that differs, or when SSR returned no rows.
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
    // Suspense required because JournalClient uses useSearchParams (for the
    // /journal?date=<date>&entry=<id> deep-link opened from Search results).
    <Suspense fallback={null}>
      <JournalClient
        initialDate={initialDate}
        initialEntries={entries}
        completedTasks={completedTasks}
      />
    </Suspense>
  );
}
