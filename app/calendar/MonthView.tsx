"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { cn } from "@/utils/cn";
import {
  buildMonthGrid,
  toLocalDate,
  localTodayStr,
  fmt12,
  WEEK_DAYS_SHORT,
} from "./calendarUtils";
import type { CalendarEvent, TaskWithDetails } from "@/types";

const PRIORITY_DOT: Record<string, string> = {
  high:   "bg-red-500",
  medium: "bg-amber-500",
  low:    "bg-green-500",
};

/** Approximate chip row height (content + gap) for overflow math. */
const CHIP_ROW_PX = 16;
const MORE_ROW_PX = 14;

type Chip =
  | { type: "event"; id: string; label: string }
  | { type: "task"; id: string; label: string; priority: string; done: boolean };

interface MonthViewProps {
  year: number;
  month: number;
  events: CalendarEvent[];
  tasks: TaskWithDetails[];
  selectedDay: string;
  onSelectDay: (iso: string) => void;
  onDayContextMenu: (e: React.MouseEvent, iso: string) => void;
}

interface DayCellProps {
  day: number;
  iso: string;
  isToday: boolean;
  isSelected: boolean;
  chips: Chip[];
  onSelectDay: (iso: string) => void;
  onDayContextMenu: (e: React.MouseEvent, iso: string) => void;
}

function DayCell({
  day,
  iso,
  isToday,
  isSelected,
  chips,
  onSelectDay,
  onDayContextMenu,
}: DayCellProps) {
  const chipsRef = useRef<HTMLDivElement>(null);
  const [maxVisible, setMaxVisible] = useState(chips.length);

  useEffect(() => {
    const el = chipsRef.current;
    if (!el) return;

    function measure() {
      const height = el!.clientHeight;
      if (height <= 0) return;

      const total = chips.length;
      // How many full chip rows fit in the available height
      const fitAll = Math.floor(height / CHIP_ROW_PX);

      if (total <= fitAll) {
        setMaxVisible(total);
        return;
      }

      // Reserve one row for "+N more" when not everything fits
      const withMore = Math.floor((height - MORE_ROW_PX) / CHIP_ROW_PX);
      setMaxVisible(Math.max(0, withMore));
    }

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [chips.length]);

  const shown = chips.slice(0, maxVisible);
  const overflowCount = chips.length - shown.length;

  return (
    <div
      onClick={() => onSelectDay(iso)}
      onContextMenu={(e) => onDayContextMenu(e, iso)}
      className={cn(
        "px-1.5 pt-1.5 pb-1 cursor-default select-none transition-colors flex flex-col overflow-hidden min-h-0",
        isSelected
          ? "bg-[hsl(var(--primary)/0.07)]"
          : "bg-[hsl(var(--card))] hover:bg-[hsl(var(--muted)/0.5)]"
      )}
    >
      {/* Day number — extra bottom margin so the selection ring clears the first chip */}
      <span
        className={cn(
          "w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium self-start mb-1.5 shrink-0",
          isToday
            ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-bold"
            : isSelected
            ? "ring-2 ring-[hsl(var(--primary))] text-[hsl(var(--primary))]"
            : "text-[hsl(var(--foreground))]"
        )}
      >
        {day}
      </span>

      {/* Chips fill remaining cell height; last line becomes "+N more" if needed */}
      <div ref={chipsRef} className="flex-1 space-y-0.5 overflow-hidden min-h-0">
        {shown.map((chip) =>
          chip.type === "event" ? (
            <div
              key={chip.id}
              className="flex items-center gap-1 px-1 py-px rounded text-[10px] leading-tight font-medium bg-[hsl(var(--primary)/0.15)] text-[hsl(var(--primary))] truncate"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--primary))] shrink-0" />
              <span className="truncate">{chip.label}</span>
            </div>
          ) : (
            <div
              key={chip.id}
              className={cn(
                "flex items-center gap-1 px-1 py-px rounded text-[10px] leading-tight bg-[hsl(var(--muted))] truncate",
                chip.done
                  ? "text-[hsl(var(--muted-foreground))] line-through opacity-60"
                  : "text-[hsl(var(--foreground))]"
              )}
            >
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full shrink-0",
                  PRIORITY_DOT[chip.priority] ?? "bg-[hsl(var(--muted-foreground))]"
                )}
              />
              <span className="truncate">{chip.label}</span>
            </div>
          )
        )}
        {overflowCount > 0 && (
          <div className="text-[10px] text-[hsl(var(--muted-foreground))] px-1 leading-tight">
            +{overflowCount} more
          </div>
        )}
      </div>
    </div>
  );
}

export function MonthView({
  year,
  month,
  events,
  tasks,
  selectedDay,
  onSelectDay,
  onDayContextMenu,
}: MonthViewProps) {
  const todayStr = localTodayStr();
  const flat = useMemo(() => buildMonthGrid(year, month), [year, month]);

  const weeks = useMemo(() => {
    const rows: (number | null)[][] = [];
    for (let i = 0; i < flat.length; i += 7) rows.push(flat.slice(i, i + 7));
    return rows;
  }, [flat]);

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] overflow-hidden h-full flex flex-col">
      <div className="grid grid-cols-7 bg-[hsl(var(--muted)/0.5)] border-b border-[hsl(var(--border))] shrink-0">
        {WEEK_DAYS_SHORT.map((d) => (
          <div
            key={d}
            className="text-center text-xs font-semibold text-[hsl(var(--muted-foreground))] py-2 uppercase tracking-wider"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        {weeks.map((week, wi) => (
          <div
            key={wi}
            className={cn(
              "flex-1 grid grid-cols-7 divide-x divide-[hsl(var(--border))] min-h-0",
              wi > 0 && "border-t border-[hsl(var(--border))]"
            )}
          >
            {week.map((day, di) => {
              if (!day) {
                return <div key={di} className="bg-[hsl(var(--muted)/0.55)] dark:bg-black/8" />;
              }

              const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const dayEvents = events.filter((e) => toLocalDate(e.start_time) === iso);
              const dayTasks = tasks.filter((t) => t.due_date === iso);

              const chips: Chip[] = [
                ...dayEvents.map((e) => ({
                  type: "event" as const,
                  id: e.id,
                  label: `${fmt12(e.start_time)} ${e.title}`,
                })),
                ...dayTasks.map((t) => ({
                  type: "task" as const,
                  id: t.id,
                  label: t.title,
                  priority: t.priority,
                  done: t.status === "completed",
                })),
              ];

              return (
                <DayCell
                  key={di}
                  day={day}
                  iso={iso}
                  isToday={iso === todayStr}
                  isSelected={iso === selectedDay}
                  chips={chips}
                  onSelectDay={onSelectDay}
                  onDayContextMenu={onDayContextMenu}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

