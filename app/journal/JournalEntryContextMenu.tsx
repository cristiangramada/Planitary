"use client";

import { useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";

interface JournalEntryContextMenuProps {
  x: number;
  y: number;
  onDelete: () => void;
  onClose: () => void;
}

/**
 * Right-click / long-press menu for a journal entry row.
 * Mirrors the positioning, outside-click, and Escape-key behavior of
 * CalendarDayContextMenu (app/calendar/CalendarDayContextMenu.tsx) so the
 * interaction feels identical across the app, without modifying that file.
 */
export function JournalEntryContextMenu({
  x,
  y,
  onDelete,
  onClose,
}: JournalEntryContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const menuWidth = 110;
  const left = Math.min(x, window.innerWidth - menuWidth - 8);
  const top = Math.min(y, window.innerHeight - 56);

  return (
    <div
      ref={ref}
      className="fixed z-50 w-max rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-xl overflow-hidden"
      style={{ left, top }}
      role="menu"
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onDelete();
          onClose();
        }}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-left whitespace-nowrap text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
      >
        <Trash2 className="w-4 h-4 shrink-0" />
        Delete
      </button>
    </div>
  );
}
