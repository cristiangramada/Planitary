"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, SortAsc, CheckSquare, Tag as TagIcon } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { TagBadge } from "@/components/ui/TagBadge";
import { TaskCard } from "./TaskCard";
import { TaskForm } from "./TaskForm";
import { cn } from "@/utils/cn";
import { createClient } from "@/lib/supabase/client";
import {
  createTask,
  updateTask,
  deleteTask,
  deleteTag,
  setTaskComplete,
  setSubtaskComplete,
  TASK_PRIORITY_ORDER,
} from "@/lib/tasks";
import type { TaskWithDetails, Tag } from "@/types";
import type { TaskFormData, SubtaskFormItem, TagFormItem } from "@/lib/tasks";
import { localTodayStr } from "@/utils/date";
import {
  readTasksSortPreference,
  writeTasksSortPreference,
  type TasksSortKey,
} from "@/lib/tasks-sort-preference";

// ---------------------------------------------------------------------------
// Sorting helpers
// ---------------------------------------------------------------------------

type SortKey = TasksSortKey;
type FilterKey = "all" | "active" | "overdue" | "completed";

const PRIORITY_ORDER = TASK_PRIORITY_ORDER;

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
    if (sortBy === "created_oldest") {
      return a.created_at.localeCompare(b.created_at);
    }
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
    // Newest first by default (also used for "Created date")
    return b.created_at.localeCompare(a.created_at);
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TasksClientProps {
  initialTasks: TaskWithDetails[];
  initialTags: Tag[];
  userId: string;
}

