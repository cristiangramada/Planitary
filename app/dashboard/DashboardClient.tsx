"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckSquare,
  Plus,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TaskCard } from "@/app/tasks/TaskCard";
import { TaskForm } from "@/app/tasks/TaskForm";
import { EventForm } from "@/app/calendar/EventForm";
import { createClient } from "@/lib/supabase/client";
import {
  createTask,
  updateTask,
  deleteTask,
  setTaskComplete,
  updateTaskTitleNotes,
  patchTaskFields,
} from "@/lib/tasks";
import type { TaskFormData, SubtaskFormItem } from "@/lib/tasks";
import { createEvent, updateEvent, deleteEvent } from "@/lib/calendar";
import type { EventFormData } from "@/lib/calendar";
import { createJournalEntry, updateJournalEntry, deleteJournalEntry } from "@/lib/journal";
import {
  fetchDashboardData,
  sortTodayTasks,
  type DashboardData,
} from "@/lib/dashboard";
import { useClientLocalToday, useClientLocalHour } from "@/hooks/useClientLocalToday";
import { toLocalDate as eventLocalDate } from "@/app/calendar/calendarUtils";
import { parseDateOnly } from "@/utils/date";
import { DashboardSection, DashboardSkeletonRows, DashboardEmptyState } from "./DashboardSection";
import { JournalPreview } from "./JournalPreview";
import { EventsPreview } from "./EventsPreview";
import type { TaskWithDetails, CalendarEvent, Priority, RepeatOption } from "@/types";

interface DashboardClientProps {
  initialDate: string;
  initialHour: number;
  initialData: DashboardData;
  displayName: string | null;
}

function getGreeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function friendlyDate(dateStr: string): string {
  return parseDateOnly(dateStr).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function DashboardClient({
  initialDate,
  initialHour,
  initialData,
  displayName,
}: DashboardClientProps) {
  const clientToday = useClientLocalToday(initialDate);
  const clientHour = useClientLocalHour(initialHour);

  const [data, setData] = useState<DashboardData>(initialData);
  const [refreshing, setRefreshing] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithDetails | null>(null);
  const [eventFormOpen, setEventFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const journalInputRef = useRef<HTMLInputElement>(null);

  const isFirstRun = useRef(true);

  // ---------------------------------------------------------------------------
  // Refresh — same "trust SSR, refetch if the local date disagrees" pattern
  // used by the Journal page (server clock is UTC on Vercel).
  // ---------------------------------------------------------------------------

  const refetchAll = useCallback(async () => {
    setRefreshing(true);
    try {
      const supabase = createClient();
      const fresh = await fetchDashboardData(supabase, clientToday);
      setData(fresh);
    } finally {
      setRefreshing(false);
    }
  }, [clientToday]);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      if (clientToday === initialDate) return; // SSR data already matches
    }
    refetchAll();
  }, [clientToday, initialDate, refetchAll]);

  const getUserId = useCallback(async () => {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error("Not signed in");
    return userData.user.id;
  }, []);

  // ---------------------------------------------------------------------------
  // Task mutations — reuses lib/tasks.ts exactly like the Tasks page, so
  // behavior (validation, timestamps, cascades) can never diverge.
  // ---------------------------------------------------------------------------

  const placeTask = useCallback(
    (task: TaskWithDetails) => {
      setData((d) => {
        const withoutTask = d.todayTasks.data.filter((t) => t.id !== task.id);
        const isActive = task.status === "active";
        const dueToday = task.due_date === clientToday;
        return {
          ...d,
          todayTasks: {
            ...d.todayTasks,
            data:
              isActive && dueToday
                ? sortTodayTasks([...withoutTask, task])
                : withoutTask,
          },
        };
      });
    },
    [clientToday]
  );

  const removeTask = useCallback((taskId: string) => {
    setData((d) => ({
      ...d,
      todayTasks: { ...d.todayTasks, data: d.todayTasks.data.filter((t) => t.id !== taskId) },
    }));
  }, []);

  const handleTaskSave = useCallback(
    async (formData: TaskFormData, subtasks: SubtaskFormItem[]) => {
      const supabase = createClient();
      if (editingTask) {
        const userId = await getUserId();
        const updated = await updateTask(supabase, editingTask.id, userId, formData, subtasks);
        placeTask(updated);
      } else {
        const userId = await getUserId();
        const created = await createTask(supabase, userId, formData, subtasks);
        placeTask(created);
      }
      setTaskFormOpen(false);
      setEditingTask(null);
    },
    [editingTask, getUserId, placeTask]
  );

  const handleToggleComplete = useCallback(
    async (taskId: string, completed: boolean) => {
      removeTask(taskId); // optimistic — Dashboard only shows active tasks
      try {
        const supabase = createClient();
        const { nextTask } = await setTaskComplete(supabase, taskId, completed);
        if (nextTask) placeTask(nextTask);
      } catch (err) {
        setMutationError(err instanceof Error ? err.message : "Failed to update task.");
        refetchAll();
      }
    },
    [refetchAll, removeTask, placeTask]
  );

  const handleRenameTitle = useCallback(
    async (taskId: string, title: string) => {
      const current = data.todayTasks.data.find((t) => t.id === taskId);
      const notes = current?.notes ?? null;
      setData((d) => ({
        ...d,
        todayTasks: {
          ...d.todayTasks,
          data: d.todayTasks.data.map((t) => (t.id === taskId ? { ...t, title } : t)),
        },
      }));
      try {
        const supabase = createClient();
        await updateTaskTitleNotes(supabase, taskId, title, notes);
      } catch (err) {
        setMutationError(err instanceof Error ? err.message : "Failed to rename task.");
        refetchAll();
        throw err;
      }
    },
    [data.todayTasks.data, refetchAll]
  );

  const handleSetPriority = useCallback(
    async (taskId: string, priority: Priority) => {
      setData((d) => ({
        ...d,
        todayTasks: {
          ...d.todayTasks,
          data: d.todayTasks.data.map((t) => (t.id === taskId ? { ...t, priority } : t)),
        },
      }));
      try {
        const supabase = createClient();
        await patchTaskFields(supabase, taskId, { priority });
      } catch (err) {
        setMutationError(err instanceof Error ? err.message : "Failed to update priority.");
        refetchAll();
        throw err;
      }
    },
    [refetchAll]
  );

  const handleSetDue = useCallback(
    async (taskId: string, date: string | null, time: string | null, repeat: RepeatOption) => {
      const due_time = date && time ? (time.length === 5 ? `${time}:00` : time) : null;
      setData((d) => ({
        ...d,
        todayTasks: {
          ...d.todayTasks,
          data: d.todayTasks.data.map((t) =>
            t.id === taskId ? { ...t, due_date: date, due_time, repeat } : t
          ),
        },
      }));
      try {
        const supabase = createClient();
        const applied = await patchTaskFields(supabase, taskId, { due_date: date, due_time, repeat });
        setData((d) => ({
          ...d,
          todayTasks: {
            ...d.todayTasks,
            data: d.todayTasks.data.map((t) => (t.id === taskId ? { ...t, ...applied } : t)),
          },
        }));
      } catch (err) {
        setMutationError(err instanceof Error ? err.message : "Failed to update due date.");
        refetchAll();
        throw err;
      }
    },
    [refetchAll]
  );

  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      removeTask(taskId);
      try {
        const supabase = createClient();
        await deleteTask(supabase, taskId);
      } catch (err) {
        setMutationError(err instanceof Error ? err.message : "Failed to delete task.");
        refetchAll();
      }
    },
    [refetchAll, removeTask]
  );

  // ---------------------------------------------------------------------------
  // Event mutations — reuses lib/calendar.ts exactly like the Calendar page.
  // ---------------------------------------------------------------------------

  const handleEventSave = useCallback(
    async (formData: EventFormData) => {
      let saved: CalendarEvent;
      if (editingEvent) {
        saved = await updateEvent(editingEvent.id, formData);
      } else {
        const userId = await getUserId();
        saved = await createEvent(userId, formData);
      }
      setData((d) => {
        const without = d.todayEvents.data.filter((e) => e.id !== saved.id);
        const isToday = eventLocalDate(saved.start_time) === clientToday;
        const next = isToday
          ? [...without, saved].sort((a, b) => a.start_time.localeCompare(b.start_time))
          : without;
        return { ...d, todayEvents: { ...d.todayEvents, data: next } };
      });
      setEventFormOpen(false);
      setEditingEvent(null);
    },
    [editingEvent, getUserId, clientToday]
  );

  const handleDeleteEvent = useCallback(
    async (eventId: string) => {
      setData((d) => ({
        ...d,
        todayEvents: {
          ...d.todayEvents,
          data: d.todayEvents.data.filter((e) => e.id !== eventId),
        },
      }));
      try {
        await deleteEvent(eventId);
      } catch (err) {
        setMutationError(err instanceof Error ? err.message : "Failed to delete event.");
        refetchAll();
      }
    },
    [refetchAll]
  );

  // ---------------------------------------------------------------------------
  // Journal — reuses lib/journal.ts exactly like the Journal page.
  // ---------------------------------------------------------------------------

  const handleJournalQuickAdd = useCallback(
    async (content: string) => {
      const supabase = createClient();
      const userId = await getUserId();
      const created = await createJournalEntry(supabase, userId, clientToday, content);
      setData((d) => ({
        ...d,
        todayJournalEntries: { ...d.todayJournalEntries, data: [created, ...d.todayJournalEntries.data] },
      }));
    },
    [getUserId, clientToday]
  );

  const handleDeleteJournalEntry = useCallback(
    async (entryId: string) => {
      setData((d) => ({
        ...d,
        todayJournalEntries: {
          ...d.todayJournalEntries,
          data: d.todayJournalEntries.data.filter((e) => e.id !== entryId),
        },
      }));
      try {
        const supabase = createClient();
        await deleteJournalEntry(supabase, entryId);
      } catch (err) {
        setMutationError(err instanceof Error ? err.message : "Failed to delete journal entry.");
        refetchAll();
      }
    },
    [refetchAll]
  );

  const handleSaveJournalEntry = useCallback(async (entryId: string, content: string) => {
    const supabase = createClient();
    const updated = await updateJournalEntry(supabase, entryId, content);
    setData((d) => ({
      ...d,
      todayJournalEntries: {
        ...d.todayJournalEntries,
        data: d.todayJournalEntries.data.map((e) => (e.id === entryId ? updated : e)),
      },
    }));
  }, []);

  function openNewTask() {
    setEditingTask(null);
    setTaskFormOpen(true);
  }
  function openNewEvent() {
    setEditingEvent(null);
    setEventFormOpen(true);
  }
  function openEditEvent(event: CalendarEvent) {
    setEditingEvent(event);
    setEventFormOpen(true);
  }

  const greeting = displayName ? `${getGreeting(clientHour)}, ${displayName}` : getGreeting(clientHour);

  return (
    <AppShell
      topBar={<h2 className="text-xl font-bold tracking-tight">{greeting}</h2>}
    >
      <div className="h-full flex flex-col gap-4 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* ── Header ── */}
        <div className="shrink-0">
          <p className="text-3xl font-semibold tracking-tight">
            {friendlyDate(clientToday)}
          </p>
        </div>

        {/* ── Mutation error banner ── */}
        {mutationError && (
          <div role="alert" className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-red-500/20 bg-red-500/10 text-sm text-red-500 shrink-0">
            {mutationError}
            <button onClick={() => setMutationError(null)} className="text-xs underline cursor-pointer shrink-0">
              Dismiss
            </button>
          </div>
        )}

        {/* ── Sections ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pb-2 min-h-0">
          {/* Left — tasks + events */}
          <div className="lg:col-span-2 flex flex-col gap-4 min-w-0">
            <DashboardSection
              icon={CheckSquare}
              iconClassName="text-blue-500"
              title="Today's tasks"
              headerAction={
                <button
                  type="button"
                  onClick={openNewTask}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-3 h-3" />
                  Add task
                </button>
              }
              error={data.todayTasks.error}
              onRetry={refetchAll}
              loading={refreshing}
            >
              {refreshing && data.todayTasks.data.length === 0 ? (
                <DashboardSkeletonRows />
              ) : data.todayTasks.data.length === 0 ? (
                <DashboardEmptyState message="No tasks due today." />
              ) : (
                <div className="space-y-2">
                  {data.todayTasks.data.slice(0, 8).map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onDelete={handleDeleteTask}
                      onToggleComplete={handleToggleComplete}
                      onRenameTitle={handleRenameTitle}
                      onSetPriority={handleSetPriority}
                      onSetDue={handleSetDue}
                    />
                  ))}
                </div>
              )}
            </DashboardSection>

            <EventsPreview
              events={data.todayEvents.data}
              error={data.todayEvents.error}
              loading={refreshing}
              onRetry={refetchAll}
              onOpenEvent={openEditEvent}
              onDeleteEvent={handleDeleteEvent}
              onCreateEvent={openNewEvent}
            />
          </div>

          {/* Right — journal */}
          <div className="min-w-0 lg:min-h-full">
            <JournalPreview
              entries={data.todayJournalEntries.data}
              error={data.todayJournalEntries.error}
              loading={refreshing}
              onRetry={refetchAll}
              onQuickAdd={handleJournalQuickAdd}
              onSave={handleSaveJournalEntry}
              onDelete={handleDeleteJournalEntry}
              inputRef={journalInputRef}
              className="lg:h-full"
            />
          </div>
        </div>
      </div>

      {/* ── Shared creation flows — identical components/behavior to Tasks & Calendar ── */}
      <TaskForm
        open={taskFormOpen}
        onClose={() => {
          setTaskFormOpen(false);
          setEditingTask(null);
        }}
        onSave={handleTaskSave}
        editTask={editingTask}
        defaultDueDate={clientToday}
      />
      <EventForm
        open={eventFormOpen}
        onClose={() => {
          setEventFormOpen(false);
          setEditingEvent(null);
        }}
        onSave={handleEventSave}
        editEvent={editingEvent}
        defaultDate={clientToday}
      />
    </AppShell>
  );
}
