"use client";

import { useState, useRef, useEffect, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Calendar, Clock, MoreHorizontal } from "lucide-react";
import { cn } from "@/utils/cn";
import { TagBadge } from "@/components/ui/TagBadge";
import type { MoveToListOption } from "@/app/calendar/AgendaItemContextMenu";
import { relativeDate, formatDate, parseDateOnly } from "@/utils/date";
import { formatTimeValue } from "@/components/ui/TimeDropdown";
import type { Priority, Tag, TaskWithDetails } from "@/types";
import type { TagFormItem } from "@/lib/tasks";
import { TaskContextMenu } from "./TaskContextMenu";

interface TaskCardProps {
  task: TaskWithDetails;
  onDelete: (taskId: string) => void;
  onToggleComplete: (taskId: string, completed: boolean) => void;
  /** Inline title edit (also opens the detail panel). */
  onRenameTitle?: (taskId: string, title: string) => Promise<void>;
  onSetPriority?: (taskId: string, priority: Priority) => Promise<void>;
  onSetDue?: (taskId: string, date: string | null, time: string | null) => Promise<void>;
  onSetTags?: (taskId: string, tags: TagFormItem[]) => Promise<void>;
  onDeleteTag?: (tagId: string) => Promise<void>;
  allTags?: Tag[];
  /** Left-click anywhere on the card (except the check circle) opens the detail panel. */
  onSelect?: (task: TaskWithDetails) => void;
  selected?: boolean;
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

function caretIndexFromPoint(x: number, y: number): number | null {
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  if (typeof doc.caretRangeFromPoint === "function") {
    const range = doc.caretRangeFromPoint(x, y);
    if (range?.startContainer.nodeType === Node.TEXT_NODE) {
      return range.startOffset;
    }
  }
  if (typeof doc.caretPositionFromPoint === "function") {
    const pos = doc.caretPositionFromPoint(x, y);
    if (pos?.offsetNode.nodeType === Node.TEXT_NODE) {
      return pos.offset;
    }
  }
  return null;
}

export function TaskCard({
  task,
  onDelete,
  onToggleComplete,
  onRenameTitle,
  onSetPriority,
  onSetDue,
  onSetTags,
  onDeleteTag,
  allTags = [],
  onSelect,
  selected = false,
  lists,
  onMoveToList,
}: TaskCardProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(task.title);
  const [savingTitle, setSavingTitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const caretIndexRef = useRef<number | null>(null);

  useEffect(() => {
    if (!editingTitle || !titleInputRef.current) return;
    const el = titleInputRef.current;
    el.focus();
    const len = el.value.length;
    const idx = caretIndexRef.current;
    caretIndexRef.current = null;
    if (idx != null && idx >= 0 && idx <= len) {
      el.setSelectionRange(idx, idx);
    } else {
      el.setSelectionRange(len, len);
    }
  }, [editingTitle]);

  const isCompleted = task.status === "completed";
  const hasDue = !!task.due_date;
  const dueDateStr = hasDue ? formatDate(task.due_date!) : null;
  const isOverdue =
    !isCompleted &&
    hasDue &&
    parseDateOnly(task.due_date!) < new Date(new Date().toDateString());

  function startTitleEdit(caretIndex: number | null = null) {
    if (!onRenameTitle || editingTitle || savingTitle) return;
    caretIndexRef.current = caretIndex;
    setTitleValue(task.title);
    setEditingTitle(true);
  }

  async function commitTitleEdit() {
    if (!onRenameTitle || savingTitle) return;
    const trimmed = titleValue.trim();
    if (!trimmed) {
      setTitleValue(task.title);
      setEditingTitle(false);
      return;
    }
    if (trimmed === task.title.trim()) {
      setEditingTitle(false);
      return;
    }
    setSavingTitle(true);
    try {
      await onRenameTitle(task.id, trimmed);
      setEditingTitle(false);
    } catch {
      setTitleValue(task.title);
      setEditingTitle(false);
    } finally {
      setSavingTitle(false);
    }
  }

  function cancelTitleEdit() {
    setTitleValue(task.title);
    setEditingTitle(false);
  }

  function handleTitleKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void commitTitleEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelTitleEdit();
    }
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onSelect?.(task);
    setContextMenu({ x: e.clientX, y: e.clientY });
  }

