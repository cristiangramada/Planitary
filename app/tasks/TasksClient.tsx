"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { SortAsc, CheckSquare, PanelLeft, Undo2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { TaskCard } from "./TaskCard";
import { TaskQuickAdd } from "./TaskQuickAdd";
import { TaskDetailPanel } from "./TaskDetailPanel";
import { ListsPanel } from "./ListsPanel";
import { cn } from "@/utils/cn";
import { createClient } from "@/lib/supabase/client";
import {
  createTask,
  deleteTask,
  setTaskComplete,
  setSubtaskComplete,
  updateTaskTitleNotes,
  replaceTaskSubtasks,
  patchTaskFields,
  TASK_PRIORITY_ORDER,
} from "@/lib/tasks";
import type { TaskWithDetails, TaskList, Subtask, Priority } from "@/types";
import type { TaskFormData, SubtaskFormItem } from "@/lib/tasks";
import {
  createTaskList,
  renameTaskList,
  deleteTaskList,
  moveTaskToList,
  reorderTaskLists,
  computeListTaskCounts,
} from "@/lib/task-lists";
import type { MoveToListOption } from "@/app/calendar/AgendaItemContextMenu";
import { parseTasksScope, buildTasksScopeParams, type TasksScope } from "@/lib/tasks-url-state";
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
  initialLists: TaskList[];
  userId: string;
}

