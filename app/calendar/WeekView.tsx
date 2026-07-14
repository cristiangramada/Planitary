"use client";

import { useRef, useEffect, useState, useMemo } from "react";
import { cn } from "@/utils/cn";
import {
  HOUR_HEIGHT,
  HOURS,
  WEEK_DAYS_SHORT,
  toLocalDate,
  localTodayStr,
  dateToISO,
  getWeekDays,
  fmt12,
  fmtHourLabel,
  eventBlockGeometry,
  isoToMinutes,
  minutesToPx,
  eventToInterval,
  taskToInterval,
  layoutOverlappingItems,
  overlapColumnStyle,
} from "./calendarUtils";
import type { CalendarEvent, TaskWithDetails } from "@/types";

const PRIORITY_COLOR: Record<string, string> = {
  high:   "bg-red-500/15 border-l-2 border-red-500 text-red-700 dark:text-red-300",
  medium: "bg-amber-500/15 border-l-2 border-amber-500 text-amber-700 dark:text-amber-300",
  low:    "bg-green-500/15 border-l-2 border-green-500 text-green-700 dark:text-green-400",
};

interface WeekViewProps {
  weekStart: Date;
  events: CalendarEvent[];
  tasks: TaskWithDetails[];
  selectedDay: string;
  onSelectDay: (iso: string) => void;
  onEditEvent: (event: CalendarEvent) => void;
  onEditTask: (task: TaskWithDetails) => void;
  onDayContextMenu: (e: React.MouseEvent, iso: string, time?: string) => void;
}

