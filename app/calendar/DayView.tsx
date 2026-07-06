"use client";

import { useRef, useEffect, useState } from "react";
import { cn } from "@/utils/cn";
import {
  HOUR_HEIGHT,
  HOURS,
  toLocalDate,
  localTodayStr,
  dateToISO,
  fmt12,
  fmtDayShort,
  fmtHourLabel,
  eventBlockGeometry,
  isoToMinutes,
  minutesToPx,
} from "./calendarUtils";
import type { CalendarEvent, TaskWithDetails } from "@/types";

const PRIORITY_COLOR: Record<string, string> = {
  high:   "bg-red-500/15 border-l-2 border-red-500 text-red-700 dark:text-red-300",
  medium: "bg-amber-500/15 border-l-2 border-amber-500 text-amber-700 dark:text-amber-300",
  low:    "bg-green-500/15 border-l-2 border-green-500 text-green-700 dark:text-green-400",
};

interface DayViewProps {
  date: Date;
  events: CalendarEvent[];
  tasks: TaskWithDetails[];
  onEditEvent: (event: CalendarEvent) => void;
  onEditTask: (task: TaskWithDetails) => void;
  onDayContextMenu: (e: React.MouseEvent, time?: string) => void;
}

/** Snap pixel offset in timeline to the nearest 30-min HH:MM string. */
function pixelToTime(clickY: number): string {
  const totalMinutes = (clickY / HOUR_HEIGHT) * 60;
  const snapped = Math.round(totalMinutes / 30) * 30;
  const h = Math.min(23, Math.floor(snapped / 60));
  const m = snapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function DayView({ date, events, tasks, onEditEvent, onEditTask, onDayContextMenu }: DayViewProps) {
  const todayStr = localTodayStr();
  const iso = dateToISO(date);
  const isToday = iso === todayStr;
  const scrollRef = useRef<HTMLDivElement>(null);

  const [nowMinutes, setNowMinutes] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });

  // Scroll to current time (or start of day)
  useEffect(() => {
    if (scrollRef.current) {
      const target = isToday ? minutesToPx(nowMinutes) - 120 : HOUR_HEIGHT * 7;
      scrollRef.current.scrollTop = Math.max(0, target);
    }
  }, [iso]); // re-scroll when day changes

  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date();
      setNowMinutes(d.getHours() * 60 + d.getMinutes());
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  const dayEvents = events.filter((e) => toLocalDate(e.start_time) === iso);
  const allDayTasks = tasks.filter((t) => t.due_date === iso && !t.due_time);
  const timedTasks = tasks.filter((t) => t.due_date === iso && !!t.due_time);

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] overflow-hidden flex flex-col">
      {/* ── Day header ── */}
      <div
        className={cn(
          "flex flex-col items-center py-3 border-b border-[hsl(var(--border))] shrink-0",
          isToday ? "bg-[hsl(var(--primary)/0.06)]" : "bg-[hsl(var(--muted)/0.4)]"
        )}
        onContextMenu={(e) => onDayContextMenu(e)}
      >
        <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
          {date.toLocaleDateString("en-US", { weekday: "long" })}
        </p>
        <span
          className={cn(
            "w-10 h-10 flex items-center justify-center rounded-full text-xl font-bold mt-1",
            isToday
              ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
              : "text-[hsl(var(--foreground))]"
          )}
        >
          {date.getDate()}
        </span>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
          {date.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </p>
      </div>

      {/* ── All-day tasks ── */}
      {allDayTasks.length > 0 && (
        <div className="border-b border-[hsl(var(--border))] px-4 py-2 flex flex-wrap gap-1.5 shrink-0">
          <span className="text-[11px] text-[hsl(var(--muted-foreground))] mr-1 self-center">
            All-day
          </span>
          {allDayTasks.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onEditTask(t)}
              className={cn(
                "text-xs font-medium px-2.5 py-1 rounded-lg",
                PRIORITY_COLOR[t.priority],
                t.status === "completed" && "opacity-50 line-through"
              )}
            >
              {t.title}
            </button>
          ))}
        </div>
      )}

      {/* ── Scrollable timeline ── */}
      <div
        ref={scrollRef}
        className="overflow-y-auto h-[560px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div
          className="relative select-none"
          style={{ height: HOUR_HEIGHT * 24 }}
          onContextMenu={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const time = pixelToTime(e.clientY - rect.top);
            onDayContextMenu(e, time);
          }}
        >
          {/* Hour grid lines + labels */}
          {HOURS.map((h) => (
            <div
              key={h}
              className="absolute left-0 right-0 flex items-start"
              style={{ top: h * HOUR_HEIGHT }}
            >
              <div className="w-14 shrink-0 text-[11px] text-[hsl(var(--muted-foreground))] text-right pr-3 -translate-y-2.5 select-none">
                {h > 0 ? fmtHourLabel(h) : ""}
              </div>
              <div className="flex-1 border-t border-[hsl(var(--border)/0.5)]" />
            </div>
          ))}

          {/* Current time indicator */}
          {isToday && (
            <div
              className="absolute flex items-center z-10 pointer-events-none"
              style={{ top: minutesToPx(nowMinutes), left: 56, right: 0 }}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1.5 shrink-0" />
              <div className="flex-1 h-px bg-red-500" />
            </div>
          )}

          {/* Events */}
          {dayEvents.map((ev) => {
            const { top, height } = eventBlockGeometry(ev.start_time, ev.end_time);
            return (
              <button
                key={ev.id}
                type="button"
                onClick={() => onEditEvent(ev)}
                onContextMenu={(e) => e.stopPropagation()}
                className="absolute rounded-lg px-2.5 py-1 text-left overflow-hidden bg-[hsl(var(--primary)/0.18)] border-l-[3px] border-[hsl(var(--primary))] text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.28)] transition-colors z-[5] cursor-pointer select-none"
                style={{ top, height: Math.max(28, height), left: 58, right: 4 }}
              >
                <span className="text-sm font-semibold leading-tight block truncate">
                  {ev.title}
                </span>
                {height >= 44 && (
                  <span className="text-xs opacity-80 leading-tight block mt-0.5">
                    {fmt12(ev.start_time)}
                    {ev.end_time && ` – ${fmt12(ev.end_time)}`}
                  </span>
                )}
              </button>
            );
          })}

          {/* Timed tasks */}
          {timedTasks.map((t) => {
            const fakeIso = `${iso}T${t.due_time}`;
            const topPx = minutesToPx(isoToMinutes(new Date(fakeIso).toISOString()));
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onEditTask(t)}
                onContextMenu={(e) => e.stopPropagation()}
                className={cn(
                  "absolute rounded-lg px-2.5 py-1 text-left overflow-hidden z-[5] hover:brightness-95 transition-all cursor-pointer select-none",
                  PRIORITY_COLOR[t.priority],
                  t.status === "completed" && "opacity-40"
                )}
                style={{ top: topPx, height: 32, left: 58, right: 4 }}
              >
                <span className="text-xs font-semibold leading-tight block truncate">
                  {t.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
