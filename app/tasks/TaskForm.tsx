"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Plus, Trash2, Tag as TagIcon, AlertCircle, CalendarDays } from "lucide-react";
import { cn } from "@/utils/cn";
import { TagBadge } from "@/components/ui/TagBadge";
import type { TaskWithDetails, Tag, Priority } from "@/types";
import type { TaskFormData, SubtaskFormItem, TagFormItem } from "@/lib/tasks";
import {
  TaskDatePicker,
  type DatePickerValue,
  type ReminderOption,
  type RepeatOption,
} from "./TaskDatePicker";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TaskFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (
    data: TaskFormData,
    subtasks: SubtaskFormItem[],
    tags: TagFormItem[]
  ) => Promise<void>;
  editTask?: TaskWithDetails | null;
  /** Pre-fill due date when creating from calendar agenda. */
  defaultDueDate?: string | null;
  allTags: Tag[];
}

const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: "high",   label: "High",   color: "text-red-500 border-red-400 bg-red-500/10" },
  { value: "medium", label: "Medium", color: "text-amber-500 border-amber-400 bg-amber-500/10" },
  { value: "low",    label: "Low",    color: "text-green-600 dark:text-green-500 border-green-400 bg-green-500/10" },
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/** Format a YYYY-MM-DD + optional HH:MM into a human-readable schedule label. */
function formatScheduleLabel(date: string | null, time: string | null): string {
  if (!date) return "Schedule";
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
// Tag picker sub-component
// ---------------------------------------------------------------------------

interface TagPickerProps {
  allTags: Tag[];
  selected: TagFormItem[];
  onChange: (tags: TagFormItem[]) => void;
}

function TagPicker({ allTags, selected, onChange }: TagPickerProps) {
  const [input, setInput] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const filtered = allTags.filter(
    (t) =>
      t.name.toLowerCase().includes(input.toLowerCase()) &&
      !selected.some((s) => s.id === t.id)
  );

  const addTag = useCallback(
    (tag: TagFormItem) => {
      if (!selected.some((s) => (s.id && s.id === tag.id) || s.name === tag.name)) {
        onChange([...selected, tag]);
      }
      setInput("");
      setShowDropdown(false);
    },
    [selected, onChange]
  );

  const removeTag = useCallback(
    (name: string) => onChange(selected.filter((t) => t.name !== name)),
    [selected, onChange]
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault();
      const existing = allTags.find(
        (t) => t.name.toLowerCase() === input.trim().toLowerCase()
      );
      if (existing) {
        addTag({ id: existing.id, name: existing.name, color: existing.color });
      } else {
        addTag({ name: input.trim(), color: null });
      }
    }
    if (e.key === "Escape") setShowDropdown(false);
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="space-y-2" ref={wrapRef}>
      {/* Selected tags */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((tag) => (
            <TagBadge
              key={tag.name}
              tag={tag}
              onRemove={() => removeTag(tag.name)}
            />
          ))}
        </div>
      )}

      {/* Input + dropdown */}
      <div className="relative">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] focus-within:ring-2 focus-within:ring-[hsl(var(--primary))] transition">
          <TagIcon className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            onKeyDown={handleKeyDown}
            placeholder="Add tags… (type and press Enter)"
            className="flex-1 text-xs bg-transparent outline-none text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
          />
        </div>

        {showDropdown && (filtered.length > 0 || input.trim()) && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-lg py-1">
            {filtered.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  addTag({ id: tag.id, name: tag.name, color: tag.color });
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-[hsl(var(--muted))] transition-colors text-left cursor-pointer"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: tag.color ?? "hsl(var(--muted-foreground))" }}
                />
                {tag.name}
              </button>
            ))}
            {input.trim() &&
              !allTags.some(
                (t) => t.name.toLowerCase() === input.trim().toLowerCase()
              ) && (
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    addTag({ name: input.trim(), color: null });
                  }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-[hsl(var(--muted))] text-[hsl(var(--primary))] transition-colors text-left cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  Create &ldquo;{input.trim()}&rdquo;
                </button>
              )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subtask list sub-component
// ---------------------------------------------------------------------------

interface SubtaskListProps {
  items: SubtaskFormItem[];
  onChange: (items: SubtaskFormItem[]) => void;
}

