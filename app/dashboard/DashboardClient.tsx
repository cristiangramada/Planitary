"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckSquare,
  CalendarDays,
  BookOpen,
  Search,
  Sparkles,
  Plus,
  AlertTriangle,
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
  deleteTag,
  setTaskComplete,
  setSubtaskComplete,
} from "@/lib/tasks";
import type { TaskFormData, SubtaskFormItem, TagFormItem } from "@/lib/tasks";
import { createEvent, updateEvent } from "@/lib/calendar";
import type { EventFormData } from "@/lib/calendar";
import { createJournalEntry } from "@/lib/journal";
import {
  fetchDashboardData,
  fetchWeeklyProgress,
  getDashboardWeekRange,
  sortTodayTasks,
  type DashboardData,
} from "@/lib/dashboard";
import { useClientLocalToday, useClientLocalHour } from "@/hooks/useClientLocalToday";
import { toLocalDate as eventLocalDate } from "@/app/calendar/calendarUtils";
import { parseDateOnly } from "@/utils/date";
import { DashboardSection, DashboardSkeletonRows, DashboardEmptyState } from "./DashboardSection";
import { WeeklyProgress } from "./WeeklyProgress";
import { JournalPreview } from "./JournalPreview";
import { EventsPreview } from "./EventsPreview";
import type { TaskWithDetails, Tag, CalendarEvent } from "@/types";