export function TasksClient({ initialTasks, initialLists, userId }: TasksClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState<TaskWithDetails[]>(initialTasks);
  const [lists, setLists] = useState<TaskList[]>(initialLists);
  // Default matches SSR; restored preference applied after mount to avoid hydration mismatch.
  const [sortBy, setSortBy] = useState<SortKey>("priority");
  const [sortReady, setSortReady] = useState(false);
  const [filterBy, setFilterBy] = useState<FilterKey>("active");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileListsOpen, setMobileListsOpen] = useState(false);
  const [deletedToast, setDeletedToast] = useState<{ taskId: string } | null>(null);
  const pendingDeleteRef = useRef<{
    task: TaskWithDetails;
    index: number;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);

  // ---------------------------------------------------------------------------
  // Lists / scope — the selected smart view or custom List, driven by the URL
  // (?list=<uuid> / ?view=inbox) so refresh and browser back/forward work.
  // ---------------------------------------------------------------------------

  const ownedListIds = useMemo(() => new Set(lists.map((l) => l.id)), [lists]);
  const scope = useMemo<TasksScope>(
    () => parseTasksScope(searchParams, ownedListIds),
    [searchParams, ownedListIds]
  );

  const selectScope = useCallback(
    (next: TasksScope) => {
      const qs = buildTasksScopeParams(next).toString();
      router.push(qs ? `/tasks?${qs}` : "/tasks", { scroll: false });
      setMobileListsOpen(false);
      setSelectedTaskId(null);
    },
    [router]
  );

  const listTaskCounts = useMemo(() => computeListTaskCounts(tasks), [tasks]);

  const moveToListOptions = useMemo<MoveToListOption[]>(
    () => [
      { id: null, name: "Inbox" },
      ...lists.map((l) => ({
        id: l.id,
        name: l.name,
      })),
    ],
    [lists]
  );

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
    /* eslint-disable react-hooks/set-state-in-effect -- open the deep-linked task's detail panel once, from a URL navigation */
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      setSelectedTaskId(task.id);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    router.replace("/tasks", { scroll: false });
  }, [searchParams, tasks, router]);

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  // Tasks within the selected smart view / List — applied before the
  // existing sort and status tabs, which are preserved unchanged and simply
  // operate on this narrower set.
  const scopedTasks = useMemo(() => {
    if (scope.type === "list") return tasks.filter((t) => t.list_id === scope.id);
    if (scope.type === "inbox") return tasks.filter((t) => t.list_id === null);
    return tasks;
  }, [tasks, scope]);

  const { activeTasks, overdueTasks, completedTasks } = useMemo(() => {
    const today = localTodayStr();
    const sorted = sortTasks(scopedTasks, sortBy);
    const active = sorted.filter((t) => t.status === "active");
    return {
      activeTasks: active,
      overdueTasks: active.filter((t) => !!t.due_date && t.due_date < today),
      completedTasks: sorted.filter((t) => t.status === "completed"),
    };
  }, [scopedTasks, sortBy]);

  const selectedList = scope.type === "list" ? lists.find((l) => l.id === scope.id) ?? null : null;
  const scopeTitle =
    scope.type === "inbox" ? "Inbox" : scope.type === "list" ? (selectedList?.name ?? "List") : "My Tasks";

  const selectedTask = selectedTaskId
    ? tasks.find((t) => t.id === selectedTaskId) ?? null
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
    async (data: TaskFormData, subtasks: SubtaskFormItem[]) => {
      const supabase = createClient();
      const userId = await getUserId();
      const newTask = await createTask(supabase, userId, data, subtasks);
      setTasks((prev) => [newTask, ...prev]);
    },
    [getUserId]
  );

  const commitPendingDelete = useCallback(async () => {
    const pending = pendingDeleteRef.current;
    if (!pending) return;
    pendingDeleteRef.current = null;
    clearTimeout(pending.timer);
    setDeletedToast((prev) => (prev?.taskId === pending.task.id ? null : prev));
    try {
      const supabase = createClient();
      await deleteTask(supabase, pending.task.id);
    } catch (err) {
      // Restore if the permanent delete fails.
      setTasks((prev) =>
        prev.some((t) => t.id === pending.task.id) ? prev : [...prev, pending.task]
      );
      setError(err instanceof Error ? err.message : "Failed to delete task.");
    }
  }, []);

  const handleDelete = useCallback(
    (taskId: string) => {
      const index = tasks.findIndex((t) => t.id === taskId);
      const task = index >= 0 ? tasks[index] : undefined;
      if (!task) return;

      // Commit any previous pending delete before starting a new one.
      if (pendingDeleteRef.current) {
        void commitPendingDelete();
      }

      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      setSelectedTaskId((prev) => (prev === taskId ? null : prev));
      setDeletedToast({ taskId });

      const timer = setTimeout(() => {
        void commitPendingDelete();
      }, 6000);

      pendingDeleteRef.current = { task, index, timer };
    },
    [tasks, commitPendingDelete]
  );

  const handleUndoDelete = useCallback(() => {
    const pending = pendingDeleteRef.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingDeleteRef.current = null;
    setDeletedToast(null);
    setTasks((prev) => {
      if (prev.some((t) => t.id === pending.task.id)) return prev;
      const next = [...prev];
      next.splice(Math.min(pending.index, next.length), 0, pending.task);
      return next;
    });
  }, []);

  // Flush pending delete on unmount so it isn't lost.
  useEffect(() => {
    return () => {
      const pending = pendingDeleteRef.current;
      if (!pending) return;
      clearTimeout(pending.timer);
      pendingDeleteRef.current = null;
      const supabase = createClient();
      void deleteTask(supabase, pending.task.id);
    };
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

  function openDetail(task: TaskWithDetails) {
    setSelectedTaskId(task.id);
  }

  const handleSaveTitleNotes = useCallback(
    async (taskId: string, title: string, notes: string | null) => {
      const supabase = createClient();
      await updateTaskTitleNotes(supabase, taskId, title, notes);
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, title, notes } : t))
      );
    },
    []
  );

  const handleReplaceSubtasks = useCallback(
    async (taskId: string, subtasks: SubtaskFormItem[]): Promise<Subtask[]> => {
      const supabase = createClient();
      const uid = await getUserId();
      const saved = await replaceTaskSubtasks(supabase, taskId, uid, subtasks);
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, subtasks: saved } : t))
      );
      return saved;
    },
    [getUserId]
  );

  const handlePatchFields = useCallback(
    async (
      taskId: string,
      fields: Partial<Pick<TaskWithDetails, "priority" | "due_date" | "due_time">>
    ) => {
      const supabase = createClient();
      await patchTaskFields(supabase, taskId, fields);
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, ...fields } : t))
      );
    },
    []
  );

  const handleSetPriority = useCallback(
    async (taskId: string, priority: Priority) => {
      await handlePatchFields(taskId, { priority });
    },
    [handlePatchFields]
  );

  const handleSetDue = useCallback(
    async (taskId: string, date: string | null, time: string | null) => {
      await handlePatchFields(taskId, {
        due_date: date,
        due_time: date && time ? (time.length === 5 ? `${time}:00` : time) : null,
      });
    },
    [handlePatchFields]
  );

  // Creating a task from within a selected List auto-assigns it to that List;
  // Inbox and smart views default to Inbox (null), matching current behavior.
  const formDefaultListId = scope.type === "list" ? scope.id : null;

  // ---------------------------------------------------------------------------
  // List mutations
  // ---------------------------------------------------------------------------

  const handleCreateList = useCallback(
    async (name: string) => {
      const supabase = createClient();
      const newList = await createTaskList(supabase, userId, name, null, lists);
      setLists((prev) => [...prev, newList]);
      selectScope({ type: "list", id: newList.id });
    },
    [userId, lists, selectScope]
  );

  const handleRenameList = useCallback(
    async (listId: string, name: string) => {
      const supabase = createClient();
      const updated = await renameTaskList(supabase, listId, name, lists);
      setLists((prev) => prev.map((l) => (l.id === listId ? updated : l)));
      setTasks((prev) =>
        prev.map((t) =>
          t.list_id === listId && t.list ? { ...t, list: { ...t.list, name: updated.name } } : t
        )
      );
    },
    [lists]
  );

  const handleDeleteList = useCallback(
    async (listId: string) => {
      try {
        const supabase = createClient();
        await deleteTaskList(supabase, listId);
        setLists((prev) => prev.filter((l) => l.id !== listId));
        // The DB's `on delete set null` already unassigned these tasks server-side;
        // mirror that locally so the UI doesn't need a refetch.
        setTasks((prev) =>
          prev.map((t) => (t.list_id === listId ? { ...t, list_id: null, list: null } : t))
        );
        if (scope.type === "list" && scope.id === listId) {
          selectScope({ type: "inbox" });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't delete the list.");
      }
    },
    [scope, selectScope]
  );

  const handleReorderLists = useCallback(
    async (orderedIds: string[]) => {
      const previous = lists;
      const byId = new Map(lists.map((l) => [l.id, l]));
      const next = orderedIds
        .map((id, position) => {
          const list = byId.get(id);
          return list ? { ...list, position } : null;
        })
        .filter((l): l is TaskList => l !== null);
      setLists(next);
      try {
        const supabase = createClient();
        await reorderTaskLists(supabase, orderedIds);
      } catch (err) {
        setLists(previous);
        setError(err instanceof Error ? err.message : "Couldn't reorder lists.");
      }
    },
    [lists]
  );

  const handleMoveTask = useCallback(
    async (taskId: string, listId: string | null) => {
      const previous = tasks.find((t) => t.id === taskId);
      if (!previous) return;
      const nextList = listId ? lists.find((l) => l.id === listId) ?? null : null;
      // Optimistic update
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                list_id: listId,
                list: nextList
                  ? { id: nextList.id, name: nextList.name, color: nextList.color, icon: nextList.icon }
                  : null,
              }
            : t
        )
      );
      try {
        const supabase = createClient();
        await moveTaskToList(supabase, taskId, listId);
      } catch (err) {
        // Revert
        setTasks((prev) => prev.map((t) => (t.id === taskId ? previous : t)));
        setError(err instanceof Error ? err.message : "Couldn't move the task.");
      }
    },
    [tasks, lists]
  );

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
      count: scopedTasks.length,
    },
    { key: "active", label: "Active", count: activeTasks.length },
    { key: "overdue", label: "Overdue", count: overdueTasks.length },
    { key: "completed", label: "Completed", count: completedTasks.length },
  ];

  return (
    <AppShell flushTop>
      <div className="h-full flex gap-6 w-full pt-4">
        {/* Desktop Lists panel — extends the Tasks page's own sub-navigation
            rather than adding a second global sidebar. */}
        <aside className="hidden lg:block w-[240px] shrink-0 pr-5 border-r border-[hsl(var(--border))] overflow-y-auto">
          <ListsPanel
            scope={scope}
            onSelectScope={selectScope}
            lists={lists}
            counts={listTaskCounts}
            onCreateList={handleCreateList}
            onRenameList={handleRenameList}
            onDeleteList={handleDeleteList}
            onReorderLists={handleReorderLists}
          />
        </aside>

        {/* Mobile Lists drawer */}
        {mobileListsOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              onClick={() => setMobileListsOpen(false)}
            />
            <div className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-[hsl(var(--background))] border-r border-[hsl(var(--border))] shadow-2xl p-4 overflow-y-auto lg:hidden">
              <ListsPanel
                scope={scope}
                onSelectScope={selectScope}
                lists={lists}
                counts={listTaskCounts}
                onCreateList={handleCreateList}
                onRenameList={handleRenameList}
                onDeleteList={handleDeleteList}
                onReorderLists={handleReorderLists}
                onRequestClose={() => setMobileListsOpen(false)}
              />
            </div>
          </>
        )}

      <div className="w-full max-w-3xl shrink-0 min-w-0 flex flex-col">
        {/* Page header */}
        <div className="flex items-center justify-between mb-5 shrink-0">
          <div>
            <button
              type="button"
              onClick={() => setMobileListsOpen(true)}
              className="flex items-center gap-1.5 mb-1 text-xs font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer lg:hidden"
            >
              <PanelLeft className="w-3.5 h-3.5" />
              Lists
            </button>
            <h2 className="text-xl font-bold">{scopeTitle}</h2>
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
                "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors text-[hsl(var(--foreground))]",
                filterBy === key
                  ? "bg-[hsl(var(--background))] shadow-sm cursor-default"
                  : "cursor-pointer"
              )}
            >
              {label}
              {count !== undefined && count > 0 && (
                <span
                  className={cn(
                    "text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center text-[hsl(var(--foreground))]",
                    filterBy === key
                      ? "bg-[hsl(var(--muted))]"
                      : "bg-[hsl(var(--border))]"
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

        <TaskQuickAdd
          defaultListId={formDefaultListId}
          onCreate={async (data) => {
            await handleCreate(data, []);
          }}
        />

        {/* Active tasks */}
        {filterBy !== "completed" && (
          <div className="space-y-2 mb-4">
            {scopedTasks.length > 0 &&
              visibleActive.length === 0 &&
              filterBy === "active" && (
              <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                <EmptyState
                  icon={CheckSquare}
                  title="No active tasks"
                  description="All caught up!"
                />
              </div>
            )}

            {scopedTasks.length > 0 &&
              visibleActive.length === 0 &&
              filterBy === "overdue" && (
              <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                <EmptyState
                  icon={CheckSquare}
                  title="No overdue tasks"
                  description="You're all caught up — nothing past due."
                />
              </div>
            )}

            {/* Empty state — either the account's very first task, or an empty List/Inbox */}
            {scopedTasks.length === 0 && (
              <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                <EmptyState
                  icon={CheckSquare}
                  title={
                    scope.type === "inbox"
                      ? "No tasks in Inbox."
                      : scope.type === "list"
                        ? "No tasks in this list."
                        : "No tasks yet"
                  }
                  description={
                    scope.type === "all"
                      ? "Use Add task above to start tracking what you need to accomplish."
                      : "Use Add task above to get started."
                  }
                />
              </div>
            )}

            {visibleActive.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onDelete={handleDelete}
                onToggleComplete={handleToggleComplete}
                onRenameTitle={async (taskId, title) => {
                  const current = tasks.find((t) => t.id === taskId);
                  await handleSaveTitleNotes(taskId, title, current?.notes ?? null);
                }}
                onSetPriority={handleSetPriority}
                onSetDue={handleSetDue}
                onSelect={openDetail}
                selected={selectedTaskId === task.id}
                lists={moveToListOptions}
                onMoveToList={handleMoveTask}
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
                  onDelete={handleDelete}
                  onToggleComplete={handleToggleComplete}
                  onRenameTitle={async (taskId, title) => {
                    const current = tasks.find((t) => t.id === taskId);
                    await handleSaveTitleNotes(taskId, title, current?.notes ?? null);
                  }}
                  onSetPriority={handleSetPriority}
                  onSetDue={handleSetDue}
                  onSelect={openDetail}
                  selected={selectedTaskId === task.id}
                  lists={moveToListOptions}
                  onMoveToList={handleMoveTask}
                />
              ))}
            </div>
          </div>
        )}

        </div>{/* end scrollable list */}
      </div>{/* end main content column */}

      {/* Desktop right detail column — fills remaining width to the right edge */}
      <aside className="hidden md:flex flex-1 min-w-0 border-l border-[hsl(var(--border))] -my-4 -mr-6 self-stretch min-h-0">
        {selectedTask ? (
          <div className="flex-1 min-h-0 overflow-hidden">
            <TaskDetailPanel
              key={selectedTask.id}
              task={selectedTask}
              onSaveTitleNotes={handleSaveTitleNotes}
              onReplaceSubtasks={handleReplaceSubtasks}
              onToggleSubtask={handleToggleSubtask}
              onPatchFields={handlePatchFields}
            />
          </div>
        ) : null}
      </aside>

      {/* Mobile detail panel */}
      {selectedTask && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[hsl(var(--background))] border-l border-[hsl(var(--border))] shadow-2xl md:hidden">
          <TaskDetailPanel
            key={selectedTask.id}
            task={selectedTask}
            onSaveTitleNotes={handleSaveTitleNotes}
            onReplaceSubtasks={handleReplaceSubtasks}
            onToggleSubtask={handleToggleSubtask}
            onPatchFields={handlePatchFields}
          />
        </div>
      )}
      </div>{/* end Lists panel + main content row */}

      {deletedToast &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="status"
            aria-live="polite"
            className="fixed inset-x-0 bottom-10 z-[100] flex justify-center pointer-events-none"
          >
            <button
              type="button"
              title="Undo"
              aria-label="Undo delete"
              onClick={handleUndoDelete}
              className="toast-slide-up pointer-events-auto inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3 shadow-2xl cursor-pointer"
            >
              <span className="text-sm font-medium leading-none text-[hsl(var(--foreground))]">
                Task deleted
              </span>
              <Undo2 className="size-4 shrink-0 text-[hsl(var(--foreground))]" aria-hidden />
            </button>
          </div>,
          document.body
        )}
    </AppShell>
  );
}
