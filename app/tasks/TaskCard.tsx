"use client";

import { useState, useRef, useEffect } from "react";
import { Pencil, Trash2, Calendar, Clock } from "lucide-react";
import { cn } from "@/utils/cn";
import { TagBadge } from "@/components/ui/TagBadge";
import { AgendaItemContextMenu, type MoveToListOption } from "@/app/calendar/AgendaItemContextMenu";
import { relativeDate, formatDate, parseDateOnly } from "@/utils/date";
import { formatTimeValue } from "@/components/ui/TimeDropdown";
import type { Priority, TaskWithDetails } from "@/types";

interface TaskCardProps {
  task: TaskWithDetails;
  onEdit: (task: TaskWithDetails) => void;
  onDelete: (taskId: string) => void;
  onToggleComplete: (taskId: string, completed: boolean) => void;
  /** Left-click opens the right-side detail panel. */
  onSelect?: (task: TaskWithDetails) => void;
  selected?: boolean;
  /** Move-to-list options (Inbox + user's lists) for the context menu. Omit to hide the option. */
  lists?: MoveToListOption[];
  onMoveToList?: (taskId: string, listId: string | null) => void;
}

const CHECK_IDLE: Record<Priority, string> = {
  high: "border-red-500 hover:border-red-600",
  medium: "border-amber-500 hover:border-amber-600",
  low: "border-green-600 dark:border-green-500 hover:border-green-700 dark:hover:border-green-400",
  none: "border-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--foreground))]",
};

const CHECK_DONE: Record<Priority, string> = {
  high: "border-red-500 bg-red-500",
  medium: "border-amber-500 bg-amber-500",
  low: "border-green-600 dark:border-green-500 bg-green-600 dark:bg-green-500",
  none: "border-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted-foreground))]",
};

export function TaskCard({
  task,
  onEdit,
  onDelete,
  onToggleComplete,
  onSelect,
  selected = false,
  lists,
  onMoveToList,
}: TaskCardProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const confirmRef = useRef<HTMLDivElement>(null);

  // Close confirmation on outside click or Escape
  useEffect(() => {
    if (!confirmingDelete) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setConfirmingDelete(false);
    }
    function onOutside(e: MouseEvent) {
      if (confirmRef.current && !confirmRef.current.contains(e.target as Node)) {
        setConfirmingDelete(false);
      }
    }
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onOutside);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onOutside);
    };
  }, [confirmingDelete]);

  const isCompleted = task.status === "completed";
  const hasDue = !!task.due_date;
  const dueDateStr = hasDue ? formatDate(task.due_date!) : null;
  const isOverdue =
    !isCompleted &&
    hasDue &&
    parseDateOnly(task.due_date!) < new Date(new Date().toDateString());

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setConfirmingDelete(false);
    setContextMenu({ x: e.clientX, y: e.clientY });
  }

  return (
    <div
      onContextMenu={handleContextMenu}
      className={cn(
        "group rounded-xl border bg-[hsl(var(--card))] transition-colors",
        isCompleted
          ? "border-[hsl(var(--border))] opacity-70"
          : "border-[hsl(var(--border))] hover:border-[hsl(var(--primary)/0.4)]",
        selected && "border-[hsl(var(--primary)/0.55)] ring-1 ring-[hsl(var(--primary)/0.25)]"
      )}
    >
      {/* Main row */}
      <div className="flex items-start gap-3 p-4">
        {/* Checkbox — ring/fill follow priority */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleComplete(task.id, !isCompleted);
          }}
          aria-label={isCompleted ? "Reopen task" : "Complete task"}
          className="mt-0.5 shrink-0 cursor-pointer"
        >
          <span
            className={cn(
              "flex items-center justify-center w-5 h-5 rounded-full border-2 transition-colors",
              isCompleted ? CHECK_DONE[task.priority] : CHECK_IDLE[task.priority]
            )}
          >
            {isCompleted && (
              <svg
                className="w-2.5 h-2.5 text-white"
                viewBox="0 0 12 10"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="1 5 4.5 8.5 11 1" />
              </svg>
            )}
          </span>
        </button>

        {/* Content — left-click opens the detail panel */}
        <div
          role={onSelect ? "button" : undefined}
          tabIndex={onSelect ? 0 : undefined}
          onClick={() => onSelect?.(task)}
          onKeyDown={(e) => {
            if (!onSelect) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect(task);
            }
          }}
          className={cn(
            "flex-1 min-w-0 select-none",
            onSelect ? "cursor-pointer" : "cursor-default"
          )}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                "text-sm font-medium leading-snug",
                isCompleted && "line-through text-[hsl(var(--muted-foreground))]"
              )}
            >
              {task.title}
            </span>
          </div>

          {isCompleted && task.completed_at && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
              Completed {relativeDate(task.completed_at)}
            </p>
          )}

          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {task.list && (
              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                {task.list.name}
              </span>
            )}

            {hasDue && (
              <span
                className={cn(
                  "flex items-center gap-1 text-xs",
                  isOverdue
                    ? "text-red-500 font-medium"
                    : "text-[hsl(var(--muted-foreground))]"
                )}
              >
                <Calendar className="w-3 h-3" />
                {dueDateStr}
                {task.due_time && (
                  <span className="flex items-center gap-0.5">
                    <Clock className="w-3 h-3 ml-1" />
                    {formatTimeValue(task.due_time)}
                  </span>
                )}
              </span>
            )}

            {task.tags.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                {task.tags.map((tag) => (
                  <TagBadge key={tag.id} tag={tag} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div
          ref={confirmRef}
          className={cn(
            "relative flex items-center gap-1 shrink-0 transition-opacity",
            confirmingDelete ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(task);
            }}
            title="Edit task"
            className="p-1.5 rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setConfirmingDelete(true);
            }}
            title="Delete task"
            className={cn(
              "p-1.5 rounded-md transition-colors cursor-pointer",
              confirmingDelete
                ? "bg-red-500/10 text-red-500"
                : "text-[hsl(var(--muted-foreground))] hover:bg-red-500/10 hover:text-red-500"
            )}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {confirmingDelete && (
            <div className="absolute right-0 top-full mt-2 z-20 w-56 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-xl p-3">
              <p className="text-sm font-medium mb-3">
                Delete this task?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="flex-1 py-1.5 text-xs font-medium rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingDelete(false);
                    onDelete(task.id);
                  }}
                  className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {contextMenu && (
        <AgendaItemContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          kind="task"
          onEdit={() => onEdit(task)}
          onDelete={() => onDelete(task.id)}
          onClose={() => setContextMenu(null)}
          lists={lists}
          currentListId={task.list_id}
          onMoveToList={
            onMoveToList ? (listId) => onMoveToList(task.id, listId) : undefined
          }
        />
      )}
    </div>
  );
}
