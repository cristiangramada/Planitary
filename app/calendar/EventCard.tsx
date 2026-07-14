"use client";

import { useState, useRef, useEffect } from "react";
import { Pencil, Trash2, Clock, CalendarDays } from "lucide-react";
import { cn } from "@/utils/cn";
import type { CalendarEvent } from "@/types";

interface EventCardProps {
  event: CalendarEvent;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (eventId: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Time formatting helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmt12(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function fmtRange(event: CalendarEvent): string {
  const start = fmt12(event.start_time);
  if (!event.end_time) return start;
  return `${start} – ${fmt12(event.end_time)}`;
}

function isSameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// ─────────────────────────────────────────────────────────────────────────────
// EventCard
// ─────────────────────────────────────────────────────────────────────────────

export function EventCard({ event, onEdit, onDelete }: EventCardProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const confirmRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!confirmingDelete) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setConfirmingDelete(false);
    }
    function onOutside(e: MouseEvent) {
      if (confirmRef.current && !confirmRef.current.contains(e.target as Node)) {
        setConfirmingDelete(false);
      }
    }
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onOutside);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onOutside);
    };
  }, [confirmingDelete]);

  const multiDay =
    event.end_time && !isSameDay(event.start_time, event.end_time);

  return (
    <div className="group flex items-start gap-3 p-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--primary)/0.4)] transition-colors">
      {/* Left accent */}
      <div className="w-0.5 self-stretch rounded-full bg-[hsl(var(--primary))] shrink-0" />

      {/* Content */}
      <div className="flex-1 min-w-0 select-none cursor-default">
        <p className="text-sm font-medium leading-snug">{event.title}</p>

        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          <span className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
            <Clock className="w-3 h-3 shrink-0" />
            {fmtRange(event)}
          </span>
          {multiDay && (
            <span className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
              <CalendarDays className="w-3 h-3 shrink-0" />
              {fmtDate(event.start_time)} – {fmtDate(event.end_time!)}
            </span>
          )}
        </div>

        {event.details && (
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1.5 line-clamp-2 leading-relaxed">
            {event.details}
          </p>
        )}
      </div>

      {/* Actions */}
      <div
        ref={confirmRef}
        className={cn(
          "relative flex items-center gap-1 shrink-0 transition-opacity",
          confirmingDelete ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
      >
        <button
          onClick={() => onEdit(event)}
          title="Edit event"
          className="p-1.5 rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setConfirmingDelete(true)}
          title="Delete event"
          className={cn(
            "p-1.5 rounded-md transition-colors cursor-pointer",
            confirmingDelete
              ? "bg-red-500/10 text-red-500"
              : "text-[hsl(var(--muted-foreground))] hover:bg-red-500/10 hover:text-red-500"
          )}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        {/* Delete confirmation popover */}
        {confirmingDelete && (
          <div className="absolute right-0 top-full mt-2 z-20 w-52 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-xl p-3">
            <p className="text-sm font-medium mb-3">Delete this event?</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="flex-1 py-1.5 text-xs font-medium rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmingDelete(false);
                  onDelete(event.id);
                }}
                className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
