import type { SupabaseClient } from "@supabase/supabase-js";
import type { CalendarEvent, JournalEntry, TaskWithDetails } from "@/types";
import { getWeekStart, parseDate, dateToISO } from "@/app/calendar/calendarUtils";
import { shiftDateStr } from "@/utils/date";
import {
  fetchTasksDueOn,
  fetchOverdueActiveTasks,
  fetchWeeklyTaskCounts,
  TASK_PRIORITY_ORDER,
} from "@/lib/tasks";
import { fetchJournalEntriesByDate, fetchJournalEntryDatesBetween } from "@/lib/journal";
import { fetchEventsBetween, fetchEventCountBetween } from "@/lib/calendar";

// ─────────────────────────────────────────────────────────────────────────────
// Week range — matches the Sun–Sat convention already used by the Calendar
// (see app/calendar/calendarUtils.ts:getWeekStart).
// ─────────────────────────────────────────────────────────────────────────────

export interface DashboardWeekRange {
  weekStart: string; // YYYY-MM-DD, local, inclusive (Sunday)
  weekEnd: string; // YYYY-MM-DD, local, inclusive (Saturday)
}

export function getDashboardWeekRange(todayStr: string): DashboardWeekRange {
  const weekStart = dateToISO(getWeekStart(parseDate(todayStr)));
  const weekEnd = shiftDateStr(weekStart, 6);
  return { weekStart, weekEnd };
}

/**
 * Completion percentage = tasksCompleted / (tasksCompleted + tasksActiveDue).
 * Returns null when there is nothing to measure (avoids a misleading 0%).
 */
export function computeCompletionPercent(
  tasksCompleted: number,
  tasksActiveDue: number
): number | null {
  const denominator = tasksCompleted + tasksActiveDue;
  if (denominator === 0) return null;
  return Math.round((tasksCompleted / denominator) * 100);
}

export interface WeeklyProgress extends DashboardWeekRange {
  tasksCompleted: number;
  tasksActiveDue: number;
  journalDays: number;
  eventsThisWeek: number;
  completionPercent: number | null;
}

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

function defaultWeeklyProgress(range: DashboardWeekRange): WeeklyProgress {
  return {
    ...range,
    tasksCompleted: 0,
    tasksActiveDue: 0,
    journalDays: 0,
    eventsThisWeek: 0,
    completionPercent: null,
  };
}

/** Recomputes Weekly progress for a given week range. Exported so callers (e.g. the Dashboard, after a mutation) can refresh just this section without re-fetching everything else. */
export async function fetchWeeklyProgress(
  supabase: SupabaseClient,
  range: DashboardWeekRange
): Promise<WeeklyProgress> {
  const { weekStart, weekEnd } = range;
  const [{ completed, activeDue }, journalDates, eventsThisWeek] = await Promise.all([
    fetchWeeklyTaskCounts(supabase, weekStart, weekEnd),
    fetchJournalEntryDatesBetween(supabase, weekStart, weekEnd),
    fetchEventCountBetween(supabase, weekStart, shiftDateStr(weekEnd, 1)),
  ]);

  return {
    ...range,
    tasksCompleted: completed,
    tasksActiveDue: activeDue,
    journalDays: journalDates.length,
    eventsThisWeek,
    completionPercent: computeCompletionPercent(completed, activeDue),
  };
}

export interface DashboardData {
  todayTasks: DashboardSection<TaskWithDetails[]>;
  overdueTasks: DashboardSection<TaskWithDetails[]>;
  todayEvents: DashboardSection<CalendarEvent[]>;
  todayJournalEntries: DashboardSection<JournalEntry[]>;
  weeklyProgress: DashboardSection<WeeklyProgress>;
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
  const weekRange = getDashboardWeekRange(todayStr);
  const tomorrowStr = shiftDateStr(todayStr, 1);

  const [todayTasks, overdueTasks, todayEvents, todayJournalEntries, weeklyProgress] =
    await Promise.all([
      settle(fetchTasksDueOn(supabase, todayStr), [], "Couldn't load today's tasks."),
      settle(fetchOverdueActiveTasks(supabase, todayStr), [], "Couldn't load overdue tasks."),
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
      settle(
        fetchWeeklyProgress(supabase, weekRange),
        defaultWeeklyProgress(weekRange),
        "Couldn't load weekly progress."
      ),
    ]);

  return {
    todayTasks: { data: sortTodayTasks(todayTasks.data), error: todayTasks.error },
    overdueTasks,
    todayEvents,
    todayJournalEntries,
    weeklyProgress,
  };
}