interface DashboardClientProps {
  initialDate: string;
  initialHour: number;
  initialData: DashboardData;
  allTags: Tag[];
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
  allTags: initialAllTags,
  displayName,
}: DashboardClientProps) {
  const router = useRouter();
  const clientToday = useClientLocalToday(initialDate);
  const clientHour = useClientLocalHour(initialHour);

  const [data, setData] = useState<DashboardData>(initialData);
  const [allTags, setAllTags] = useState<Tag[]>(initialAllTags);
  const [refreshing, setRefreshing] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

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

  const refreshWeekly = useCallback(async () => {
    try {
      const supabase = createClient();
      const range = getDashboardWeekRange(clientToday);
      const fresh = await fetchWeeklyProgress(supabase, range);
      setData((d) => ({ ...d, weeklyProgress: { data: fresh, error: null } }));
    } catch {
      // Non-critical background refresh — keep the previous value on failure.
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
        const withoutTask = {
          todayTasks: d.todayTasks.data.filter((t) => t.id !== task.id),
          overdueTasks: d.overdueTasks.data.filter((t) => t.id !== task.id),
        };
        const isActive = task.status === "active";
        const dueToday = task.due_date === clientToday;
        const isOverdue = !!task.due_date && task.due_date < clientToday;
        return {
          ...d,
          todayTasks: {
            ...d.todayTasks,
            data:
              isActive && dueToday
                ? sortTodayTasks([...withoutTask.todayTasks, task])
                : withoutTask.todayTasks,
          },
          overdueTasks: {
            ...d.overdueTasks,
            data:
              isActive && isOverdue
                ? [...withoutTask.overdueTasks, task].sort((a, b) =>
                    (a.due_date ?? "").localeCompare(b.due_date ?? "")
                  )
                : withoutTask.overdueTasks,
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
      overdueTasks: {
        ...d.overdueTasks,
        data: d.overdueTasks.data.filter((t) => t.id !== taskId),
      },
    }));
  }, []);

  const handleTaskSave = useCallback(
    async (formData: TaskFormData, subtasks: SubtaskFormItem[], tags: TagFormItem[]) => {
      const supabase = createClient();
      if (editingTask) {
        const userId = await getUserId();
        const updated = await updateTask(supabase, editingTask.id, userId, formData, subtasks, tags);
        placeTask(updated);
        setAllTags((prev) => {
          const next = [...prev];
          updated.tags.forEach((tag) => {
            if (!next.some((t) => t.id === tag.id)) next.push(tag);
          });
          return next;
        });
      } else {
        const userId = await getUserId();
        const created = await createTask(supabase, userId, formData, subtasks, tags);
        placeTask(created);
        setAllTags((prev) => {
          const next = [...prev];
          created.tags.forEach((tag) => {
            if (!next.some((t) => t.id === tag.id)) next.push(tag);
          });
          return next;
        });
      }
      setTaskFormOpen(false);
      setEditingTask(null);
      refreshWeekly();
    },
    [editingTask, getUserId, refreshWeekly, placeTask]
  );

  const handleDeleteTag = useCallback(async (tagId: string) => {
    const supabase = createClient();
    await deleteTag(supabase, tagId);
    setAllTags((prev) => prev.filter((t) => t.id !== tagId));
    setData((d) => ({
      ...d,
      todayTasks: {
        ...d.todayTasks,
        data: d.todayTasks.data.map((t) => ({ ...t, tags: t.tags.filter((tg) => tg.id !== tagId) })),
      },
      overdueTasks: {
        ...d.overdueTasks,
        data: d.overdueTasks.data.map((t) => ({ ...t, tags: t.tags.filter((tg) => tg.id !== tagId) })),
      },
    }));
  }, []);

  const handleToggleComplete = useCallback(
    async (taskId: string, completed: boolean) => {
      removeTask(taskId); // optimistic — Dashboard only shows active tasks
      try {
        const supabase = createClient();
        await setTaskComplete(supabase, taskId, completed);
        refreshWeekly();
      } catch (err) {
        setMutationError(err instanceof Error ? err.message : "Failed to update task.");
        refetchAll();
      }
    },
    [refreshWeekly, refetchAll, removeTask]
  );

  const handleToggleSubtask = useCallback(
    async (taskId: string, subtaskId: string, completed: boolean) => {
      setData((d) => {
        function patch(list: TaskWithDetails[]) {
          return list.map((t) =>
            t.id === taskId
              ? { ...t, subtasks: t.subtasks.map((s) => (s.id === subtaskId ? { ...s, is_completed: completed } : s)) }
              : t
          );
        }
        return {
          ...d,
          todayTasks: { ...d.todayTasks, data: patch(d.todayTasks.data) },
          overdueTasks: { ...d.overdueTasks, data: patch(d.overdueTasks.data) },
        };
      });
      try {
        const supabase = createClient();
        await setSubtaskComplete(supabase, subtaskId, completed);
      } catch (err) {
        setMutationError(err instanceof Error ? err.message : "Failed to update subtask.");
        refetchAll();
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
        refreshWeekly();
      } catch (err) {
        setMutationError(err instanceof Error ? err.message : "Failed to delete task.");
        refetchAll();
      }
    },
    [refreshWeekly, refetchAll, removeTask]
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
      refreshWeekly();
    },
    [editingEvent, getUserId, clientToday, refreshWeekly]
  );

  // ---------------------------------------------------------------------------
  // Journal quick-add — reuses lib/journal.ts exactly like the Journal page.
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
      refreshWeekly();
    },
    [getUserId, clientToday, refreshWeekly]
  );

  // ---------------------------------------------------------------------------
  // Quick actions
  // ---------------------------------------------------------------------------

  function openNewTask() {
    setEditingTask(null);
    setTaskFormOpen(true);
  }
  function openEditTask(task: TaskWithDetails) {
    setEditingTask(task);
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
  function focusJournalQuickAdd() {
    journalInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    journalInputRef.current?.focus();
  }
  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  }

  const greeting = displayName ? `${getGreeting(clientHour)}, ${displayName}` : getGreeting(clientHour);
  const overdueCount = data.overdueTasks.data.length;

  return (
    <AppShell title="Dashboard">
      <div className="h-full flex flex-col gap-4 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 shrink-0">
          <div>
            <h2 className="text-xl font-bold tracking-tight">{greeting}</h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
              {friendlyDate(clientToday)}
            </p>
          </div>
          <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-64">
            <label htmlFor="dashboard-search" className="sr-only">
              Search Planitary
            </label>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]"
            />
            <input
              id="dashboard-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks, journal, events…"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] focus:outline-none"
            />
          </form>
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

        {/* ── Quick actions ── */}
        <div className="flex flex-wrap gap-2 shrink-0">
          <QuickActionButton icon={CheckSquare} label="New Task" onClick={openNewTask} primary />
          <QuickActionButton icon={CalendarDays} label="New Event" onClick={openNewEvent} primary />
          <QuickActionButton icon={BookOpen} label="Add Journal Entry" onClick={focusJournalQuickAdd} primary />
          <QuickActionButton
            icon={Sparkles}
            label="Generate Standup"
            onClick={() => router.push("/journal?section=standup")}
          />
        </div>

        {/* ── Sections ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pb-2">
          {/* Main column */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <DashboardSection
              icon={CheckSquare}
              iconClassName="text-blue-500"
              title="Today's tasks"
              viewAllHref="/tasks"
              error={data.todayTasks.error}
              onRetry={refetchAll}
              loading={refreshing}
            >
              {refreshing && data.todayTasks.data.length === 0 ? (
                <DashboardSkeletonRows />
              ) : data.todayTasks.data.length === 0 ? (
                <DashboardEmptyState
                  message="No tasks due today."
                  action={
                    <button
                      type="button"
                      onClick={openNewTask}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))] transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add a task
                    </button>
                  }
                />
              ) : (
                <div className="space-y-2">
                  {data.todayTasks.data.slice(0, 8).map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onEdit={openEditTask}
                      onDelete={handleDeleteTask}
                      onToggleComplete={handleToggleComplete}
                      onToggleSubtask={handleToggleSubtask}
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
              onCreateEvent={openNewEvent}
            />

            <JournalPreview
              entries={data.todayJournalEntries.data}
              todayStr={clientToday}
              error={data.todayJournalEntries.error}
              loading={refreshing}
              onRetry={refetchAll}
              onQuickAdd={handleJournalQuickAdd}
              inputRef={journalInputRef}
            />
          </div>

          {/* Secondary column */}
          <div className="flex flex-col gap-4">
            {overdueCount > 0 && (
              <DashboardSection
                icon={AlertTriangle}
                iconClassName="text-red-500"
                title="Overdue"
                viewAllHref="/tasks"
                error={data.overdueTasks.error}
                onRetry={refetchAll}
                loading={refreshing}
              >
                <div className="space-y-2">
                  {data.overdueTasks.data.slice(0, 6).map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onEdit={openEditTask}
                      onDelete={handleDeleteTask}
                      onToggleComplete={handleToggleComplete}
                      onToggleSubtask={handleToggleSubtask}
                    />
                  ))}
                </div>
                {data.overdueTasks.data.length > 6 && (
                  <a
                    href="/tasks"
                    className="block mt-2 text-center text-xs font-medium text-[hsl(var(--primary))] hover:underline"
                  >
                    View all overdue tasks
                  </a>
                )}
              </DashboardSection>
            )}

            <WeeklyProgress
              data={data.weeklyProgress.data}
              error={data.weeklyProgress.error}
              loading={refreshing}
              onRetry={refetchAll}
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
        onDeleteTag={handleDeleteTag}
        editTask={editingTask}
        defaultDueDate={clientToday}
        allTags={allTags}
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

// ─────────────────────────────────────────────────────────────────────────────
// Quick action button
// ─────────────────────────────────────────────────────────────────────────────

function QuickActionButton({
  icon: Icon,
  label,
  onClick,
  primary,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        primary
          ? "flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity cursor-pointer"
          : "flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))] transition-colors cursor-pointer"
      }
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}
