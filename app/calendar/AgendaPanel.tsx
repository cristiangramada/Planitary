"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Calendar, CheckSquare, Clock, Plus, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/utils/cn";
import { fmt12, fmtDayShort, parseDate, toLocalDate, localTodayStr } from "./calendarUtils";
import type { CalendarEvent, TaskWithDetails } from "@/types";

// ─── Priority styles ──────────────────────────────────────────────────────────
const PRIORITY_PILL: Record<string, string> = {
  high:   "bg-red-500/10 text-red-600 dark:text-red-400",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  low:    "bg-green-500/10 text-green-600 dark:text-green-500",
};
const PRIORITY_DOT: Record<string, string> = {
  high:   "bg-red-500",
  medium: "bg-amber-500",
  low:    "bg-green-500",
};

// ─── Types ────────────────────────────────────────────────────────────────────
type AgendaItem =
  | { kind: "event"; event: CalendarEvent; sortKey: string }
  | { kind: "task"; task: TaskWithDetails; sortKey: string };

interface AgendaPanelProps {
  selectedDay: string;
  events: CalendarEvent[];
  tasks: TaskWithDetails[];
  onEditEvent: (event: CalendarEvent) => void;
  onEditTask: (task: TaskWithDetails) => void;
  onDeleteEvent: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onNewEvent: (date: string) => void;
  onNewTask: (date: string) => void;
}

export function AgendaPanel({
  selectedDay,
  events,
  tasks,
  onEditEvent,
  onEditTask,
  onDeleteEvent,
  onDeleteTask,
  onNewEvent,
  onNewTask,
}: AgendaPanelProps) {
  const todayStr = localTodayStr();

  const heading = useMemo(() => {
    if (selectedDay === todayStr) return "Today";
    const d = parseDate(selectedDay);
    return fmtDayShort(d);
  }, [selectedDay, todayStr]);

  const items = useMemo((): AgendaItem[] => {
    const dayEvents: AgendaItem[] = events
      .filter((e) => toLocalDate(e.start_time) === selectedDay)
      .map((e) => ({ kind: "event", event: e, sortKey: e.start_time }));

    const dayTasks: AgendaItem[] = tasks
      .filter((t) => t.due_date === selectedDay)
      .map((t) => ({
        kind: "task",
        task: t,
        sortKey: t.due_time
          ? `${selectedDay}T${t.due_time}`
          : `${selectedDay}T23:59:59`,
      }));

    return [...dayEvents, ...dayTasks].sort((a, b) =>
      a.sortKey.localeCompare(b.sortKey)
    );
  }, [events, tasks, selectedDay]);

  return (
    <section className="mt-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
          {heading}
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNewEvent(selectedDay)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add event
          </button>
          <button
            type="button"
            onClick={() => onNewTask(selectedDay)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add task
          </button>
        </div>
      </div>

      {/* ── List ── */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 rounded-xl border border-dashed border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]">
          <Clock className="w-8 h-8 opacity-40" />
          <p className="text-sm">Nothing scheduled for this day.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) =>
            item.kind === "event" ? (
              <EventAgendaItem
                key={item.event.id}
                event={item.event}
                onEdit={() => onEditEvent(item.event)}
                onDelete={() => onDeleteEvent(item.event.id)}
              />
            ) : (
              <TaskAgendaItem
                key={item.task.id}
                task={item.task}
                onEdit={() => onEditTask(item.task)}
                onDelete={() => onDeleteTask(item.task.id)}
              />
            )
          )}
        </div>
      )}
    </section>
  );
}

// ─── Event row ────────────────────────────────────────────────────────────────

