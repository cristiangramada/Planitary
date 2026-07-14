"use client";

import { useState, useMemo, useCallback } from "react";
import { Plus, ChevronDown, ChevronRight, SortAsc, CheckSquare } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { TaskCard } from "./TaskCard";
import { TaskForm } from "./TaskForm";
import { cn } from "@/utils/cn";
import { createClient } from "@/lib/supabase/client";
import {
  createTask,
  updateTask,
  deleteTask,
  setTaskComplete,
  setSubtaskComplete,
} from "@/lib/tasks";
import type { TaskWithDetails, Tag } from "@/types";
import type { TaskFormData, SubtaskFormItem, TagFormItem } from "@/lib/tasks";

// ---------------------------------------------------------------------------
// Sorting helpers
// ---------------------------------------------------------------------------

type SortKey = "priority" | "due_date" | "created_at";
type FilterKey = "all" | "active" | "completed";

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

function compareDueDateTime(a: TaskWithDetails, b: TaskWithDetails): number {
  if (a.due_date && b.due_date) {
    const d = a.due_date.localeCompare(b.due_date);
    if (d !== 0) return d;
    const t = (a.due_time ?? "").localeCompare(b.due_time ?? "");
    if (t !== 0) return t;
    return 0;
  }
  if (a.due_date && !b.due_date) return -1;
  if (!a.due_date && b.due_date) return 1;
  return 0;
}

