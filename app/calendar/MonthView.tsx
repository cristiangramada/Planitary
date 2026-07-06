"use client";

import { useMemo } from "react";
import { cn } from "@/utils/cn";
import {
  buildMonthGrid,
  toLocalDate,
  localTodayStr,
  fmt12,
  WEEK_DAYS_SHORT,
} from "./calendarUtils";
import type { CalendarEvent, TaskWithDetails } from "@/types";

// ─── Priority dot colors ──────────────────────────────────────────────────────
const PRIORITY_DOT: Record<string, string> = {
  high:   "bg-red-500",
  medium: "bg-amber-500",
  low:    "bg-green-500",
};

interface MonthViewProps {
  year: number;
  month: number;
  events: CalendarEvent[];
  tasks: TaskWithDetails[];
  selectedDay: string;
  onSelectDay: (iso: string) => void;
  onDayContextMenu: (e: React.MouseEvent, iso: string) => void;
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
  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] overflow-hidden">
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 bg-[hsl(var(--muted)/0.5)] border-b border-[hsl(var(--border))]">
        {WEEK_DAYS_SHORT.map((d) => (
          <div
            key={d}
            className="text-center text-xs font-semibold text-[hsl(var(--muted-foreground))] py-2.5 uppercase tracking-wider"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 divide-x divide-y divide-[hsl(var(--border))]">
        {grid.map((day, i) => {
          if (!day) {
            return (
              <div
                key={i}
                className="min-h-[100px] bg-[hsl(var(--muted)/0.2)]"
              />
            );
          }

          const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isToday = iso === todayStr;
          const isSelected = iso === selectedDay;

          // Events and tasks for this day
          const dayEvents = events.filter((e) => toLocalDate(e.start_time) === iso);
          const dayTasks = tasks.filter((t) => t.due_date === iso);
          const totalItems = dayEvents.length + dayTasks.length;
          const MAX_CHIPS = 3;
          const overflowCount = totalItems - MAX_CHIPS;

          // Merge and sort by time for display
          type Chip =
            | { type: "event"; id: string; label: string }
            | { type: "task"; id: string; label: string; priority: string; done: boolean };

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
          ].slice(0, MAX_CHIPS);

                  return (
                    <div
                      key={i}
                      onClick={() => onSelectDay(iso)}
                      onContextMenu={(e) => onDayContextMenu(e, iso)}
                      className={cn(
                "min-h-[100px] p-1.5 cursor-default select-none transition-colors flex flex-col",
                isSelected
                  ? "bg-[hsl(var(--primary)/0.07)]"
                  : "bg-[hsl(var(--card))] hover:bg-[hsl(var(--muted)/0.5)]"
              )}
            >
              {/* Day number */}
              <span
                className={cn(
                  "w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium self-start mb-1",
                  isToday
                    ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-bold"
                    : isSelected
                    ? "ring-2 ring-[hsl(var(--primary))] text-[hsl(var(--primary))]"
                    : "text-[hsl(var(--foreground))]"
                )}
              >
                {day}
              </span>

              {/* Chips */}
              <div className="flex-1 space-y-0.5 overflow-hidden">
                {chips.map((chip) =>
                  chip.type === "event" ? (
                    <div
                      key={chip.id}
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] leading-tight font-medium bg-[hsl(var(--primary)/0.15)] text-[hsl(var(--primary))] truncate"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--primary))] shrink-0" />
                      <span className="truncate">{chip.label}</span>
                    </div>
                  ) : (
                    <div
                      key={chip.id}
                      className={cn(
                        "flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] leading-tight bg-[hsl(var(--muted))] truncate",
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
                  <div className="text-[11px] text-[hsl(var(--muted-foreground))] px-1.5">
                    +{overflowCount} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
