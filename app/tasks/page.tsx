import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchTasksWithDetails, fetchAllTags } from "@/lib/tasks";
import { fetchTaskLists } from "@/lib/task-lists";
import { TasksClient } from "./TasksClient";

export const metadata: Metadata = { title: "Tasks" };

/**
 * Server Component — fetches the initial task and tag data, then hands off
 * to the fully interactive TasksClient.
 */
export default async function TasksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // All fetches run in parallel
  const [tasks, tags, lists] = await Promise.all([
    fetchTasksWithDetails(supabase).catch(() => []),
    fetchAllTags(supabase).catch(() => []),
    fetchTaskLists(supabase).catch(() => []),
  ]);

  return (
    // Suspense required because TasksClient uses useSearchParams (for the
    // /tasks?task=<id> deep-link opened from Search results, and for the
    // Lists ?list=/?view= scope).
    <Suspense fallback={null}>
      <TasksClient
        initialTasks={tasks}
        initialTags={tags}
        initialLists={lists}
        userId={user.id}
      />
    </Suspense>
  );
}
