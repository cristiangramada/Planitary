"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { cn } from "@/utils/cn";
import type { JournalEntry } from "@/types";

interface JournalEntryRowProps {
  entry: JournalEntry;
  onSave: (id: string, content: string) => Promise<void>;
  onOpenContextMenu: (entryId: string, x: number, y: number) => void;
  highlighted?: boolean;
}

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

/**
 * Click-to-edit journal entry row — shared by the Journal page and Dashboard preview.
 */
export function JournalEntryRow({
  entry,
  onSave,
  onOpenContextMenu,
  highlighted,
}: JournalEntryRowProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(entry.content);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const touchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false);
  const caretIndexRef = useRef<number | null>(null);

  // Note: `value` only backs the input while editing — `startEdit` always
  // seeds it fresh from `entry.content`, and the read-only view below renders
  // `entry.content` directly, so no effect is needed to keep them in sync.

  useEffect(() => {
    if (!editing || !inputRef.current) return;
    const el = inputRef.current;
    el.focus();
    const len = el.value.length;
    const idx = caretIndexRef.current;
    caretIndexRef.current = null;
    if (idx != null && idx >= 0 && idx <= len) {
      el.setSelectionRange(idx, idx);
    } else {
      el.setSelectionRange(len, len);
    }
  }, [editing]);

  function startEdit(caretIndex: number | null = null) {
    if (editing || saving) return;
    caretIndexRef.current = caretIndex;
    setValue(entry.content);
    setEditing(true);
  }

  async function commitEdit() {
    if (saving) return;
    const trimmed = value.trim();

    if (!trimmed) {
      // Do not save an empty value — restore the previous content instead.
      setValue(entry.content);
      setEditing(false);
      return;
    }
    if (trimmed === entry.content.trim()) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      await onSave(entry.id, trimmed);
      setEditing(false);
    } catch {
      // Restore the previous content on failure; the page-level banner shows the error.
      setValue(entry.content);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    setValue(entry.content);
    setEditing(false);
  }

  function handleEditKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
  }

  function handleRowClick(e: React.MouseEvent) {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    startEdit(caretIndexFromPoint(e.clientX, e.clientY));
  }

  function handleRowKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (editing) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      startEdit(null);
    }
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    onOpenContextMenu(entry.id, e.clientX, e.clientY);
  }

  // Mobile fallback: long-press opens the same context menu used on desktop right-click.
  function handleTouchStart(e: React.TouchEvent) {
    const touch = e.touches[0];
    if (!touch) return;
    touchTimer.current = setTimeout(() => {
      suppressClick.current = true;
      onOpenContextMenu(entry.id, touch.clientX, touch.clientY);
    }, 550);
  }
  function clearTouchTimer() {
    if (touchTimer.current) {
      clearTimeout(touchTimer.current);
      touchTimer.current = null;
    }
  }

  return (
    <div
      id={`journal-entry-${entry.id}`}
      role={editing ? undefined : "button"}
      tabIndex={editing ? -1 : 0}
      onClick={handleRowClick}
      onKeyDown={handleRowKeyDown}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchMove={clearTouchTimer}
      onTouchEnd={clearTouchTimer}
      aria-label={editing ? undefined : `Journal entry: ${entry.content}. Press Enter to edit.`}
      className={cn(
        "px-4 py-3 rounded-xl border transition-colors cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]",
        highlighted
          ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.08)]"
          : editing
            ? "border-[hsl(var(--input))] bg-[hsl(var(--card))]"
            : "border-transparent hover:border-[hsl(var(--input))] hover:bg-[hsl(var(--card))]"
      )}
    >
      {editing ? (
        <>
          <label htmlFor={`journal-edit-${entry.id}`} className="sr-only">
            Edit journal entry
          </label>
          <input
            id={`journal-edit-${entry.id}`}
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleEditKeyDown}
            onBlur={commitEdit}
            onClick={(e) => e.stopPropagation()}
            disabled={saving}
            className="w-full bg-transparent text-sm leading-relaxed text-[hsl(var(--foreground))] cursor-text focus:outline-none disabled:opacity-60"
          />
        </>
      ) : (
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words select-none">
          <span className="cursor-text">{entry.content}</span>
        </p>
      )}
    </div>
  );
}
