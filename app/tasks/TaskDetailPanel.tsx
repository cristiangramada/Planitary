"use client";

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { CheckSquare, AlignLeft, X, CalendarDays } from "lucide-react";
import { cn } from "@/utils/cn";
import type { Priority, Subtask, TaskWithDetails } from "@/types";
import type { SubtaskFormItem } from "@/lib/tasks";
import {
  TaskDatePicker,
  type DatePickerValue,
  type RepeatOption,
} from "./TaskDatePicker";
import { PriorityFlag, PriorityMenu } from "./priority-ui";

export type DetailBodyMode = "notes" | "checklist";

interface TaskDetailPanelProps {
  task: TaskWithDetails;
  onSaveTitleNotes: (taskId: string, title: string, notes: string | null) => Promise<void>;
  onReplaceSubtasks: (taskId: string, subtasks: SubtaskFormItem[]) => Promise<Subtask[]>;
  onToggleSubtask: (taskId: string, subtaskId: string, completed: boolean) => void;
  onPatchFields: (
    taskId: string,
    fields: Partial<Pick<TaskWithDetails, "priority" | "due_date" | "due_time">> & {
      repeat?: RepeatOption;
    }
  ) => Promise<void>;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

function formatDueLabel(date: string | null, time: string | null): string {
  if (!date) return "Due Date";
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const base = `${WEEKDAYS[dt.getDay()]}, ${SHORT_MONTHS[dt.getMonth()]} ${d}`;
  if (!time) return base;
  const [hStr, mStr] = time.split(":");
  const h = parseInt(hStr, 10);
  const min = parseInt(mStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${base} ${h12}:${String(min).padStart(2, "0")} ${ampm}`;
}

function notesToChecklist(notes: string | null): SubtaskFormItem[] {
  if (!notes) return [];
  return notes
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((title) => ({ title, is_completed: false }));
}

function checklistToNotes(items: Array<{ title: string }>): string | null {
  const lines = items.map((i) => i.title.trim()).filter(Boolean);
  return lines.length > 0 ? lines.join("\n") : null;
}

function initialMode(task: TaskWithDetails): DetailBodyMode {
  return task.subtasks.length > 0 && !(task.notes && task.notes.trim())
    ? "checklist"
    : "notes";
}

export function TaskDetailPanel({
  task,
  onSaveTitleNotes,
  onReplaceSubtasks,
  onToggleSubtask,
  onPatchFields,
}: TaskDetailPanelProps) {
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [mode, setMode] = useState<DetailBodyMode>(() => initialMode(task));
  const [error, setError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerAnchor, setPickerAnchor] = useState<{ x: number; y: number } | null>(null);
  const [repeat, setRepeat] = useState<RepeatOption>(task.repeat);
  const [priorityMenu, setPriorityMenu] = useState<{ x: number; y: number } | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const dueBtnRef = useRef<HTMLButtonElement>(null);
  const flagBtnRef = useRef<HTMLButtonElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleNotesRef = useRef({ title: task.title, notes: task.notes ?? "" });

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  async function flushTitleNotes(nextTitle: string, nextNotes: string) {
    const trimmed = nextTitle.trim() || "Untitled";
    const notesValue = nextNotes.trim().length > 0 ? nextNotes : null;
    const prev = titleNotesRef.current;
    if (trimmed === prev.title && (notesValue ?? "") === prev.notes) return;

    setError(null);
    try {
      await onSaveTitleNotes(task.id, trimmed, notesValue);
      titleNotesRef.current = { title: trimmed, notes: notesValue ?? "" };
      if (trimmed !== nextTitle) setTitle(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save changes.");
    }
  }

  function scheduleSave(nextTitle: string, nextNotes: string) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void flushTitleNotes(nextTitle, nextNotes);
    }, 450);
  }

  async function switchToChecklist() {
    if (switching) return;
    setSwitching(true);
    setError(null);
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    try {
      await flushTitleNotes(title, notes);
      const items = notesToChecklist(notes);
      await onReplaceSubtasks(task.id, items);
      await onSaveTitleNotes(task.id, title.trim() || "Untitled", null);
      titleNotesRef.current = { title: title.trim() || "Untitled", notes: "" };
      setNotes("");
      setMode("checklist");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't switch to checklist.");
    } finally {
      setSwitching(false);
    }
  }

  async function switchToDescription() {
    if (switching) return;
    setSwitching(true);
    setError(null);
    try {
      const text = checklistToNotes(task.subtasks);
      await onReplaceSubtasks(task.id, []);
      const trimmedTitle = title.trim() || "Untitled";
      await onSaveTitleNotes(task.id, trimmedTitle, text);
      titleNotesRef.current = { title: trimmedTitle, notes: text ?? "" };
      setNotes(text ?? "");
      setMode("notes");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't switch to description.");
    } finally {
      setSwitching(false);
    }
  }

  async function handleToggleMode() {
    if (mode === "notes") await switchToChecklist();
    else await switchToDescription();
  }

  async function addChecklistItem(raw: string) {
    const value = raw.trim();
    if (!value) return;
    setError(null);
    try {
      await onReplaceSubtasks(task.id, [
        ...task.subtasks.map((s) => ({
          id: s.id,
          title: s.title,
          is_completed: s.is_completed,
        })),
        { title: value, is_completed: false },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add item.");
    }
  }

  async function updateChecklistTitle(subtaskId: string, nextTitle: string) {
    const trimmed = nextTitle.trim();
    if (!trimmed) return;
    try {
      await onReplaceSubtasks(
        task.id,
        task.subtasks.map((s) =>
          s.id === subtaskId
            ? { id: s.id, title: trimmed, is_completed: s.is_completed }
            : { id: s.id, title: s.title, is_completed: s.is_completed }
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update item.");
    }
  }

  async function removeChecklistItem(subtaskId: string) {
    try {
      await onReplaceSubtasks(
        task.id,
        task.subtasks
          .filter((s) => s.id !== subtaskId)
          .map((s) => ({ id: s.id, title: s.title, is_completed: s.is_completed }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove item.");
    }
  }

  function toggleDuePicker(e: ReactMouseEvent<HTMLButtonElement>) {
    if (pickerOpen) {
      setPickerOpen(false);
      setPickerAnchor(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    // Top-left of the picker: left edge with the button, top flush under it.
    setPickerAnchor({ x: rect.left, y: rect.bottom });
    setPickerOpen(true);
  }

  async function handlePickerConfirm(value: DatePickerValue) {
    setRepeat(value.repeat);
    setPickerOpen(false);
    setPickerAnchor(null);
    try {
      await onPatchFields(task.id, {
        due_date: value.date,
        due_time: value.date && value.time ? `${value.time}:00` : null,
        repeat: value.repeat,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update due date.");
    }
  }

  function togglePriorityMenu(e: ReactMouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    if (priorityMenu) {
      setPriorityMenu(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    // x = right edge of the flag button; menu right-aligns to it, flush underneath.
    setPriorityMenu({ x: rect.right, y: rect.bottom });
  }

  async function selectPriority(priority: Priority) {
    setPriorityMenu(null);
    if (priority === task.priority) return;
    try {
      await onPatchFields(task.id, { priority });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update priority.");
    }
  }

  const toggleLabel = mode === "notes" ? "Checklist" : "Description";
  const dueTimeDisplay = task.due_time ? task.due_time.slice(0, 5) : null;

  return (
    <div className="flex h-full flex-col bg-[hsl(var(--background))]">
      {/* Meta bar — due date + priority (flag shares a column with the mode toggle below) */}
      <div className="grid grid-cols-[minmax(0,1fr)_2.25rem] items-center gap-2 pl-4 pr-5 pt-3 pb-2.5 shrink-0">
        <button
          ref={dueBtnRef}
          type="button"
          onClick={toggleDuePicker}
          className={cn(
            "justify-self-start inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer",
            task.due_date
              ? "text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
              : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
          )}
        >
          <CalendarDays className="w-3.5 h-3.5 shrink-0" />
          {formatDueLabel(task.due_date, dueTimeDisplay)}
        </button>
        <button
          ref={flagBtnRef}
          type="button"
          onClick={togglePriorityMenu}
          aria-label={`Priority: ${task.priority}`}
          title="Change priority"
          className="justify-self-center p-1.5 rounded-md hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer"
        >
          <PriorityFlag priority={task.priority} className="w-5 h-5" />
        </button>
      </div>

      <div className="border-t border-[hsl(var(--border))] shrink-0" />

      <div className="grid grid-cols-[minmax(0,1fr)_2.25rem] items-center gap-2 pl-4 pr-5 pt-3 pb-1 shrink-0">
        <input
          ref={titleRef}
          value={title}
          onChange={(e) => {
            const v = e.target.value;
            setTitle(v);
            scheduleSave(v, notes);
          }}
          onBlur={() => void flushTitleNotes(title, notes)}
          aria-label="Task title"
          className="min-w-0 w-full text-xl font-semibold bg-transparent text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none"
          placeholder="Task title"
        />
        <button
          type="button"
          onClick={() => void handleToggleMode()}
          disabled={switching}
          title={toggleLabel}
          aria-label={`Switch to ${toggleLabel}`}
          className="justify-self-center p-1.5 rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {mode === "notes" ? (
            <CheckSquare className="w-5 h-5" />
          ) : (
            <AlignLeft className="w-5 h-5" />
          )}
        </button>
      </div>

      {error && (
        <div className="mx-4 mb-2 px-3 py-2 rounded-lg border border-red-500/20 bg-red-500/10 text-xs text-red-500 shrink-0">
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col pt-4">
        {mode === "notes" ? (
          <textarea
            value={notes}
            onChange={(e) => {
              const v = e.target.value;
              setNotes(v);
              scheduleSave(title, v);
            }}
            onBlur={() => void flushTitleNotes(title, notes)}
            aria-label="Description"
            placeholder="Write something"
            className="flex-1 min-h-0 w-full resize-none bg-transparent px-4 py-2 text-sm leading-relaxed text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none"
          />
        ) : (
          <ChecklistBody
            subtasks={task.subtasks}
            onToggle={(subtaskId, completed) => onToggleSubtask(task.id, subtaskId, completed)}
            onAdd={(text) => void addChecklistItem(text)}
            onRename={(id, next) => void updateChecklistTitle(id, next)}
            onRemove={(id) => void removeChecklistItem(id)}
          />
        )}
      </div>

      {pickerOpen && pickerAnchor && (
        <TaskDatePicker
          initialDate={task.due_date}
          initialTime={dueTimeDisplay}
          initialRepeat={repeat}
          anchor={pickerAnchor}
          ignoreCloseRef={dueBtnRef}
          onConfirm={handlePickerConfirm}
          onClose={() => {
            setPickerOpen(false);
            setPickerAnchor(null);
          }}
        />
      )}

      {priorityMenu && (
        <PriorityMenu
          x={priorityMenu.x}
          y={priorityMenu.y}
          current={task.priority}
          ignoreCloseRef={flagBtnRef}
          onSelect={(p) => void selectPriority(p)}
          onClose={() => setPriorityMenu(null)}
        />
      )}
    </div>
  );
}

function ChecklistBody({
  subtasks,
  onToggle,
  onAdd,
  onRename,
  onRemove,
}: {
  subtasks: Subtask[];
  onToggle: (subtaskId: string, completed: boolean) => void;
  onAdd: (text: string) => void;
  onRename: (subtaskId: string, title: string) => void;
  onRemove: (subtaskId: string) => void;
}) {
  const [draft, setDraft] = useState("");

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-y-auto px-3 py-2">
      <ul className="space-y-0.5">
        {subtasks.map((s) => (
          <li key={s.id} className="group flex items-start gap-2 rounded-lg px-1 py-1.5 hover:bg-[hsl(var(--muted)/0.5)]">
            <button
              type="button"
              onClick={() => onToggle(s.id, !s.is_completed)}
              aria-label={s.is_completed ? "Mark incomplete" : "Mark complete"}
              className="mt-0.5 shrink-0 cursor-pointer"
            >
              <span
                className={cn(
                  "flex items-center justify-center w-4 h-4 rounded border transition-colors",
                  s.is_completed
                    ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]"
                    : "border-[hsl(var(--muted-foreground))]"
                )}
              >
                {s.is_completed && (
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
            <input
              defaultValue={s.title}
              key={`${s.id}:${s.title}`}
              onBlur={(e) => {
                if (e.target.value.trim() !== s.title) onRename(s.id, e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className={cn(
                "flex-1 min-w-0 bg-transparent text-sm focus:outline-none",
                s.is_completed && "line-through text-[hsl(var(--muted-foreground))]"
              )}
            />
            <button
              type="button"
              onClick={() => onRemove(s.id)}
              aria-label={`Remove ${s.title}`}
              className="opacity-0 group-hover:opacity-100 p-0.5 text-[hsl(var(--muted-foreground))] hover:text-red-500 transition-opacity cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="mt-0.5 px-1"
        onSubmit={(e) => {
          e.preventDefault();
          onAdd(draft);
          setDraft("");
        }}
      >
        <div className="flex items-start gap-2 py-1.5">
          <span
            aria-hidden
            className="mt-0.5 flex items-center justify-center w-4 h-4 rounded border border-[hsl(var(--muted-foreground))] shrink-0 opacity-70"
          />
          <div className="flex-1 min-w-0 border-b border-[hsl(var(--border))] pb-2 focus-within:border-[hsl(var(--muted-foreground))]">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Press 'Enter' to add list item"
              className="w-full bg-transparent text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] border-0 rounded-none px-0 py-0 focus:outline-none"
            />
          </div>
        </div>
      </form>
    </div>
  );
}
