"use client";

import { useState } from "react";
import {
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  Calendar,
  RotateCcw,
  Clock,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { TagBadge } from "@/components/ui/TagBadge";
import { relativeDate, formatDate } from "@/utils/date";
import type { TaskWithDetails } from "@/types";

interface TaskCardProps {
  task: TaskWithDetails;
  onEdit: (task: TaskWithDetails) => void;
  onDelete: (taskId: string) => void;
  onToggleComplete: (taskId: string, completed: boolean) => void;
  onToggleSubtask: (taskId: string, subtaskId: string, completed: boolean) => void;
}

export function TaskCard({
  task,
  onEdit,
  onDelete,
  onToggleComplete,
  onToggleSubtask,
}: TaskCardProps) {
  const [subtasksExpanded, setSubtasksExpanded] = useState(false);

  const isCompleted = task.status === "completed";
  const completedSubtasks = task.subtasks.filter((s) => s.is_completed).length;
  const hasSubtasks = task.subtasks.length > 0;
  const hasDue = !!task.due_date;
  const dueDateStr = hasDue ? formatDate(task.due_date!) : null;
  const isOverdue =
    !isCompleted &&
    hasDue &&
    new Date(task.due_date!) < new Date(new Date().toDateString());

  return (
    <div
      className={cn(
        "group rounded-xl border bg-[hsl(var(--card))] transition-colors",
        isCompleted
          ? "border-[hsl(var(--border))] opacity-70"
          : "border-[hsl(var(--border))] hover:border-[hsl(var(--primary)/0.4)]"
      )}
    >
      {/* Main row */}
      <div className="flex items-start gap-3 p-4">
        {/* Checkbox */}
        <button
          onClick={() => onToggleComplete(task.id, !isCompleted)}
          aria-label={isCompleted ? "Reopen task" : "Complete task"}
          className="mt-0.5 shrink-0"
        >
          <span
            className={cn(
              "flex items-center justify-center w-5 h-5 rounded-full border-2 transition-colors",
              isCompleted
                ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]"
                : "border-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))]"
            )}
          >
            {isCompleted && (
              <svg
                className="w-2.5 h-2.5 text-[hsl(var(--primary-foreground))]"
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

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-center gap-2 flex-wrap">
            {!isCompleted && <PriorityBadge priority={task.priority} />}
            <span
              className={cn(
                "text-sm font-medium leading-snug",
                isCompleted && "line-through text-[hsl(var(--muted-foreground))]"
              )}
            >
              {task.title}
            </span>
          </div>

          {/* Notes preview */}
          {task.notes && !isCompleted && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 line-clamp-1">
              {task.notes}
            </p>
          )}

          {/* Completed timestamp */}
          {isCompleted && task.completed_at && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
              Completed {relativeDate(task.completed_at)}
            </p>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {/* Due date */}
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
                    {task.due_time.slice(0, 5)}
                  </span>
                )}
              </span>
            )}

            {/* Subtask count */}
            {hasSubtasks && (
              <button
                onClick={() => setSubtasksExpanded((v) => !v)}
                className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
              >
                {subtasksExpanded ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                {completedSubtasks}/{task.subtasks.length} subtasks
              </button>
            )}

            {/* Tags */}
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
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {isCompleted ? (
            <button
              onClick={() => onToggleComplete(task.id, false)}
              title="Reopen task"
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reopen
            </button>
          ) : (
            <button
              onClick={() => onEdit(task)}
              title="Edit task"
              className="p-1.5 rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => onDelete(task.id)}
            title="Delete task"
            className="p-1.5 rounded-md text-[hsl(var(--muted-foreground))] hover:bg-red-500/10 hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Subtask list (expanded) */}
      {hasSubtasks && subtasksExpanded && (
        <div className="border-t border-[hsl(var(--border))] px-4 py-2 space-y-1">
          {task.subtasks.map((subtask) => (
            <button
              key={subtask.id}
              onClick={() =>
                onToggleSubtask(task.id, subtask.id, !subtask.is_completed)
              }
              className="flex items-center gap-2.5 w-full text-left py-1.5 group/sub"
            >
              <span
                className={cn(
                  "flex items-center justify-center w-4 h-4 rounded border transition-colors shrink-0",
                  subtask.is_completed
                    ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]"
                    : "border-[hsl(var(--muted-foreground))] group-hover/sub:border-[hsl(var(--primary))]"
                )}
              >
                {subtask.is_completed && (
                  <svg
                    className="w-2 h-2 text-[hsl(var(--primary-foreground))]"
                    viewBox="0 0 10 8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="1 4 3.5 6.5 9 1" />
                  </svg>
                )}
              </span>
              <span
                className={cn(
                  "text-xs leading-snug",
                  subtask.is_completed
                    ? "line-through text-[hsl(var(--muted-foreground))]"
                    : "text-[hsl(var(--foreground))]"
                )}
              >
                {subtask.title}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
