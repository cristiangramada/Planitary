"use client";

import { useState, useEffect } from "react";
import { X, AlertCircle, CalendarDays } from "lucide-react";
import { cn } from "@/utils/cn";
import type { TaskWithDetails, Priority } from "@/types";
import type { TaskFormData, SubtaskFormItem } from "@/lib/tasks";
import {
  TaskDatePicker,
  type DatePickerValue,
  type RepeatOption,
} from "./TaskDatePicker";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TaskFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: TaskFormData, subtasks: SubtaskFormItem[]) => Promise<void>;
  editTask?: TaskWithDetails | null;
  /** Pre-fill due date when creating from calendar agenda. */
  defaultDueDate?: string | null;
  /** Assign new tasks to this List (e.g. when creating from a List view). Ignored when editing. */
  defaultListId?: string | null;
}

const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: "high",   label: "High",   color: "text-red-500 border-red-400 bg-red-500/10" },
  { value: "medium", label: "Medium", color: "text-amber-500 border-amber-400 bg-amber-500/10" },
  { value: "low",    label: "Low",    color: "text-green-600 dark:text-green-500 border-green-400 bg-green-500/10" },
  { value: "none",   label: "None",   color: "text-[hsl(var(--primary))] border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.1)]" },
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/** Format a YYYY-MM-DD + optional HH:MM into a human-readable due date label. */
function formatScheduleLabel(date: string | null, time: string | null): string {
  if (!date) return "Due Date";
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const dayName = WEEKDAYS[dt.getDay()];
  const monthName = SHORT_MONTHS[dt.getMonth()];
  const base = `${dayName}, ${monthName} ${d}`;

  if (!time) return base;
  const [hStr, mStr] = time.split(":");
  const h = parseInt(hStr, 10);
  const min = parseInt(mStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${base} at ${h12}:${String(min).padStart(2, "0")} ${ampm}`;
}

// ---------------------------------------------------------------------------
// Inner form body — receives initializers from props.
// Keyed by editTask?.id so React remounts (and resets state) on task switch.
// ---------------------------------------------------------------------------

interface TaskFormBodyProps extends TaskFormProps {
  isEdit: boolean;
}

function TaskFormBody({
  onClose,
  onSave,
  editTask,
  isEdit,
  defaultDueDate,
  defaultListId,
}: TaskFormBodyProps) {
  // State initializers derive from editTask at mount time.
  // No useEffect needed — the `key` prop on the outer wrapper resets this
  // component whenever the editing task changes.
  const [title, setTitle] = useState(editTask?.title ?? "");
  const [priority, setPriority] = useState<Priority>(editTask?.priority ?? "medium");
  const [dueDate, setDueDate] = useState<string | null>(
    editTask?.due_date ?? defaultDueDate ?? null
  );
  const [dueTime, setDueTime] = useState<string | null>(() => {
    if (!editTask?.due_time) return null;
    return editTask.due_time.slice(0, 5);
  });
  // Repeat is UI-only for now (not yet persisted to DB)
  const [repeat, setRepeat] = useState<RepeatOption>("never");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handlePickerConfirm(value: DatePickerValue) {
    setDueDate(value.date);
    setDueTime(value.time);
    setRepeat(value.repeat);
    setPickerOpen(false);
  }

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setError(null);
    setSaving(true);
    // Notes/subtasks live in the detail panel; preserve them on edit.
    // New tasks inherit the current List view via defaultListId.
    const preservedSubtasks: SubtaskFormItem[] =
      editTask?.subtasks.map((s) => ({
        id: s.id,
        title: s.title,
        is_completed: s.is_completed,
      })) ?? [];
    try {
      await onSave(
        {
          title: title.trim(),
          notes: editTask?.notes ?? null,
          priority,
          due_date: dueDate,
          due_time: dueDate && dueTime ? dueTime + ":00" : null,
          list_id: editTask ? editTask.list_id : (defaultListId ?? null),
        },
        preservedSubtasks
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save task.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg flex flex-col bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-2xl shadow-2xl max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))] shrink-0">
          <h2 className="text-base font-semibold">
            {isEdit ? "Edit task" : "New task"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable form body */}
        <form
          id="task-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-5 py-5 space-y-5"
        >
          {/* Title */}
          <div>
            <label className="block text-xs font-medium mb-1.5 text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              autoFocus
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none transition"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs font-medium mb-1.5 text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
              Priority
            </label>
            <div className="flex gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  className={cn(
                    "flex flex-1 h-9 items-center justify-center text-xs font-semibold leading-none rounded-lg border transition-all",
                    priority === p.value
                      ? cn(p.color, "cursor-default")
                      : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] cursor-pointer"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Due Date (date + time picker trigger) */}
          <div>
            <label className="block text-xs font-medium mb-1.5 text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
              Due Date
            </label>
            <div
              className={cn(
                "w-full flex items-center gap-1 px-3 py-2.5 text-sm rounded-lg border transition-all",
                dueDate
                  ? "border-[hsl(var(--primary)/0.5)] bg-[hsl(var(--primary)/0.06)] text-[hsl(var(--primary))]"
                  : "border-[hsl(var(--input))] text-[hsl(var(--muted-foreground))]"
              )}
            >
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className={cn(
                  "flex flex-1 items-center gap-2.5 min-w-0 text-left cursor-pointer",
                  dueDate
                    ? "hover:opacity-80"
                    : "hover:text-[hsl(var(--foreground))]"
                )}
              >
                <CalendarDays className="w-4 h-4 shrink-0" />
                <span className="flex-1 truncate">{formatScheduleLabel(dueDate, dueTime)}</span>
              </button>
              {dueDate && (
                <button
                  type="button"
                  aria-label="Clear due date"
                  onClick={() => {
                    setDueDate(null);
                    setDueTime(null);
                    setRepeat("never");
                  }}
                  className="p-0.5 rounded-full shrink-0 hover:bg-[hsl(var(--primary)/0.2)] transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* TaskDatePicker modal */}
          {pickerOpen && (
            <TaskDatePicker
              initialDate={dueDate}
              initialTime={dueTime}
              initialRepeat={repeat}
              onConfirm={handlePickerConfirm}
              onClose={() => setPickerOpen(false)}
            />
          )}

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-500 bg-red-500/10 px-3 py-2.5 rounded-lg">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-[hsl(var(--border))] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-medium rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="task-form"
            disabled={saving || !title.trim()}
            className="flex-1 py-2.5 text-sm font-semibold rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity cursor-pointer"
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create task"}
          </button>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Public export — thin wrapper that provides key-based state reset
// ---------------------------------------------------------------------------

export function TaskForm(props: TaskFormProps) {
  if (!props.open) return null;

  const isEdit = !!props.editTask;

  return (
    // Keying by editTask id causes React to unmount/remount TaskFormBody
    // whenever the editing task changes, resetting all form state cleanly
    // without calling setState inside a useEffect.
    <TaskFormBody
      key={props.editTask?.id ?? `new-${props.defaultDueDate ?? "none"}-${props.defaultListId ?? "none"}`}
      {...props}
      isEdit={isEdit}
    />
  );
}
