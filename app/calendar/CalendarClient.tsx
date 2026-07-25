"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { CalendarHeader, type CalView } from "./CalendarHeader";
import { MonthView } from "./MonthView";
import { WeekView } from "./WeekView";
import { DayView } from "./DayView";
import { AgendaPanel } from "./AgendaPanel";
import { CalendarDayContextMenu } from "./CalendarDayContextMenu";
import { EventForm } from "./EventForm";
import { TaskForm } from "@/app/tasks/TaskForm";
import { createClient } from "@/lib/supabase/client";
import { createEvent, updateEvent, deleteEvent } from "@/lib/calendar";
import { createTask, updateTask, deleteTask, deleteTag } from "@/lib/tasks";
import type { CalendarEvent, TaskWithDetails, Tag } from "@/types";
import type { EventFormData } from "@/lib/calendar";
import type { TaskFormData, SubtaskFormItem, TagFormItem } from "@/lib/tasks";
import {
  localTodayStr,
  dateToISO,
  getWeekStart,
  parseDate,
  fmtMonthYear,
  fmtWeekRange,
  fmtDayFull,
} from "./calendarUtils";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface CalendarClientProps {
  initialEvents: CalendarEvent[];
  initialTasks: TaskWithDetails[];
  allTags: Tag[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function CalendarClient({
  initialEvents,
  initialTasks,
  allTags: initialTags,
}: CalendarClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── Data state ───────────────────────────────────────────────────────────
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
  const [tasks, setTasks] = useState<TaskWithDetails[]>(initialTasks);
  const [allTags, setAllTags] = useState<Tag[]>(initialTags);

  // ── View + navigation state ───────────────────────────────────────────────
  const now = new Date();
  const [view, setView] = useState<CalView>("month");
  const [selectedDay, setSelectedDay] = useState(localTodayStr());
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [weekStart, setWeekStart] = useState(() => getWeekStart(now));

  // ── Form state ────────────────────────────────────────────────────────────
  const [eventFormOpen, setEventFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [eventFormDate, setEventFormDate] = useState<string | null>(null);
  const [eventFormTime, setEventFormTime] = useState<string | null>(null);

  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithDetails | null>(null);
  const [taskFormDefaultDate, setTaskFormDefaultDate] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  const [dayContextMenu, setDayContextMenu] = useState<{
    iso: string;
    time: string | null;
    x: number;
    y: number;
  } | null>(null);

  // ── Deep-link support: /calendar?event=<id>&date=<date> (e.g. from a Search
  // result) navigates to that date and opens the event's editor, then clears
  // the params so it doesn't reopen. ─────────────────────────────────────────
  useEffect(() => {
    const eventId = searchParams.get("event");
    const dateParam = searchParams.get("date");
    if (!eventId && !dateParam) return;

    /* eslint-disable react-hooks/set-state-in-effect -- navigate to the deep-linked date/event once, from a URL navigation */
    if (dateParam) {
      const d = parseDate(dateParam);
      setSelectedDay(dateParam);
      setCalYear(d.getFullYear());
      setCalMonth(d.getMonth());
      setWeekStart(getWeekStart(d));
    }
    if (eventId) {
      const event = events.find((e) => e.id === eventId);
      if (event) {
        setEditingEvent(event);
        setEventFormOpen(true);
      }
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    router.replace("/calendar", { scroll: false });
  }, [searchParams, events, router]);

  // ── Derived header label ──────────────────────────────────────────────────
  const headerLabel = useMemo(() => {
    if (view === "month") return fmtMonthYear(calYear, calMonth);
    if (view === "week") return fmtWeekRange(weekStart);
    return fmtDayFull(parseDate(selectedDay));
  }, [view, calYear, calMonth, weekStart, selectedDay]);

  // ── Navigation ────────────────────────────────────────────────────────────

  function handlePrev() {
    if (view === "month") {
      if (calMonth === 0) { setCalYear((y) => y - 1); setCalMonth(11); }
      else setCalMonth((m) => m - 1);
    } else if (view === "week") {
      setWeekStart((ws) => {
        const d = new Date(ws);
        d.setDate(d.getDate() - 7);
        return d;
      });
    } else {
      // day view — move selectedDay back
      const d = parseDate(selectedDay);
      d.setDate(d.getDate() - 1);
      setSelectedDay(dateToISO(d));
    }
  }

  function handleNext() {
    if (view === "month") {
      if (calMonth === 11) { setCalYear((y) => y + 1); setCalMonth(0); }
      else setCalMonth((m) => m + 1);
    } else if (view === "week") {
      setWeekStart((ws) => {
        const d = new Date(ws);
        d.setDate(d.getDate() + 7);
        return d;
      });
    } else {
      const d = parseDate(selectedDay);
      d.setDate(d.getDate() + 1);
      setSelectedDay(dateToISO(d));
    }
  }

  function handleToday() {
    const today = new Date();
    setCalYear(today.getFullYear());
    setCalMonth(today.getMonth());
    setWeekStart(getWeekStart(today));
    setSelectedDay(localTodayStr());
  }

  function handleViewChange(newView: CalView) {
    const day = parseDate(selectedDay);
    if (newView === "week") setWeekStart(getWeekStart(day));
    else if (newView === "month") {
      setCalYear(day.getFullYear());
      setCalMonth(day.getMonth());
    }
    setView(newView);
  }

  function handleSelectDay(iso: string) {
    setSelectedDay(iso);
  }

  // ── Event CRUD ────────────────────────────────────────────────────────────

  const getUserId = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw new Error("Not signed in");
    return data.user.id;
  }, []);

  const handleEventSave = useCallback(
    async (data: EventFormData) => {
      setError(null);
      try {
        if (editingEvent) {
          const updated = await updateEvent(editingEvent.id, data);
          setEvents((prev) =>
            [...prev.filter((e) => e.id !== updated.id), updated].sort((a, b) =>
              a.start_time.localeCompare(b.start_time)
            )
          );
        } else {
          const userId = await getUserId();
          const created = await createEvent(userId, data);
          setEvents((prev) =>
            [...prev, created].sort((a, b) =>
              a.start_time.localeCompare(b.start_time)
            )
          );
        }
        setEventFormOpen(false);
        setEditingEvent(null);
        setEventFormDate(null);
      } catch (err) {
        throw err; // EventForm shows inline errors
      }
    },
    [editingEvent, getUserId]
  );

  const handleEditEvent = useCallback((event: CalendarEvent) => {
    setEditingEvent(event);
    setEventFormOpen(true);
  }, []);

  const handleDeleteEvent = useCallback(async (id: string) => {
    setError(null);
    try {
      await deleteEvent(id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete event.");
    }
  }, []);

  function openNewEventForm(date?: string, time?: string) {
    setEditingEvent(null);
    setEventFormDate(date ?? selectedDay);
    setEventFormTime(time ?? null);
    setEventFormOpen(true);
  }

  function handleDayContextMenu(
    e: React.MouseEvent,
    iso: string,
    time?: string
  ) {
    e.preventDefault();
    setSelectedDay(iso);
    setDayContextMenu({
      iso,
      time: time ?? null,
      x: e.clientX,
      y: e.clientY,
    });
  }

  function handleDayViewContextMenu(e: React.MouseEvent, time?: string) {
    handleDayContextMenu(e, selectedDay, time);
  }

  // ── Task CRUD (calendar context) ──────────────────────────────────────────

  const handleTaskSave = useCallback(
    async (
      data: TaskFormData,
      subtasks: SubtaskFormItem[],
      tags: TagFormItem[]
    ) => {
      setError(null);
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) throw new Error("Not signed in");

      if (editingTask) {
        const updated = await updateTask(
          supabase,
          editingTask.id,
          authData.user.id,
          data,
          subtasks,
          tags
        );
        setTasks((prev) => {
          const without = prev.filter((t) => t.id !== updated.id);
          return updated.due_date ? [...without, updated] : without;
        });
        updated.tags.forEach((tag) => {
          setAllTags((prev) =>
            prev.some((t) => t.id === tag.id) ? prev : [...prev, tag]
          );
        });
      } else {
        const created = await createTask(
          supabase,
          authData.user.id,
          data,
          subtasks,
          tags
        );
        if (created.due_date) {
          setTasks((prev) => [...prev, created]);
        }
        created.tags.forEach((tag) => {
          setAllTags((prev) =>
            prev.some((t) => t.id === tag.id) ? prev : [...prev, tag]
          );
        });
      }

      setTaskFormOpen(false);
      setEditingTask(null);
    },
    [editingTask]
  );

  const handleEditTask = useCallback((task: TaskWithDetails) => {
    setEditingTask(task);
    setTaskFormDefaultDate(null);
    setTaskFormOpen(true);
  }, []);

  const handleDeleteTask = useCallback(async (id: string) => {
    setError(null);
    try {
      const supabase = createClient();
      await deleteTask(supabase, id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete task.");
    }
  }, []);

  const handleDeleteTag = useCallback(async (tagId: string) => {
    const supabase = createClient();
    await deleteTag(supabase, tagId);
    setAllTags((prev) => prev.filter((t) => t.id !== tagId));
    setTasks((prev) =>
      prev.map((task) => ({
        ...task,
        tags: task.tags.filter((t) => t.id !== tagId),
      }))
    );
  }, []);

  function openNewTaskForm(date?: string) {
    setEditingTask(null);
    setTaskFormDefaultDate(date ?? null);
    setTaskFormOpen(true);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AppShell flushTop>
      <div className="h-full flex flex-col">
        {/* ── Error banner ── */}
        {error && (
          <div className="mb-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-500 shrink-0">
            {error}
          </div>
        )}

        {/* ── Header ── */}
        <div className="shrink-0">
          <CalendarHeader
            label={headerLabel}
            view={view}
            onPrev={handlePrev}
            onNext={handleNext}
            onToday={handleToday}
            onViewChange={handleViewChange}
          />
        </div>

        {/* ── Two-column body ── */}
        <div className="flex-1 flex gap-4 mt-4 min-h-0">

          {/* Left: calendar view (fills remaining height) */}
          <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
            {view === "month" && (
              <MonthView
                year={calYear}
                month={calMonth}
                events={events}
                tasks={tasks}
                selectedDay={selectedDay}
                onSelectDay={handleSelectDay}
                onDayContextMenu={handleDayContextMenu}
              />
            )}

            {view === "week" && (
              <WeekView
                weekStart={weekStart}
                events={events}
                tasks={tasks}
                selectedDay={selectedDay}
                onSelectDay={handleSelectDay}
                onEditEvent={handleEditEvent}
                onEditTask={handleEditTask}
                onDayContextMenu={handleDayContextMenu}
              />
            )}

            {view === "day" && (
              <DayView
                date={parseDate(selectedDay)}
                events={events}
                tasks={tasks}
                onEditEvent={handleEditEvent}
                onEditTask={handleEditTask}
                onDayContextMenu={handleDayViewContextMenu}
              />
            )}
          </div>

          {/* Right: agenda panel */}
          <div className="w-80 shrink-0 flex flex-col min-h-0 border-l border-[hsl(var(--border))] pl-4">
            <AgendaPanel
              selectedDay={selectedDay}
              events={events}
              tasks={tasks}
              onEditEvent={handleEditEvent}
              onEditTask={handleEditTask}
              onDeleteEvent={handleDeleteEvent}
              onDeleteTask={handleDeleteTask}
              onNewEvent={openNewEventForm}
              onNewTask={openNewTaskForm}
            />
          </div>

        </div>
      </div>

      {dayContextMenu && (
        <CalendarDayContextMenu
          x={dayContextMenu.x}
          y={dayContextMenu.y}
          onAddEvent={() =>
            openNewEventForm(
              dayContextMenu.iso,
              dayContextMenu.time ?? undefined
            )
          }
          onAddTask={() => openNewTaskForm(dayContextMenu.iso)}
          onClose={() => setDayContextMenu(null)}
        />
      )}

      {/* ── Event form modal ── */}
      <EventForm
        open={eventFormOpen}
        editEvent={editingEvent}
        defaultDate={eventFormDate}
        defaultTime={eventFormTime}
        onClose={() => {
          setEventFormOpen(false);
          setEditingEvent(null);
          setEventFormDate(null);
          setEventFormTime(null);
        }}
        onSave={handleEventSave}
      />

      {/* ── Task form modal ── */}
      <TaskForm
        open={taskFormOpen}
        editTask={editingTask}
        defaultDueDate={taskFormDefaultDate}
        allTags={allTags}
        onClose={() => {
          setTaskFormOpen(false);
          setEditingTask(null);
          setTaskFormDefaultDate(null);
        }}
        onSave={handleTaskSave}
        onDeleteTag={handleDeleteTag}
      />
    </AppShell>
  );
}
