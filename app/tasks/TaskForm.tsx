"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { X, Plus, Trash2, Tag as TagIcon, AlertCircle, CalendarDays } from "lucide-react";
import { cn } from "@/utils/cn";
import { TagBadge } from "@/components/ui/TagBadge";
import type { TaskWithDetails, Tag, Priority } from "@/types";
import type { TaskFormData, SubtaskFormItem, TagFormItem } from "@/lib/tasks";
import { PLANET_TAG_COLORS } from "@/lib/tasks";
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
  onSave: (
    data: TaskFormData,
    subtasks: SubtaskFormItem[],
    tags: TagFormItem[]
  ) => Promise<void>;
  /** Permanently delete a tag from the user's library (cascades off all tasks). */
  onDeleteTag?: (tagId: string) => Promise<void>;
  editTask?: TaskWithDetails | null;
  /** Pre-fill due date when creating from calendar agenda. */
  defaultDueDate?: string | null;
  /** Assign new tasks to this List (e.g. when creating from a List view). Ignored when editing. */
  defaultListId?: string | null;
  allTags: Tag[];
}

const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: "high",   label: "High",   color: "text-red-500 border-red-400 bg-red-500/10" },
  { value: "medium", label: "Medium", color: "text-amber-500 border-amber-400 bg-amber-500/10" },
  { value: "low",    label: "Low",    color: "text-green-600 dark:text-green-500 border-green-400 bg-green-500/10" },
  { value: "none",   label: "None",   color: "text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))] bg-transparent" },
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
// Tag picker sub-component
// ---------------------------------------------------------------------------

interface TagPickerProps {
  allTags: Tag[];
  selected: TagFormItem[];
  onChange: (tags: TagFormItem[]) => void;
  onDeleteTag?: (tagId: string) => Promise<void>;
}

function tagKey(tag: TagFormItem): string {
  return tag.id ?? `session:${tag.name.toLowerCase()}`;
}

