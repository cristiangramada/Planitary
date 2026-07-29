import type { RepeatOption } from "@/types";
import { parseDateOnly, shiftDateStr } from "@/utils/date";

/** Day-of-month (1-31) used to anchor monthly/yearly clamping for a series. */
export function anchorDayFromDate(dateStr: string): number {
  return parseDateOnly(dateStr).getDate();
}

function lastDayOfMonth(year: number, monthIndex0: number): number {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

function toDateStr(year: number, monthIndex0: number, day: number): string {
  return `${year}-${String(monthIndex0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Advances `currentDueDate` by one recurrence step, operating on local
 * calendar date components (never UTC midnight).
 *
 * Monthly/yearly land on `min(anchorDay, daysInTargetMonth)` — using the
 * series' fixed `anchorDay` (not the previous occurrence's actual day) means
 * a short month doesn't permanently shrink the series, e.g. for a monthly
 * series anchored on the 31st: Jan 31 -> Feb 28 -> Mar 31 (not Mar 28). The
 * same clamp formula naturally handles yearly Feb 29: `min(29, 28)` = 28 in
 * non-leap years, `min(29, 29)` = 29 when the target year is a leap year.
 */
export function nextRecurrenceDate(
  currentDueDate: string,
  repeat: Exclude<RepeatOption, "never">,
  anchorDay: number
): string {
  if (repeat === "daily") return shiftDateStr(currentDueDate, 1);
  if (repeat === "weekly") return shiftDateStr(currentDueDate, 7);

  const d = parseDateOnly(currentDueDate);
  const year = d.getFullYear();
  const month = d.getMonth();

  if (repeat === "monthly") {
    let targetYear = year;
    let targetMonth = month + 1;
    if (targetMonth > 11) {
      targetMonth = 0;
      targetYear += 1;
    }
    const day = Math.min(anchorDay, lastDayOfMonth(targetYear, targetMonth));
    return toDateStr(targetYear, targetMonth, day);
  }

  // yearly — same month, next year.
  const targetYear = year + 1;
  const day = Math.min(anchorDay, lastDayOfMonth(targetYear, month));
  return toDateStr(targetYear, month, day);
}

export interface ExistingRepeatState {
  repeat: RepeatOption;
  recurrence_id: string | null;
  recurrence_anchor_day: number | null;
  /** Current due_date before this edit; used to decide whether to retarget the anchor. */
  due_date: string | null;
}

export interface ResolvedRepeatFields {
  repeat: RepeatOption;
  recurrence_id: string | null;
  recurrence_anchor_day: number | null;
}

/**
 * Resolves the repeat/recurrence_id/recurrence_anchor_day triple to persist
 * for a create or update.
 *
 * Repeat requires a due date to advance from — without one it's normalized
 * to "never" rather than silently stored as a dangling preference. A task
 * newly becoming recurring (or re-enabling repeat after it was "never")
 * starts a fresh series id; a task that is already part of a series keeps
 * its `recurrence_id` across edits so completion continues advancing the
 * same series.
 *
 * Anchor preservation: when staying in an existing series, keep the stored
 * `recurrence_anchor_day` if the due date's day-of-month is unchanged
 * (including clamped short-month dates like Feb 28 with anchor 31). Only
 * retarget the anchor when the user picks a different calendar day.
 */
export function resolveRepeatFields(
  requestedRepeat: RepeatOption,
  dueDate: string | null,
  existing: ExistingRepeatState | null
): ResolvedRepeatFields {
  if (requestedRepeat === "never" || !dueDate) {
    return { repeat: "never", recurrence_id: null, recurrence_anchor_day: null };
  }

  const inSeries =
    !!existing &&
    existing.repeat !== "never" &&
    !!existing.recurrence_id &&
    existing.recurrence_anchor_day != null;

  if (inSeries) {
    const newDay = anchorDayFromDate(dueDate);
    const prevDay = existing.due_date ? anchorDayFromDate(existing.due_date) : null;
    const recurrence_anchor_day =
      prevDay !== null && prevDay === newDay ? existing.recurrence_anchor_day : newDay;
    return {
      repeat: requestedRepeat,
      recurrence_id: existing.recurrence_id,
      recurrence_anchor_day,
    };
  }

  return {
    repeat: requestedRepeat,
    recurrence_id: crypto.randomUUID(),
    recurrence_anchor_day: anchorDayFromDate(dueDate),
  };
}
