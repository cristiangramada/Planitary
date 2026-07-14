"use client";

import { useEffect, useRef } from "react";
import { CalendarDays, CheckSquare } from "lucide-react";

interface CalendarDayContextMenuProps {
  x: number;
  y: number;
  onAddEvent: () => void;
  onAddTask: () => void;
  onClose: () => void;
}

export function CalendarDayContextMenu({
  x,
  y,
  onAddEvent,
  onAddTask,
  onClose,
}: CalendarDayContextMenuProps) {
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

  const menuWidth = 168;
  const left = Math.min(x, window.innerWidth - menuWidth - 8);
  const top = Math.min(y, window.innerHeight - 96);

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[168px] rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-xl overflow-hidden"
      style={{ left, top }}
      role="menu"
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onAddEvent();
          onClose();
        }}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-left hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer"
      >
        <CalendarDays className="w-4 h-4 text-[hsl(var(--primary))] shrink-0" />
        Add event
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onAddTask();
          onClose();
        }}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-left hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer"
      >
        <CheckSquare className="w-4 h-4 text-emerald-500 shrink-0" />
        Add task
      </button>
    </div>
  );
}
