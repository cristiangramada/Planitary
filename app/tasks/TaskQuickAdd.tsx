"use client";

import { useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { Plus, CalendarDays } from "lucide-react";
import { cn } from "@/utils/cn";
import type { Priority } from "@/types";
import type { TaskFormData } from "@/lib/tasks";
import {
  TaskDatePicker,
  type DatePickerValue,
  type RepeatOption,
} from "./TaskDatePicker";
import { PriorityFlag, PriorityMenu } from "./priority-ui";

interface TaskQuickAddProps {
  defaultListId: string | null;
  onCreate: (data: TaskFormData) => Promise<void>;
}

export function TaskQuickAdd({ defaultListId, onCreate }: TaskQuickAddProps) {
  const [title, setTitle] = useState("");
  const [focused, setFocused] = useState(false);
  const [priority, setPriority] = useState<Priority>("none");
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [dueTime, setDueTime] = useState<string | null>(null);
  const [repeat, setRepeat] = useState<RepeatOption>("never");
  const [saving, setSaving] = useState(false);

  const [dueOpen, setDueOpen] = useState(false);
  const [dueAnchor, setDueAnchor] = useState<{ x: number; y: number } | null>(null);
  const [priorityMenu, setPriorityMenu] = useState<{ x: number; y: number } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const dueBtnRef = useRef<HTMLButtonElement>(null);
  const flagBtnRef = useRef<HTMLButtonElement>(null);

  const showActions =
    focused || dueOpen || !!priorityMenu || title.length > 0 || !!dueDate || priority !== "none";

  function resetDraft() {
    setTitle("");
    setPriority("none");
    setDueDate(null);
    setDueTime(null);
    setRepeat("never");
    setDueOpen(false);
    setDueAnchor(null);
    setPriorityMenu(null);
  }

  async function submit() {
    const trimmed = title.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await onCreate({
        title: trimmed,
        notes: null,
        priority,
        due_date: dueDate,
        due_time: dueDate && dueTime ? `${dueTime}:00` : null,
        list_id: defaultListId,
        repeat,
      });
      resetDraft();
      inputRef.current?.focus();
    } finally {
      setSaving(false);
    }
  }

  function toggleDue(e: ReactMouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    if (dueOpen) {
      setDueOpen(false);
      setDueAnchor(null);
      return;
    }
    setPriorityMenu(null);
    const rect = e.currentTarget.getBoundingClientRect();
    setDueAnchor({ x: rect.right, y: rect.bottom });
    setDueOpen(true);
  }

  function togglePriority(e: ReactMouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    if (priorityMenu) {
      setPriorityMenu(null);
      return;
    }
    setDueOpen(false);
    setDueAnchor(null);
    const rect = e.currentTarget.getBoundingClientRect();
    setPriorityMenu({ x: rect.right, y: rect.bottom });
  }

  function handleDueConfirm(value: DatePickerValue) {
    setDueDate(value.date);
    setDueTime(value.time);
    setRepeat(value.repeat);
    setDueOpen(false);
    setDueAnchor(null);
    inputRef.current?.focus();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="shrink-0 mb-2"
    >
      <label htmlFor="task-quick-add" className="sr-only">
        Add a task
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id="task-quick-add"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-label="Add a task"
          disabled={saving}
          autoComplete="off"
          className={cn(
            "w-full pl-4 py-3 text-sm rounded-xl border bg-[hsl(var(--card))] text-[hsl(var(--foreground))] focus:outline-none transition disabled:opacity-60",
            focused || dueOpen || !!priorityMenu
              ? "border-[hsl(var(--primary))]"
              : "border-[hsl(var(--input))]",
            showActions ? "pr-[5.125rem]" : "pr-4"
          )}
        />
        {title.length === 0 && !focused && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-4 flex items-center gap-1.5 text-[hsl(var(--muted-foreground))]"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" strokeWidth={2.25} />
            <span className="text-sm leading-none">Add task</span>
          </div>
        )}

        {showActions && (
          <div className="absolute inset-y-0 right-2 flex items-center gap-0.5">
            <button
              ref={flagBtnRef}
              type="button"
              title="Priority"
              aria-label={`Priority: ${priority}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={togglePriority}
              className="p-1.5 rounded-md hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer"
            >
              <PriorityFlag priority={priority} className="w-4 h-4" />
            </button>
            <button
              ref={dueBtnRef}
              type="button"
              title="Due date"
              aria-label="Due date"
              aria-pressed={dueOpen || !!dueDate}
              onMouseDown={(e) => e.preventDefault()}
              onClick={toggleDue}
              className={cn(
                "p-1.5 rounded-md transition-colors cursor-pointer",
                dueOpen || dueDate
                  ? "text-[hsl(var(--foreground))] bg-[hsl(var(--muted))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
              )}
            >
              <CalendarDays className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {dueOpen && dueAnchor && (
        <TaskDatePicker
          initialDate={dueDate}
          initialTime={dueTime}
          initialRepeat={repeat}
          anchor={dueAnchor}
          anchorAlign="end"
          ignoreCloseRef={dueBtnRef}
          onConfirm={handleDueConfirm}
          onClose={() => {
            setDueOpen(false);
            setDueAnchor(null);
          }}
        />
      )}

      {priorityMenu && (
        <PriorityMenu
          x={priorityMenu.x}
          y={priorityMenu.y}
          current={priority}
          ignoreCloseRef={flagBtnRef}
          onSelect={(p) => {
            setPriority(p);
            setPriorityMenu(null);
            inputRef.current?.focus();
          }}
          onClose={() => setPriorityMenu(null)}
        />
      )}
    </form>
  );
}