function sortTasks(tasks: TaskWithDetails[], sortBy: SortKey): TaskWithDetails[] {
  return [...tasks].sort((a, b) => {
    if (sortBy === "priority") {
      const diff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (diff !== 0) return diff;
    }
    if (sortBy === "due_date" || sortBy === "priority") {
      const dueDiff = compareDueDateTime(a, b);
      if (dueDiff !== 0) return dueDiff;
      if (sortBy === "due_date") {
        const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        if (p !== 0) return p;
      }
    }
    // Newest first by default
    return b.created_at.localeCompare(a.created_at);
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TasksClientProps {
  initialTasks: TaskWithDetails[];
  initialTags: Tag[];
}

export function TasksClient({ initialTasks, initialTags }: TasksClientProps) {
  const [tasks, setTasks] = useState<TaskWithDetails[]>(initialTasks);
  const [allTags, setAllTags] = useState<Tag[]>(initialTags);
  const [sortBy, setSortBy] = useState<SortKey>("priority");
  const [filterBy, setFilterBy] = useState<FilterKey>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithDetails | null>(null);
  const [completedExpanded, setCompletedExpanded] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const { activeTasks, completedTasks } = useMemo(() => {
    const sorted = sortTasks(tasks, sortBy);
    return {
      activeTasks: sorted.filter((t) => t.status === "active"),
      completedTasks: sorted.filter((t) => t.status === "completed"),
    };
  }, [tasks, sortBy]);

  const visibleActive =
    filterBy === "completed" ? [] : activeTasks;
  const visibleCompleted =
    filterBy === "active" ? [] : completedTasks;

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  const getUserId = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw new Error("Not signed in");
    return data.user.id;
  }, []);

  const handleCreate = useCallback(
    async (data: TaskFormData, subtasks: SubtaskFormItem[], tags: TagFormItem[]) => {
      const supabase = createClient();
      const userId = await getUserId();
      const newTask = await createTask(supabase, userId, data, subtasks, tags);
      setTasks((prev) => [newTask, ...prev]);
      // Sync any newly created tags into allTags
      newTask.tags.forEach((tag) => {
        setAllTags((prev) =>
          prev.some((t) => t.id === tag.id) ? prev : [...prev, tag]
        );
      });
      setFormOpen(false);
      setEditingTask(null);
    },
    [getUserId]
  );

  const handleUpdate = useCallback(
    async (data: TaskFormData, subtasks: SubtaskFormItem[], tags: TagFormItem[]) => {
      if (!editingTask) return;
      const supabase = createClient();
      const userId = await getUserId();
      const updated = await updateTask(supabase, editingTask.id, userId, data, subtasks, tags);
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      updated.tags.forEach((tag) => {
        setAllTags((prev) =>
          prev.some((t) => t.id === tag.id) ? prev : [...prev, tag]
        );
      });
      setFormOpen(false);
      setEditingTask(null);
    },
    [editingTask, getUserId]
  );

  const handleSave = useCallback(
    (data: TaskFormData, subtasks: SubtaskFormItem[], tags: TagFormItem[]) => {
      if (editingTask) return handleUpdate(data, subtasks, tags);
      return handleCreate(data, subtasks, tags);
    },
    [editingTask, handleCreate, handleUpdate]
  );

  const handleDelete = useCallback(async (taskId: string) => {
    try {
      const supabase = createClient();
      await deleteTask(supabase, taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete task.");
    }
  }, []);

  const handleToggleComplete = useCallback(
    async (taskId: string, shouldComplete: boolean) => {
      // Optimistic update
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: shouldComplete ? "completed" : "active",
                completed_at: shouldComplete ? new Date().toISOString() : null,
              }
            : t
        )
      );
      try {
        const supabase = createClient();
        const result = await setTaskComplete(supabase, taskId, shouldComplete);
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, ...result } : t))
        );
        if (shouldComplete) setCompletedExpanded(true);
      } catch (err) {
        // Revert
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  status: shouldComplete ? "active" : "completed",
                  completed_at: null,
                }
              : t
          )
        );
        setError(err instanceof Error ? err.message : "Failed to update task.");
      }
    },
    []
  );

  const handleToggleSubtask = useCallback(
    async (taskId: string, subtaskId: string, completed: boolean) => {
      // Optimistic update
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                subtasks: t.subtasks.map((s) =>
                  s.id === subtaskId ? { ...s, is_completed: completed } : s
                ),
              }
            : t
        )
      );
      try {
        const supabase = createClient();
        await setSubtaskComplete(supabase, subtaskId, completed);
      } catch (err) {
        // Revert
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  subtasks: t.subtasks.map((s) =>
                    s.id === subtaskId ? { ...s, is_completed: !completed } : s
                  ),
                }
              : t
          )
        );
        setError(err instanceof Error ? err.message : "Failed to update subtask.");
      }
    },
    []
  );

  function openCreate() {
    setEditingTask(null);
    setFormOpen(true);
  }

  function openEdit(task: TaskWithDetails) {
    setEditingTask(task);
    setFormOpen(true);
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const SORT_LABELS: Record<SortKey, string> = {
    priority: "Priority",
    due_date: "Due date",
    created_at: "Created date",
  };

  const FILTER_TABS: { key: FilterKey; label: string; count?: number }[] = [
    { key: "all", label: "All", count: tasks.length },
    { key: "active", label: "Active", count: activeTasks.length },
    { key: "completed", label: "Completed", count: completedTasks.length },
  ];

  return (
    <AppShell title="Tasks">
      <div className="h-full flex flex-col max-w-3xl mx-auto">
        {/* Page header */}
        <div className="flex items-center justify-between mb-5 shrink-0">
          <div>
            <h2 className="text-xl font-bold">My Tasks</h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
              {activeTasks.length} active · {completedTasks.length} completed
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Sort dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowSortMenu((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer"
              >
                <SortAsc className="w-3.5 h-3.5" />
                {SORT_LABELS[sortBy]}
              </button>
              {showSortMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowSortMenu(false)}
                  />
                  <div className="absolute right-0 z-20 mt-1 w-36 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-lg py-1">
                    {(Object.entries(SORT_LABELS) as [SortKey, string][]).map(
                      ([key, label]) => (
                        <button
                          key={key}
                          onClick={() => {
                            setSortBy(key);
                            setShowSortMenu(false);
                          }}
                          className={cn(
                            "w-full px-3 py-1.5 text-xs text-left hover:bg-[hsl(var(--muted))] transition-colors",
                            sortBy === key
                              ? "text-[hsl(var(--primary))] font-medium cursor-default"
                              : "text-[hsl(var(--foreground))] cursor-pointer"
                          )}
                        >
                          {label}
                        </button>
                      )
                    )}
                  </div>
                </>
              )}
            </div>

            {/* New task */}
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              New task
            </button>
          </div>
        </div>

        {/* Global error */}
        {error && (
          <div className="mb-4 shrink-0 px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/10 text-sm text-red-500">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 underline text-xs cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-1 p-1 rounded-lg bg-[hsl(var(--muted))] mb-5 w-fit shrink-0">
          {FILTER_TABS.map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setFilterBy(key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                filterBy === key
                  ? "bg-[hsl(var(--background))] text-[hsl(var(--foreground))] shadow-sm cursor-default"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] cursor-pointer"
              )}
            >
              {label}
              {count !== undefined && count > 0 && (
                <span
                  className={cn(
                    "text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
                    filterBy === key
                      ? "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
                      : "bg-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]"
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Scrollable task list */}
        <div className="flex-1 overflow-y-auto min-h-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

        {/* Active tasks */}
        {filterBy !== "completed" && (
          <div className="space-y-2 mb-4">
            {visibleActive.length === 0 && filterBy !== "all" && (
              <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                <EmptyState
                  icon={CheckSquare}
                  title="No active tasks"
                  description="All caught up! Create a new task to get started."
                  action={
                    <button
                      onClick={openCreate}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      New task
                    </button>
                  }
                />
              </div>
            )}

            {/* Empty state for very first task */}
            {tasks.length === 0 && (
              <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                <EmptyState
                  icon={CheckSquare}
                  title="No tasks yet"
                  description="Add your first task to start tracking what you need to accomplish."
                  action={
                    <button
                      onClick={openCreate}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      Add a task
                    </button>
                  }
                />
              </div>
            )}

            {visibleActive.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onEdit={openEdit}
                onDelete={handleDelete}
                onToggleComplete={handleToggleComplete}
                onToggleSubtask={handleToggleSubtask}
              />
            ))}
          </div>
        )}

        {/* Completed section */}
        {filterBy !== "active" && visibleCompleted.length > 0 && (
          <div>
            <button
              onClick={() => setCompletedExpanded((v) => !v)}
              className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors mb-3 cursor-pointer"
            >
              {completedExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              Completed ({visibleCompleted.length})
            </button>

            {completedExpanded && (
              <div className="space-y-2">
                {visibleCompleted.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                    onToggleComplete={handleToggleComplete}
                    onToggleSubtask={handleToggleSubtask}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        </div>{/* end scrollable list */}
      </div>

      {/* Task form drawer */}
      <TaskForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingTask(null);
        }}
        onSave={handleSave}
        editTask={editingTask}
        allTags={allTags}
      />
    </AppShell>
  );
}
