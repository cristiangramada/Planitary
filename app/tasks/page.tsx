import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { fetchTasksWithDetails, fetchAllTags } from "@/lib/tasks";
import { TasksClient } from "./TasksClient";

export const metadata: Metadata = { title: "Tasks" };

/**
 * Server Component — fetches the initial task and tag data, then hands off
 * to the fully interactive TasksClient.
 */
export default async function TasksPage() {
  const supabase = await createClient();

  // Both fetches run in parallel
  const [tasks, tags] = await Promise.all([
    fetchTasksWithDetails(supabase).catch(() => []),
    fetchAllTags(supabase).catch(() => []),
  ]);

  return <TasksClient initialTasks={tasks} initialTags={tags} />;
}
