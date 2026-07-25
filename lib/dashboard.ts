import type { SupabaseClient } from "@supabase/supabase-js";
import type { CalendarEvent, JournalEntry, TaskWithDetails } from "@/types";
import { shiftDateStr } from "@/utils/date";
import {
  fetchTasksDueOn,
  TASK_PRIORITY_ORDER,
} from "@/lib/tasks";
import { fetchJournalEntriesByDate } from "@/lib/journal";
import { fetchEventsBetween } from "@/lib/calendar";

// ─────────────────────────────────────────────────────────────────────────────
// Section results — each Dashboard section fails independently. A failed
// section falls back to an empty/default value plus a short user-facing
// message; it never throws and never blocks the other sections.
// ─────────────────────────────────────────────────────────────────────────────

export interface DashboardSection<T> {
  data: T;
  error: string | null;
}

async function settle<T>(
  promise: Promise<T>,
  fallback: T,
  errorMessage: string
): Promise<DashboardSection<T>> {
  try {
    return { data: await promise, error: null };
  } catch {
    return { data: fallback, error: errorMessage };
  }
}

export interface DashboardData {
  todayTasks: DashboardSection<TaskWithDetails[]>;
  todayEvents: DashboardSection<CalendarEvent[]>;
  todayJournalEntries: DashboardSection<JournalEntry[]>;
}

/** Sorts tasks the same way the Tasks page's "priority" sort does: priority, then due time. */
export function sortTodayTasks(tasks: TaskWithDetails[]): TaskWithDetails[] {
  return [...tasks].sort((a, b) => {
    const p = TASK_PRIORITY_ORDER[a.priority] - TASK_PRIORITY_ORDER[b.priority];
    if (p !== 0) return p;
    return (a.due_time ?? "").localeCompare(b.due_time ?? "");
  });
}

/**
 * Fetches every bounded query the Dashboard needs, in parallel. Each section is
 * independently fault-tolerant (see `settle`), so e.g. a Calendar outage never
 * prevents Tasks or Journal from rendering.
 */
export async function fetchDashboardData(
  supabase: SupabaseClient,
  todayStr: string
): Promise<DashboardData> {
  const tomorrowStr = shiftDateStr(todayStr, 1);

  const [todayTasks, todayEvents, todayJournalEntries] = await Promise.all([
    settle(fetchTasksDueOn(supabase, todayStr), [], "Couldn't load today's tasks."),
    settle(
      fetchEventsBetween(supabase, todayStr, tomorrowStr),
      [],
      "Couldn't load today's events."
    ),
    settle(
      fetchJournalEntriesByDate(supabase, todayStr),
      [],
      "Couldn't load journal entries."
    ),
  ]);

  return {
    todayTasks: { data: sortTodayTasks(todayTasks.data), error: todayTasks.error },
    todayEvents,
    todayJournalEntries,
  };
}