  function openMenuFromButton(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (contextMenu) {
      setContextMenu(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setContextMenu({ x: rect.right, y: rect.bottom });
  }

  const canOpenMenu = !!(onSetPriority && onSetDue && onSetTags);

  return (
    <div
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={() => onSelect?.(task)}
      onKeyDown={(e) => {
        if (!onSelect || editingTitle) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(task);
        }
      }}
      onContextMenu={handleContextMenu}
      className={cn(
        "group rounded-xl border bg-[hsl(var(--card))] transition-colors",
        onSelect ? "cursor-pointer" : "cursor-default",
        isCompleted
          ? "border-[hsl(var(--border))] opacity-70"
          : "border-[hsl(var(--border))] hover:border-[hsl(var(--primary)/0.4)]",
        selected && "border-[hsl(var(--primary)/0.55)] ring-1 ring-[hsl(var(--primary)/0.25)]"
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <button
          type="button"
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

        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <>
              <label htmlFor={`task-title-edit-${task.id}`} className="sr-only">
                Edit task title
              </label>
              <input
                id={`task-title-edit-${task.id}`}
                ref={titleInputRef}
                type="text"
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onKeyDown={handleTitleKeyDown}
                onBlur={() => void commitTitleEdit()}
                onClick={(e) => e.stopPropagation()}
                disabled={savingTitle}
                className={cn(
                  "w-full bg-transparent text-sm font-medium leading-snug text-[hsl(var(--foreground))] cursor-text focus:outline-none disabled:opacity-60",
                  isCompleted && "line-through text-[hsl(var(--muted-foreground))]"
                )}
              />
            </>
          ) : (
            <span
              role={onRenameTitle ? "button" : undefined}
              tabIndex={onRenameTitle ? 0 : undefined}
              onClick={(e) => {
                e.stopPropagation();
                onSelect?.(task);
                if (onRenameTitle) {
                  startTitleEdit(caretIndexFromPoint(e.clientX, e.clientY));
                }
              }}
              onKeyDown={(e) => {
                if (!onRenameTitle) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onSelect?.(task);
                  startTitleEdit(null);
                }
              }}
              aria-label={
                onRenameTitle
                  ? `Task title: ${task.title}. Press Enter to edit.`
                  : undefined
              }
              className={cn(
                "text-sm font-medium leading-snug select-none",
                onRenameTitle ? "cursor-text" : undefined,
                isCompleted && "line-through text-[hsl(var(--muted-foreground))]"
              )}
            >
              {task.title}
            </span>
          )}

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

        {canOpenMenu && (
          <button
            type="button"
            title="Task actions"
            aria-label="Task actions"
            aria-haspopup="menu"
            aria-expanded={!!contextMenu}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={openMenuFromButton}
            className={cn(
              "mt-0.5 shrink-0 p-1 rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-opacity cursor-pointer",
              contextMenu
                ? "opacity-100"
                : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            )}
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        )}
      </div>

      {contextMenu && canOpenMenu && (
        <TaskContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          task={task}
          allTags={allTags}
          lists={lists}
          onClose={() => setContextMenu(null)}
          onDelete={() => onDelete(task.id)}
          onSetPriority={(priority) => onSetPriority!(task.id, priority)}
          onSetDue={(date, time) => onSetDue!(task.id, date, time)}
          onSetTags={(next) => onSetTags!(task.id, next)}
          onDeleteTag={onDeleteTag}
          onMoveToList={
            onMoveToList ? (listId) => onMoveToList(task.id, listId) : undefined
          }
        />
      )}
    </div>
  );
}
