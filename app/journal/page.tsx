import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { fetchJournalEntriesByDate } from "@/lib/journal";
import { localTodayStr } from "@/utils/date";
import { CLIENT_TIME_ZONE_COOKIE, parseClientTimeZone } from "@/lib/time-zone";
import { PageLoadingShell } from "@/components/layout/PageLoadingShell";
import { JournalClient } from "./JournalClient";
import type { Task } from "@/types";

export const metadata: Metadata = { title: "Journal" };

/**
 * Server Component — fetches the visitor's local "today" when their browser
 * has supplied its time zone cookie. JournalClient retains a client-side
 * fallback for a visitor's first render before that cookie exists.
 */
export default async function JournalPage() {
  const supabase = await createClient();
  const cookieStore = await cookies();
  const timeZone = parseClientTimeZone(cookieStore.get(CLIENT_TIME_ZONE_COOKIE)?.value);
  const initialDate = localTodayStr(timeZone);

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
    <Suspense fallback={<PageLoadingShell variant="journal" />}>
      <JournalClient
        initialDate={initialDate}
        initialEntries={entries}
        completedTasks={completedTasks}
      />
    </Suspense>
  );
}
