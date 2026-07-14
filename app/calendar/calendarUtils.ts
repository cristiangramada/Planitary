// ─────────────────────────────────────────────────────────────────────────────
// Shared calendar utilities — used by CalendarClient and all view components.
// ─────────────────────────────────────────────────────────────────────────────

export const HOUR_HEIGHT = 64; // px per hour in timeline views
export const HOURS = Array.from({ length: 24 }, (_, i) => i);

export const WEEK_DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;
export const MONTH_NAMES_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** Convert any UTC ISO timestamp to a local YYYY-MM-DD string. */
export function toLocalDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Today as YYYY-MM-DD in local time. */
export function localTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Parse YYYY-MM-DD safely (avoids UTC midnight offset). */
export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Date to YYYY-MM-DD local string. */
export function dateToISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Get the Sunday at the start of the week containing `date`. */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

/** Get the 7 days of the week starting from `weekStart`. */
export function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

/** Build month grid cells — null for padding before the first day. */
export function buildMonthGrid(year: number, month: number): (number | null)[] {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid: (number | null)[] = Array(firstDow).fill(null);
  for (let i = 1; i <= daysInMonth; i++) grid.push(i);
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}

// ─── Time helpers ─────────────────────────────────────────────────────────────

/** Format ISO timestamp as "h:MM AM/PM". */
export function fmt12(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** Format a short hour label: "12 AM", "1 PM", etc. */
export function fmtHourLabel(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

/** Minutes from midnight for an ISO timestamp. */
export function isoToMinutes(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

/** Pixel offset for a number of minutes from midnight. */
export function minutesToPx(minutes: number): number {
  return (minutes / 60) * HOUR_HEIGHT;
}

/** Top + height in px for an event block. */
export function eventBlockGeometry(
  startIso: string,
  endIso: string | null
): { top: number; height: number } {
  const startMin = isoToMinutes(startIso);
  let endMin = endIso ? isoToMinutes(endIso) : startMin + 60;
  // If end is before start (crosses midnight), anchor at end of day
  if (endMin <= startMin) endMin = Math.min(startMin + 60, 24 * 60);
  const durationMin = Math.max(30, endMin - startMin);
  return {
    top: minutesToPx(startMin),
    height: minutesToPx(durationMin),
  };
}

/** Interval used by the overlap layout algorithm (minutes from midnight). */
export interface TimedInterval {
  id: string;
  startMin: number;
  endMin: number;
}

export interface OverlapLayout {
  /** 0-based column index within the overlapping cluster */
  column: number;
  /** Total columns in this overlapping cluster */
  columnCount: number;
}

/**
 * Pack overlapping timed items into side-by-side columns so they don't stack.
 * Classic greedy calendar layout: sort by start, assign lowest free column.
 */
export function layoutOverlappingItems(
  items: TimedInterval[]
): Map<string, OverlapLayout> {
  const layout = new Map<string, OverlapLayout>();
  if (items.length === 0) return layout;

  const sorted = [...items].sort(
    (a, b) => a.startMin - b.startMin || a.endMin - b.endMin
  );

  // Clusters of mutually overlapping items
  const clusters: TimedInterval[][] = [];
  let current: TimedInterval[] = [];
  let clusterEnd = -1;

  for (const item of sorted) {
    if (current.length === 0 || item.startMin < clusterEnd) {
      current.push(item);
      clusterEnd = Math.max(clusterEnd, item.endMin);
    } else {
      clusters.push(current);
      current = [item];
      clusterEnd = item.endMin;
    }
  }
  if (current.length > 0) clusters.push(current);

  for (const cluster of clusters) {
    // columnEndMins[i] = end minute of last item placed in column i
    const columnEndMins: number[] = [];
    const assigned = new Map<string, number>();

    for (const item of cluster) {
      let col = columnEndMins.findIndex((end) => end <= item.startMin);
      if (col === -1) {
        col = columnEndMins.length;
        columnEndMins.push(item.endMin);
      } else {
        columnEndMins[col] = item.endMin;
      }
      assigned.set(item.id, col);
    }

    const columnCount = columnEndMins.length;
    for (const item of cluster) {
      layout.set(item.id, {
        column: assigned.get(item.id)!,
        columnCount,
      });
    }
  }

  return layout;
}

/** Build a timed interval for a calendar event. */
export function eventToInterval(event: {
  id: string;
  start_time: string;
  end_time: string | null;
}): TimedInterval {
  const startMin = isoToMinutes(event.start_time);
  let endMin = event.end_time ? isoToMinutes(event.end_time) : startMin + 60;
  if (endMin <= startMin) endMin = Math.min(startMin + 60, 24 * 60);
  return { id: event.id, startMin, endMin: Math.max(endMin, startMin + 30) };
}

/** Build a timed interval for a task due_time on a YYYY-MM-DD day. */
export function taskToInterval(
  task: { id: string; due_time: string | null },
  dayIso: string
): TimedInterval {
  const time = (task.due_time ?? "00:00").slice(0, 5);
  const startMin = isoToMinutes(`${dayIso}T${time}:00`);
  return { id: task.id, startMin, endMin: startMin + 30 };
}

/** CSS left/width % for a column within an overlap cluster. */
export function overlapColumnStyle(
  column: number,
  columnCount: number,
  gapPercent = 1
): { left: string; width: string } {
  const usable = 100 - gapPercent * (columnCount - 1);
  const width = usable / columnCount;
  const left = column * (width + gapPercent);
  return {
    left: `${left}%`,
    width: `${width}%`,
  };
}

// ─── Label formatters ─────────────────────────────────────────────────────────

export function fmtMonthYear(year: number, month: number): string {
  return `${MONTH_NAMES[month]} ${year}`;
}

export function fmtWeekRange(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const sMon = MONTH_NAMES_SHORT[weekStart.getMonth()];
  const eMon = MONTH_NAMES_SHORT[end.getMonth()];
  if (weekStart.getMonth() === end.getMonth()) {
    return `${sMon} ${weekStart.getDate()} – ${end.getDate()}, ${end.getFullYear()}`;
  }
  return `${sMon} ${weekStart.getDate()} – ${eMon} ${end.getDate()}, ${end.getFullYear()}`;
}

export function fmtDayFull(date: Date): string {
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
  const month = date.toLocaleDateString("en-US", { month: "long" });
  const day = date.getDate();
  const year = date.getFullYear();
  // Non-breaking spaces keep "July 17" and ", 2026" from wrapping apart
  return `${weekday}, ${month}\u00A0${day},\u00A0${year}`;
}

export function fmtDayShort(date: Date): string {
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
  const month = date.toLocaleDateString("en-US", { month: "long" });
  const day = date.getDate();
  return `${weekday}, ${month}\u00A0${day}`;
}