function EventAgendaItem({
  event,
  onEdit,
  onDelete,
}: {
  event: CalendarEvent;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const confirmRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!confirmingDelete) return;
    function handleOutside(e: MouseEvent) {
      if (confirmRef.current && !confirmRef.current.contains(e.target as Node)) {
        setConfirmingDelete(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setConfirmingDelete(false);
    }
    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("keydown", handleKey);
    };
  }, [confirmingDelete]);

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:bg-[hsl(var(--muted)/0.4)] transition-colors group">
      {/* Icon */}
      <span className="w-8 h-8 rounded-full bg-[hsl(var(--primary)/0.12)] flex items-center justify-center shrink-0 mt-0.5">
        <Calendar className="w-4 h-4 text-[hsl(var(--primary))]" />
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0 select-none cursor-default">
        <p className="text-sm font-medium leading-snug truncate">{event.title}</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
          {fmt12(event.start_time)}
          {event.end_time && ` – ${fmt12(event.end_time)}`}
        </p>
        {event.details && (
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 truncate opacity-80">
            {event.details}
          </p>
        )}
      </div>

      {/* Action buttons — revealed on hover */}
      <div
        className={cn(
          "relative flex items-center gap-1 shrink-0 transition-opacity",
          confirmingDelete ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
      >
        {/* Edit */}
        <button
          type="button"
          onClick={onEdit}
          title="Edit event"
          className="p-1.5 rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>

        {/* Delete */}
        <button
          type="button"
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
          <div
            ref={confirmRef}
            className="absolute right-0 top-full mt-2 z-20 w-48 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-xl p-3"
          >
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
                onClick={() => { setConfirmingDelete(false); onDelete(); }}
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

// ─── Task row ─────────────────────────────────────────────────────────────────

function TaskAgendaItem({
  task,
  onEdit,
  onDelete,
}: {
  task: TaskWithDetails;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const confirmRef = useRef<HTMLDivElement>(null);
  const isDone = task.status === "completed";

  useEffect(() => {
    if (!confirmingDelete) return;
    function handleOutside(e: MouseEvent) {
      if (confirmRef.current && !confirmRef.current.contains(e.target as Node)) {
        setConfirmingDelete(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setConfirmingDelete(false);
    }
    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("keydown", handleKey);
    };
  }, [confirmingDelete]);

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:bg-[hsl(var(--muted)/0.4)] transition-colors group",
        isDone && "opacity-60"
      )}
    >
      {/* Icon */}
      <span className="w-8 h-8 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center shrink-0 mt-0.5">
        <CheckSquare
          className={cn(
            "w-4 h-4",
            isDone ? "text-emerald-500" : "text-[hsl(var(--muted-foreground))]"
          )}
        />
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0 select-none cursor-default">
        <p
          className={cn(
            "text-sm font-medium leading-snug truncate",
            isDone && "line-through text-[hsl(var(--muted-foreground))]"
          )}
        >
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full capitalize",
              PRIORITY_PILL[task.priority]
            )}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", PRIORITY_DOT[task.priority])} />
            {task.priority}
          </span>
          {task.due_time && (
            <span className="text-[11px] text-[hsl(var(--muted-foreground))]">
              {task.due_time.slice(0, 5)}
            </span>
          )}
          {task.tags.slice(0, 2).map((tag) => (
            <span
              key={tag.id}
              className="text-[11px] px-1.5 py-0.5 rounded-full bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
            >
              {tag.name}
            </span>
          ))}
        </div>
      </div>

      {/* Action buttons — revealed on hover */}
      <div
        ref={confirmRef}
        className={cn(
          "relative flex items-center gap-1 shrink-0 transition-opacity",
          confirmingDelete ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
      >
        <button
          type="button"
          onClick={onEdit}
          title="Edit task"
          className="p-1.5 rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setConfirmingDelete(true)}
          title="Delete task"
          className={cn(
            "p-1.5 rounded-md transition-colors cursor-pointer",
            confirmingDelete
              ? "bg-red-500/10 text-red-500"
              : "text-[hsl(var(--muted-foreground))] hover:bg-red-500/10 hover:text-red-500"
          )}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        {confirmingDelete && (
          <div className="absolute right-0 top-full mt-2 z-20 w-48 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-xl p-3">
            <p className="text-sm font-medium mb-3">Delete this task?</p>
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
                  onDelete();
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
