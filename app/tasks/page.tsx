import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchTasksWithDetails } from "@/lib/tasks";
import { fetchTaskLists } from "@/lib/task-lists";
import {
  parseTasksScopePreferenceRaw,
  tasksScopeCookieName,
  tasksScopeToHref,
} from "@/lib/tasks-scope-preference";
import { TasksClient } from "./TasksClient";

export const metadata: Metadata = { title: "Tasks" };

type TasksSearchParams = {
  list?: string | string[];
  view?: string | string[];
  task?: string | string[];
};

function firstParam(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Server Component — fetches the initial task data, then hands off to the
 * fully interactive TasksClient.
 *
 * Bare `/tasks` (sidebar default) redirects to the last Inbox/List from a
 * cookie so the correct list is selected on first paint — no Inbox flash.
 */
export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<TasksSearchParams>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const hasExplicitScope =
    Boolean(firstParam(params.list)) ||
    Boolean(firstParam(params.view)) ||
    Boolean(firstParam(params.task));

  if (!hasExplicitScope) {
    const cookieStore = await cookies();
    const raw = cookieStore.get(tasksScopeCookieName(user.id))?.value;
    const decoded = raw ? decodeURIComponent(raw) : null;
    const saved = parseTasksScopePreferenceRaw(decoded);
    if (saved) redirect(tasksScopeToHref(saved));
  }

  // All fetches run in parallel
  const [tasks, lists] = await Promise.all([
    fetchTasksWithDetails(supabase).catch(() => []),
    fetchTaskLists(supabase).catch(() => []),
  ]);

  return (
    // Suspense required because TasksClient uses useSearchParams (for the
    // /tasks?task=<id> deep-link opened from Search results, and for the
    // Lists ?list=/?view= scope).
    <Suspense fallback={null}>
      <TasksClient
        initialTasks={tasks}
        initialLists={lists}
        userId={user.id}
      />
    </Suspense>
  );
}