export function TasksClient({ initialTasks, initialTags, userId }: TasksClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState<TaskWithDetails[]>(initialTasks);
  const [allTags, setAllTags] = useState<Tag[]>(initialTags);
  // Default matches SSR; restored preference applied after mount to avoid hydration mismatch.
  const [sortBy, setSortBy] = useState<SortKey>("priority");
  const [sortReady, setSortReady] = useState(false);
  const [filterBy, setFilterBy] = useState<FilterKey>("active");
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [confirmingTag, setConfirmingTag] = useState<Tag | null>(null);
  const [confirmPos, setConfirmPos] = useState<{ top: number; left: number } | null>(null);
  const [deletingTag, setDeletingTag] = useState(false);
  const confirmRef = useRef<HTMLDivElement>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithDetails | null>(null);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Per-account sort preference (localStorage) — restore after mount, then persist.
  // ---------------------------------------------------------------------------

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- hydrate sort preference from localStorage after mount */
    const saved = readTasksSortPreference(userId);
    if (saved) setSortBy(saved);
    setSortReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [userId]);

  useEffect(() => {
    if (!sortReady) return;
    writeTasksSortPreference(userId, sortBy);
  }, [userId, sortBy, sortReady]);

  // ---------------------------------------------------------------------------
  // Deep-link support: /tasks?task=<id> (e.g. from a Search result) opens
  // that task's editor, then clears the param so it doesn't reopen.
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const taskId = searchParams.get("task");
    if (!taskId) return;
    /* eslint-disable react-hooks/set-state-in-effect -- open the deep-linked task's editor once, from a URL navigation */
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      setEditingTask(task);
      setFormOpen(true);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    router.replace("/tasks", { scroll: false });
  }, [searchParams, tasks, router]);

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const sortedTags = useMemo(
    () => [...allTags].sort((a, b) => a.name.localeCompare(b.name)),
    [allTags]
  );

  const { activeTasks, overdueTasks, completedTasks } = useMemo(() => {
    const today = localTodayStr();
    const scoped = selectedTagId
      ? tasks.filter((t) => t.tags.some((tag) => tag.id === selectedTagId))
      : tasks;
    const sorted = sortTasks(scoped, sortBy);
    const active = sorted.filter((t) => t.status === "active");
    return {
      activeTasks: active,
      overdueTasks: active.filter((t) => !!t.due_date && t.due_date < today),
      completedTasks: sorted.filter((t) => t.status === "completed"),
    };
  }, [tasks, sortBy, selectedTagId]);

  const selectedTag = selectedTagId
    ? allTags.find((t) => t.id === selectedTagId) ?? null
    : null;

  const visibleActive =
    filterBy === "completed"
      ? []
      : filterBy === "overdue"
        ? overdueTasks
        : activeTasks;
  const visibleCompleted =
    filterBy === "active" || filterBy === "overdue" ? [] : completedTasks;

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
    setSelectedTagId((prev) => (prev === tagId ? null : prev));
  }, []);

  const closeTagConfirm = useCallback(() => {
    setConfirmingTag(null);
    setConfirmPos(null);
  }, []);

  const openTagDeleteConfirm = useCallback((tag: Tag, e: React.MouseEvent) => {
    e.preventDefault();
    const width = 224;
    const height = 110;
    let top = e.clientY + 8;
    if (top + height > window.innerHeight - 8) {
      top = Math.max(8, e.clientY - height - 8);
    }
    let left = e.clientX;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    setConfirmPos({ top, left });
    setConfirmingTag(tag);
  }, []);

  const confirmDeleteTagFromList = useCallback(async () => {
    if (!confirmingTag || deletingTag) return;
    setDeletingTag(true);
    try {
      await handleDeleteTag(confirmingTag.id);
      closeTagConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete tag.");
      closeTagConfirm();
    } finally {
      setDeletingTag(false);
    }
  }, [confirmingTag, deletingTag, handleDeleteTag, closeTagConfirm]);

  // Close tag delete confirm on outside click, Escape, or scroll
  useEffect(() => {
    if (!confirmingTag) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeTagConfirm();
    }
    function onOutside(e: MouseEvent) {
      if (confirmRef.current?.contains(e.target as Node)) return;
      closeTagConfirm();
    }
    function onScroll() {
      closeTagConfirm();
    }
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onOutside);
    window.addEventListener("scroll", onScroll, { capture: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onOutside);
      window.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, [confirmingTag, closeTagConfirm]);

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
    created_at: "Newest first",
    created_oldest: "Oldest first",
  };

  const FILTER_TABS: { key: FilterKey; label: string; count?: number }[] = [
    {
      key: "all",
      label: "All",
      count: selectedTagId ? activeTasks.length + completedTasks.length : tasks.length,
    },
    { key: "active", label: "Active", count: activeTasks.length },
    { key: "overdue", label: "Overdue", count: overdueTasks.length },
    { key: "completed", label: "Completed", count: completedTasks.length },
  ];

  return (
    <AppShell flushTop>
      <div className="h-full flex flex-col max-w-3xl mx-auto pt-4">
        {/* Page header */}
        <div className="flex items-center justify-between mb-5 shrink-0">
          <div>
            <h2 className="text-xl font-bold">My Tasks</h2>
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
                  <div className="absolute right-0 z-20 mt-1 w-36 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-lg overflow-hidden">
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
        <div className="flex gap-1 p-1 rounded-lg bg-[hsl(var(--muted))] mb-4 w-fit shrink-0">
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

        {/* Tag filters */}
        {sortedTags.length > 0 && (
          <div className="mb-5 shrink-0">
            <div className="flex items-center gap-1.5 mb-2">
              <TagIcon className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
              <p className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                Tags
              </p>
              {selectedTag && (
                <button
                  type="button"
                  onClick={() => setSelectedTagId(null)}
                  className="ml-auto text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {sortedTags.map((tag) => (
                <TagBadge
                  key={tag.id}
                  tag={tag}
                  selected={selectedTagId === tag.id}
                  onClick={() =>
                    setSelectedTagId((prev) => (prev === tag.id ? null : tag.id))
                  }
                  onContextMenu={(e) => openTagDeleteConfirm(tag, e)}
                />
              ))}
            </div>
          </div>
        )}

        {confirmingTag &&
          confirmPos &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              ref={confirmRef}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-tag-list-title"
              style={{
                position: "fixed",
                top: confirmPos.top,
                left: confirmPos.left,
                zIndex: 9999,
              }}
              className="w-56 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-xl p-3"
            >
              <p id="delete-tag-list-title" className="text-sm font-medium mb-1">
                Delete tag &ldquo;{confirmingTag.name}&rdquo;?
              </p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3">
                It will be removed from all tasks.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    closeTagConfirm();
                  }}
                  className="flex-1 py-1.5 text-xs font-medium rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deletingTag}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    void confirmDeleteTagFromList();
                  }}
                  className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-60 transition-colors cursor-pointer"
                >
                  {deletingTag ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>,
            document.body
          )}
        {/* Scrollable task list */}
        <div className="flex-1 overflow-y-auto min-h-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

        {/* Active tasks */}
        {filterBy !== "completed" && (
          <div className="space-y-2 mb-4">
            {selectedTag &&
              activeTasks.length === 0 &&
              completedTasks.length === 0 && (
              <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                <EmptyState
                  icon={TagIcon}
                  title={`No tasks with “${selectedTag.name}”`}
                  description="Try another tag, or clear the filter to see all tasks."
                  action={
                    <button
                      onClick={() => setSelectedTagId(null)}
                      className="px-4 py-2 text-sm font-medium rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer"
                    >
                      Clear tag filter
                    </button>
                  }
                />
              </div>
            )}

            {visibleActive.length === 0 &&
              filterBy === "active" &&
              !(selectedTag && activeTasks.length === 0 && completedTasks.length === 0) && (
              <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                <EmptyState
                  icon={CheckSquare}
                  title={selectedTag ? `No active tasks with “${selectedTag.name}”` : "No active tasks"}
                  description={
                    selectedTag
                      ? "There are no active tasks with this tag."
                      : "All caught up! Create a new task to get started."
                  }
                  action={
                    selectedTag ? (
                      <button
                        onClick={() => setSelectedTagId(null)}
                        className="px-4 py-2 text-sm font-medium rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer"
                      >
                        Clear tag filter
                      </button>
                    ) : (
                      <button
                        onClick={openCreate}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        New task
                      </button>
                    )
                  }
                />
              </div>
            )}

            {visibleActive.length === 0 &&
              filterBy === "overdue" &&
              !(selectedTag && activeTasks.length === 0 && completedTasks.length === 0) && (
              <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                <EmptyState
                  icon={CheckSquare}
                  title={selectedTag ? `No overdue tasks with “${selectedTag.name}”` : "No overdue tasks"}
                  description={
                    selectedTag
                      ? "There are no overdue tasks with this tag."
                      : "You're all caught up — nothing past due."
                  }
                  action={
                    selectedTag ? (
                      <button
                        onClick={() => setSelectedTagId(null)}
                        className="px-4 py-2 text-sm font-medium rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer"
                      >
                        Clear tag filter
                      </button>
                    ) : undefined
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
        {filterBy !== "active" && filterBy !== "overdue" && visibleCompleted.length > 0 && (
          <div>
            {filterBy === "all" && (
              <h3 className="text-sm font-medium text-[hsl(var(--muted-foreground))] mb-3">
                Completed ({visibleCompleted.length})
              </h3>
            )}
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
        onDeleteTag={handleDeleteTag}
        editTask={editingTask}
        allTags={allTags}
      />
    </AppShell>
  );
}