function TagPicker({ allTags, selected, onChange, onDeleteTag }: TagPickerProps) {
  const [input, setInput] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [newTagColor, setNewTagColor] = useState<string>(PLANET_TAG_COLORS[2].color);
  /** Tags created this session (not yet in allTags until the task is saved). */
  const [sessionTags, setSessionTags] = useState<TagFormItem[]>([]);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [confirmPos, setConfirmPos] = useState<{ top: number; left: number } | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputWrapRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  const deleteBtnRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const knownTags = useMemo(() => {
    const byName = new Map<string, TagFormItem>();
    for (const t of allTags) {
      byName.set(t.name.toLowerCase(), { id: t.id, name: t.name, color: t.color });
    }
    for (const t of sessionTags) {
      const key = t.name.toLowerCase();
      if (!byName.has(key)) byName.set(key, t);
    }
    return Array.from(byName.values());
  }, [allTags, sessionTags]);

  const trimmedInput = input.trim();
  const canCreate =
    trimmedInput.length > 0 &&
    !knownTags.some((t) => t.name.toLowerCase() === trimmedInput.toLowerCase());

  const filtered = knownTags.filter((t) =>
    t.name.toLowerCase().includes(input.toLowerCase())
  );
  const confirmingTag = confirmingDeleteId
    ? knownTags.find((t) => tagKey(t) === confirmingDeleteId) ?? null
    : null;

  const closeConfirm = useCallback(() => {
    setConfirmingDeleteId(null);
    setConfirmPos(null);
  }, []);

  const updateDropdownPos = useCallback(() => {
    if (!inputWrapRef.current) return;
    const r = inputWrapRef.current.getBoundingClientRect();
    setDropdownPos({ top: r.bottom + 4, left: r.left, width: r.width });
  }, []);

  const openDropdown = useCallback(() => {
    updateDropdownPos();
    setShowDropdown(true);
  }, [updateDropdownPos]);

  const closeDropdown = useCallback(() => {
    setShowDropdown(false);
    setDropdownPos(null);
  }, []);

  const openConfirm = useCallback((key: string, btn: HTMLButtonElement) => {
    const r = btn.getBoundingClientRect();
    const width = 224;
    const height = 110;
    let top = r.bottom + 8;
    if (top + height > window.innerHeight - 8) {
      top = Math.max(8, r.top - height - 8);
    }
    let left = r.right - width;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    setConfirmPos({ top, left });
    setConfirmingDeleteId(key);
  }, []);

  const addTag = useCallback(
    (tag: TagFormItem) => {
      if (!selected.some((s) => (s.id && s.id === tag.id) || s.name === tag.name)) {
        onChange([...selected, tag]);
      }
      setInput("");
      closeDropdown();
      setNewTagColor(PLANET_TAG_COLORS[2].color);
      closeConfirm();
    },
    [selected, onChange, closeConfirm, closeDropdown]
  );

  const createNewTag = useCallback(() => {
    if (!canCreate) return;
    const tag: TagFormItem = { name: trimmedInput, color: newTagColor };
    setSessionTags((prev) =>
      prev.some((t) => t.name.toLowerCase() === tag.name.toLowerCase())
        ? prev
        : [...prev, tag]
    );
    addTag(tag);
  }, [canCreate, trimmedInput, newTagColor, addTag]);

  const removeTag = useCallback(
    (name: string) => onChange(selected.filter((t) => t.name !== name)),
    [selected, onChange]
  );

  const confirmDeleteTag = useCallback(
    async (tag: TagFormItem) => {
      const key = tagKey(tag);
      if (deletingId) return;
      setDeletingId(key);
      try {
        if (tag.id) {
          if (!onDeleteTag) return;
          await onDeleteTag(tag.id);
        }
        onChange(
          selected.filter((t) =>
            tag.id
              ? t.id !== tag.id
              : t.name.toLowerCase() !== tag.name.toLowerCase()
          )
        );
        setSessionTags((prev) =>
          prev.filter((t) => t.name.toLowerCase() !== tag.name.toLowerCase())
        );
        closeConfirm();
      } finally {
        setDeletingId(null);
      }
    },
    [onDeleteTag, deletingId, selected, onChange, closeConfirm]
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && trimmedInput) {
      e.preventDefault();
      const existing = knownTags.find(
        (t) => t.name.toLowerCase() === trimmedInput.toLowerCase()
      );
      if (existing) {
        addTag({ id: existing.id, name: existing.name, color: existing.color });
      } else {
        createNewTag();
      }
    }
    if (e.key === "Escape") {
      if (confirmingDeleteId) {
        closeConfirm();
      } else {
        closeDropdown();
      }
    }
  }

  // Close dropdown on outside click (ignore while delete confirm is open)
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (confirmingDeleteId) return;
      if (wrapRef.current?.contains(e.target as Node)) return;
      if (dropdownRef.current?.contains(e.target as Node)) return;
      closeDropdown();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [confirmingDeleteId, closeDropdown]);

  // Keep dropdown anchored while open; close if layout scrolls away awkwardly
  useEffect(() => {
    if (!showDropdown) return;
    function onScroll(e: Event) {
      if (dropdownRef.current?.contains(e.target as Node)) return;
      updateDropdownPos();
    }
    function onResize() {
      updateDropdownPos();
    }
    window.addEventListener("scroll", onScroll, { capture: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", onResize);
    };
  }, [showDropdown, updateDropdownPos]);

  // Re-anchor when selected tags change (badges above the input shift its position)
  useEffect(() => {
    if (!showDropdown) return;
    const id = requestAnimationFrame(() => updateDropdownPos());
    return () => cancelAnimationFrame(id);
  }, [selected, showDropdown, updateDropdownPos]);
  // Close confirm on outside click, Escape, or scroll
  useEffect(() => {
    if (!confirmingDeleteId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeConfirm();
      }
    }
    function onOutside(e: MouseEvent) {
      if (confirmRef.current?.contains(e.target as Node)) return;
      const btn = confirmingDeleteId
        ? deleteBtnRefs.current.get(confirmingDeleteId)
        : null;
      if (btn?.contains(e.target as Node)) return;
      closeConfirm();
    }
    function onScroll(e: Event) {
      if (confirmRef.current?.contains(e.target as Node)) return;
      closeConfirm();
    }
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("mousedown", onOutside);
    window.addEventListener("scroll", onScroll, { capture: true });
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("mousedown", onOutside);
      window.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, [confirmingDeleteId, closeConfirm]);

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
        <div
          ref={inputWrapRef}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] focus-within:ring-2 focus-within:ring-[hsl(var(--primary))] transition"
        >
          <TagIcon className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              openDropdown();
              closeConfirm();
            }}
            onFocus={() => openDropdown()}
            onClick={() => openDropdown()}
            onKeyDown={handleKeyDown}
            placeholder="Add tags… (type and press Enter)"
            className="flex-1 text-xs bg-transparent outline-none text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
          />
        </div>

        {showDropdown &&
          dropdownPos &&
          (filtered.length > 0 || canCreate) &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              ref={dropdownRef}
              style={{
                position: "fixed",
                top: dropdownPos.top,
                left: dropdownPos.left,
                width: dropdownPos.width,
                zIndex: 9998,
              }}
              className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-lg overflow-hidden"
            >
              {filtered.map((tag) => {
                const key = tagKey(tag);
                return (
                  <div
                    key={key}
                    className="relative flex items-center gap-1 px-1 hover:bg-[hsl(var(--muted))] transition-colors"
                  >
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        addTag({ id: tag.id, name: tag.name, color: tag.color });
                      }}
                      className="flex items-center gap-2 flex-1 min-w-0 px-2 py-1.5 text-xs text-left cursor-pointer"
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{
                          backgroundColor:
                            tag.color ?? "hsl(var(--muted-foreground))",
                        }}
                      />
                      <span className="truncate">{tag.name}</span>
                    </button>
                    <button
                      ref={(el) => {
                        if (el) deleteBtnRefs.current.set(key, el);
                        else deleteBtnRefs.current.delete(key);
                      }}
                      type="button"
                      disabled={deletingId === key}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (confirmingDeleteId === key) {
                          closeConfirm();
                        } else {
                          openConfirm(key, e.currentTarget);
                        }
                      }}
                      className={cn(
                        "shrink-0 p-1.5 rounded-md transition-colors cursor-pointer disabled:opacity-50",
                        confirmingDeleteId === key
                          ? "bg-red-500/10 text-red-500"
                          : "text-[hsl(var(--muted-foreground))] hover:text-red-500 hover:bg-red-500/10"
                      )}
                      aria-label={`Delete tag ${tag.name}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
              {canCreate && (
                <div className={cn("pt-1.5 pb-1 px-3", filtered.length > 0 && "mt-0")}>
                  <div className="flex items-center justify-between gap-1">
                    {PLANET_TAG_COLORS.map(({ planet, color }) => (
                      <button
                        key={planet}
                        type="button"
                        title={planet}
                        aria-label={`${planet} color`}
                        aria-pressed={newTagColor === color}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setNewTagColor(color);
                        }}
                        className={cn(
                          "w-5 h-5 rounded-full shrink-0 transition-transform cursor-pointer",
                          newTagColor === color
                            ? "ring-2 ring-offset-2 ring-offset-[hsl(var(--card))] ring-[hsl(var(--foreground))] scale-110"
                            : "hover:scale-110 opacity-80 hover:opacity-100"
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      createNewTag();
                    }}
                    className="flex items-center gap-2 w-full mt-3 py-1 text-xs text-[hsl(var(--primary))] hover:opacity-80 transition-opacity text-left cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    Create &ldquo;{trimmedInput}&rdquo;
                  </button>
                </div>
              )}
            </div>,
            document.body
          )}
      </div>

      {confirmingTag &&
        confirmPos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={confirmRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-tag-title"
            style={{
              position: "fixed",
              top: confirmPos.top,
              left: confirmPos.left,
              zIndex: 9999,
            }}
            className="w-56 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-xl p-3"
          >
            <p id="delete-tag-title" className="text-sm font-medium mb-1">
              Delete tag &ldquo;{confirmingTag.name}&rdquo;?
            </p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3">
              {confirmingTag.id
                ? "It will be removed from all tasks."
                : "It hasn’t been saved yet and will be discarded."}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  closeConfirm();
                }}
                className="flex-1 py-1.5 text-xs font-medium rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingId === tagKey(confirmingTag)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  void confirmDeleteTag(confirmingTag);
                }}
                className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-60 transition-colors cursor-pointer"
              >
                {deletingId === tagKey(confirmingTag) ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>,
          document.body
        )}
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

function TaskFormBody({
  onClose,
  onSave,
  onDeleteTag,
  editTask,
  allTags,
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
  const [selectedTags, setSelectedTags] = useState<TagFormItem[]>(
    editTask?.tags.map((t) => ({ id: t.id, name: t.name, color: t.color })) ?? []
  );
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
        preservedSubtasks,
        selectedTags
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

          {/* Tags */}
          <div>
            <label className="block text-xs font-medium mb-1.5 text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
              Tags
            </label>
            <TagPicker
              allTags={allTags}
              selected={selectedTags}
              onChange={setSelectedTags}
              onDeleteTag={onDeleteTag}
            />
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
      key={props.editTask?.id ?? `new-${props.defaultDueDate ?? "none"}-${props.defaultListId ?? "none"}`}
      {...props}
      isEdit={isEdit}
    />
  );
}