/** Snap pixel offset in timeline to the nearest 30-min HH:MM string. */
function pixelToTime(clickY: number): string {
  const totalMinutes = (clickY / HOUR_HEIGHT) * 60;
  const snapped = Math.round(totalMinutes / 30) * 30;
  const h = Math.min(23, Math.floor(snapped / 60));
  const m = snapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function WeekView({
  weekStart,
  events,
  tasks,
  selectedDay,
  onSelectDay,
  onEditEvent,
  onEditTask,
  onDayContextMenu,
}: WeekViewProps) {
  const todayStr = localTodayStr();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [nowMinutes, setNowMinutes] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });

  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);

  // Scroll to current time on mount
  useEffect(() => {
    if (scrollRef.current) {
      const scrollTop = minutesToPx(nowMinutes) - 120;
      scrollRef.current.scrollTop = Math.max(0, scrollTop);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Tick every minute for current-time indicator
  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date();
      setNowMinutes(d.getHours() * 60 + d.getMinutes());
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  const todayInWeek = weekDays.some((d) => dateToISO(d) === todayStr);

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] overflow-hidden flex flex-col h-full">
      {/* ── Day column headers ── */}
      <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)] shrink-0">
        <div /> {/* spacer for hour labels */}
        {weekDays.map((day, i) => {
          const iso = dateToISO(day);
          const isToday = iso === todayStr;
          const isSelected = iso === selectedDay;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelectDay(iso)}
              onContextMenu={(e) => onDayContextMenu(e, iso)}
              className={cn(
                "flex flex-col items-center py-2 transition-colors cursor-default select-none",
                isSelected ? "bg-[hsl(var(--primary)/0.08)]" : "hover:bg-[hsl(var(--muted))]"
              )}
            >
              <span className="text-[11px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                {WEEK_DAYS_SHORT[day.getDay()]}
              </span>
              <span
                className={cn(
                  "w-8 h-8 flex items-center justify-center rounded-full text-sm font-semibold mt-0.5",
                  isToday
                    ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                    : isSelected
                    ? "ring-2 ring-[hsl(var(--primary))] text-[hsl(var(--primary))]"
                    : "text-[hsl(var(--foreground))]"
                )}
              >
                {day.getDate()}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── All-day task row ── */}
      {weekDays.some((d) => tasks.some((t) => t.due_date === dateToISO(d) && !t.due_time)) && (
        <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.2)] shrink-0">
          <div className="flex items-center justify-end pr-2 py-1">
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">all-day</span>
          </div>
          {weekDays.map((day, i) => {
            const iso = dateToISO(day);
            const allDayTasks = tasks.filter(
              (t) => t.due_date === iso && !t.due_time
            );
            return (
              <div key={i} className="border-l border-[hsl(var(--border))] px-0.5 py-0.5 space-y-0.5 min-h-[24px]"
                onContextMenu={(e) => onDayContextMenu(e, iso)}
              >
                {allDayTasks.slice(0, 2).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onEditTask(t); }}
                    className={cn(
                      "w-full text-left text-[10px] font-medium px-1.5 py-0.5 rounded truncate",
                      PRIORITY_COLOR[t.priority],
                      t.status === "completed" && "opacity-50 line-through"
                    )}
                  >
                    {t.title}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Scrollable timeline ── */}
      <div
        ref={scrollRef}
        className="overflow-y-auto flex-1 min-h-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div
          className="grid grid-cols-[56px_repeat(7,1fr)] relative select-none"
          style={{ height: HOUR_HEIGHT * 24 }}
        >
          {/* Hour labels */}
          <div className="relative">
            {HOURS.map((h) => (
              <div
                key={h}
                className="absolute right-2 text-[11px] text-[hsl(var(--muted-foreground))] select-none"
                style={{ top: h * HOUR_HEIGHT - 7, width: 44, textAlign: "right" }}
              >
                {h > 0 ? fmtHourLabel(h) : ""}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((day, colIdx) => {
            const iso = dateToISO(day);
            const isToday = iso === todayStr;
            const colEvents = events.filter(
              (e) => toLocalDate(e.start_time) === iso
            );
            const timedTasks = tasks.filter(
              (t) => t.due_date === iso && !!t.due_time
            );

            return (
              <div
                key={colIdx}
                className={cn(
                  "relative border-l border-[hsl(var(--border))]",
                  isToday && "bg-[hsl(var(--primary)/0.03)]"
                )}
                onClick={() => onSelectDay(iso)}
                onContextMenu={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const time = pixelToTime(e.clientY - rect.top);
                  onDayContextMenu(e, iso, time);
                }}
              >
                {/* Hour grid lines */}
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-t border-[hsl(var(--border)/0.5)]"
                    style={{ top: h * HOUR_HEIGHT }}
                  />
                ))}

                {/* Current time indicator */}
                {isToday && todayInWeek && (
                  <div
                    className="absolute left-0 right-0 z-10 flex items-center pointer-events-none"
                    style={{ top: minutesToPx(nowMinutes) }}
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1.5 shrink-0" />
                    <div className="flex-1 h-px bg-red-500" />
                  </div>
                )}

                {/* Calendar events + timed tasks (side-by-side when overlapping) */}
                {(() => {
                  const intervals = [
                    ...colEvents.map(eventToInterval),
                    ...timedTasks.map((t) => taskToInterval(t, iso)),
                  ];
                  const layout = layoutOverlappingItems(intervals);

                  return (
                    <>
                      {colEvents.map((ev) => {
                        const { top, height } = eventBlockGeometry(ev.start_time, ev.end_time);
                        const place = layout.get(ev.id) ?? { column: 0, columnCount: 1 };
                        const col = overlapColumnStyle(place.column, place.columnCount, 2);
                        return (
                          <button
                            key={ev.id}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onEditEvent(ev); }}
                            onContextMenu={(e) => e.stopPropagation()}
                            className="absolute rounded-md px-1.5 py-0.5 text-left overflow-hidden bg-[hsl(var(--primary)/0.2)] border-l-2 border-[hsl(var(--primary))] text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.3)] transition-colors z-[5] cursor-pointer select-none"
                            style={{
                              top,
                              height: Math.max(24, height),
                              left: `calc(2px + ${col.left})`,
                              width: `calc(${col.width} - 2px)`,
                            }}
                          >
                            <span className="text-[11px] font-semibold leading-tight block truncate">
                              {ev.title}
                            </span>
                            {height >= 40 && (
                              <span className="text-[10px] opacity-80 leading-tight block">
                                {fmt12(ev.start_time)}
                              </span>
                            )}
                          </button>
                        );
                      })}

                      {timedTasks.map((t) => {
                        const fakeIso = `${iso}T${t.due_time}`;
                        const topPx = minutesToPx(isoToMinutes(new Date(fakeIso).toISOString()));
                        const place = layout.get(t.id) ?? { column: 0, columnCount: 1 };
                        const col = overlapColumnStyle(place.column, place.columnCount, 2);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onEditTask(t); }}
                            onContextMenu={(e) => e.stopPropagation()}
                            className={cn(
                              "absolute rounded-md px-1.5 py-0.5 text-left overflow-hidden z-[5] hover:brightness-95 transition-all cursor-pointer select-none",
                              PRIORITY_COLOR[t.priority],
                              t.status === "completed" && "opacity-40"
                            )}
                            style={{
                              top: topPx,
                              height: 28,
                              left: `calc(2px + ${col.left})`,
                              width: `calc(${col.width} - 2px)`,
                            }}
                          >
                            <span className="text-[11px] font-semibold leading-tight block truncate">
                              {t.title}
                            </span>
                          </button>
                        );
                      })}
                    </>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
