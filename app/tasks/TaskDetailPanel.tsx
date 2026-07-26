"use client";

import { useEffect, useRef, useState } from "react";
import { CheckSquare, AlignLeft, X } from "lucide-react";
import { cn } from "@/utils/cn";
import type { Subtask, TaskWithDetails } from "@/types";
import type { SubtaskFormItem } from "@/lib/tasks";

export type DetailBodyMode = "notes" | "checklist";

interface TaskDetailPanelProps {
  task: TaskWithDetails;
  onSaveTitleNotes: (taskId: string, title: string, notes: string | null) => Promise<void>;
  onReplaceSubtasks: (taskId: string, subtasks: SubtaskFormItem[]) => Promise<Subtask[]>;
  onToggleSubtask: (taskId: string, subtaskId: string, completed: boolean) => void;
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
}: TaskDetailPanelProps) {
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [mode, setMode] = useState<DetailBodyMode>(() => initialMode(task));
  const [error, setError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
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

  const toggleLabel = mode === "notes" ? "Checklist" : "Description";

  return (
    <div className="flex h-full flex-col bg-[hsl(var(--background))]">
      <div className="flex items-center gap-2 pl-4 pr-5 pt-4 pb-1 shrink-0">
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
          className="flex-1 min-w-0 text-xl font-semibold bg-transparent text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none"
          placeholder="Task title"
        />
        <button
          type="button"
          onClick={() => void handleToggleMode()}
          disabled={switching}
          title={toggleLabel}
          aria-label={`Switch to ${toggleLabel}`}
          className="shrink-0 p-1.5 rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {mode === "notes" ? (
            <CheckSquare className="w-4 h-4" />
          ) : (
            <AlignLeft className="w-4 h-4" />
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
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Press 'Enter' to add list item"
            className="flex-1 min-w-0 bg-transparent text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] border-0 border-b border-[hsl(var(--border))] rounded-none px-0 py-0.5 focus:outline-none focus:border-[hsl(var(--muted-foreground))]"
          />
        </div>
      </form>
    </div>
  );
}