function SubtaskList({ items, onChange }: SubtaskListProps) {
  const [newTitle, setNewTitle] = useState("");
  const newRef = useRef<HTMLInputElement>(null);

  function addSubtask() {
    const title = newTitle.trim();
    if (!title) return;
    onChange([...items, { title, is_completed: false }]);
    setNewTitle("");
    newRef.current?.focus();
  }

  function updateTitle(index: number, title: string) {
    const next = [...items];
    next[index] = { ...next[index], title };
    onChange(next);
  }

  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--muted-foreground))] shrink-0 ml-1" />
          <input
            value={item.title}
            onChange={(e) => updateTitle(i, e.target.value)}
            className="flex-1 text-sm px-2 py-1.5 rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
            placeholder="Subtask title"
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="p-1 rounded text-[hsl(var(--muted-foreground))] hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      {/* Add new subtask */}
      <div className="flex items-center gap-2">
        <Plus className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))] shrink-0 ml-0.5" />
        <input
          ref={newRef}
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addSubtask();
            }
          }}
          placeholder="Add a subtask… (press Enter)"
          className="flex-1 text-sm px-2 py-1.5 rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inner form body — receives initializers from props.
// Keyed by editTask?.id so React remounts (and resets state) on task switch.
// ---------------------------------------------------------------------------

interface TaskFormBodyProps extends TaskFormProps {
  isEdit: boolean;
}

function TaskFormBody({ onClose, onSave, editTask, allTags, isEdit, defaultDueDate }: TaskFormBodyProps) {
  // State initializers derive from editTask at mount time.
  // No useEffect needed — the `key` prop on the outer wrapper resets this
  // component whenever the editing task changes.
  const [title, setTitle] = useState(editTask?.title ?? "");
  const [notes, setNotes] = useState(editTask?.notes ?? "");
  const [priority, setPriority] = useState<Priority>(editTask?.priority ?? "medium");
  const [dueDate, setDueDate] = useState<string | null>(
    editTask?.due_date ?? defaultDueDate ?? null
  );
  const [dueTime, setDueTime] = useState<string | null>(() => {
    if (!editTask?.due_time) return null;
    return editTask.due_time.slice(0, 5);
  });
  // Reminder and repeat are UI-only for now (not yet persisted to DB)
  const [reminder, setReminder] = useState<ReminderOption>("none");
  const [repeat, setRepeat] = useState<RepeatOption>("never");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [subtasks, setSubtasks] = useState<SubtaskFormItem[]>(
    editTask?.subtasks.map((s) => ({ id: s.id, title: s.title, is_completed: s.is_completed })) ?? []
  );
  const [selectedTags, setSelectedTags] = useState<TagFormItem[]>(
    editTask?.tags.map((t) => ({ id: t.id, name: t.name, color: t.color })) ?? []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handlePickerConfirm(value: DatePickerValue) {
    setDueDate(value.date);
    setDueTime(value.time);
    setReminder(value.reminder);
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
    try {
      await onSave(
        {
          title: title.trim(),
          notes: notes.trim() || null,
          priority,
          due_date: dueDate,
          due_time: dueDate && dueTime ? dueTime + ":00" : null,
        },
        subtasks.filter((s) => s.title.trim()),
        selectedTags
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save task.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
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
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] transition"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium mb-1.5 text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any details or context…"
              rows={3}
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] transition resize-none"
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

          {/* Schedule (date + time picker trigger) */}
          <div>
            <label className="block text-xs font-medium mb-1.5 text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
              Schedule
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
                  aria-label="Clear schedule"
                  onClick={() => {
                    setDueDate(null);
                    setDueTime(null);
                    setReminder("none");
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
              initialReminder={reminder}
              initialRepeat={repeat}
              onConfirm={handlePickerConfirm}
              onClose={() => setPickerOpen(false)}
            />
          )}

          {/* Tags */}
          <div>
            <label className="block text-xs font-medium mb-1.5 text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
              Tags
            </label>
            <TagPicker
              allTags={allTags}
              selected={selectedTags}
              onChange={setSelectedTags}
            />
          </div>

          {/* Subtasks */}
          <div>
            <label className="block text-xs font-medium mb-1.5 text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
              Subtasks
            </label>
            <SubtaskList items={subtasks} onChange={setSubtasks} />
          </div>

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
      key={props.editTask?.id ?? `new-${props.defaultDueDate ?? "none"}`}
      {...props}
      isEdit={isEdit}
    />
  );
}
