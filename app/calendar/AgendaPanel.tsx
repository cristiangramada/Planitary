"use client";

import { useState, useMemo } from "react";
import { Calendar, CheckSquare, Plus, type LucideIcon } from "lucide-react";
import { cn } from "@/utils/cn";
import { fmt12, parseDate, toLocalDate } from "./calendarUtils";
import { AgendaItemContextMenu } from "./AgendaItemContextMenu";
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

type ItemMenuState = {
  kind: "task" | "event";
  x: number;
  y: number;
  onEdit: () => void;
  onDelete: () => void;
};

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
  const [itemMenu, setItemMenu] = useState<ItemMenuState | null>(null);

  const heading = useMemo(() => {
    const d = parseDate(selectedDay);
    const weekday = `${d.toLocaleDateString("en-US", { weekday: "long" })},`;
    const month = d.toLocaleDateString("en-US", { month: "long" });
    const day = d.getDate();
    const monthDay = `${month}\u00A0${day}`;
    return { weekday, monthDay };
  }, [selectedDay]);

  const dayTasks = useMemo(() => {
    return tasks
      .filter((t) => t.due_date === selectedDay)
      .sort((a, b) => {
        const aKey = a.due_time ?? "23:59:59";
        const bKey = b.due_time ?? "23:59:59";
        return aKey.localeCompare(bKey);
      });
  }, [tasks, selectedDay]);

  const dayEvents = useMemo(() => {
    return events
      .filter((e) => toLocalDate(e.start_time) === selectedDay)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [events, selectedDay]);

  function openItemMenu(
    e: React.MouseEvent,
    kind: "task" | "event",
    onEdit: () => void,
    onDelete: () => void
  ) {
    e.preventDefault();
    e.stopPropagation();
    setItemMenu({ kind, x: e.clientX, y: e.clientY, onEdit, onDelete });
  }

  return (
    <section className="h-full flex flex-col min-h-0">
      <div className="shrink-0 mb-3">
        <h3 className="flex flex-col gap-1.5 min-w-0 text-lg font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide leading-none">
          <span>{heading.weekday}</span>
          <span className="whitespace-nowrap">{heading.monthDay}</span>
        </h3>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 min-h-0 flex flex-col border-b border-[hsl(var(--border))] pb-3 mb-3">
          <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              Events
            </h4>
            <button
              type="button"
              onClick={() => onNewEvent(selectedDay)}
              className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3 h-3" />
              Add event
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {dayEvents.length === 0 ? (
              <EmptySection icon={Calendar} label="No events" />
            ) : (
              dayEvents.map((event) => (
                <EventAgendaItem
                  key={event.id}
                  event={event}
                  onContextMenu={(e) =>
                    openItemMenu(
                      e,
                      "event",
                      () => onEditEvent(event),
                      () => onDeleteEvent(event.id)
                    )
                  }
                />
              ))
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              Tasks
            </h4>
            <button
              type="button"
              onClick={() => onNewTask(selectedDay)}
              className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3 h-3" />
              Add task
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {dayTasks.length === 0 ? (
              <EmptySection icon={CheckSquare} label="No tasks" />
            ) : (
              dayTasks.map((task) => (
                <TaskAgendaItem
                  key={task.id}
                  task={task}
                  onContextMenu={(e) =>
                    openItemMenu(
                      e,
                      "task",
                      () => onEditTask(task),
                      () => onDeleteTask(task.id)
                    )
                  }
                />
              ))
            )}
          </div>
        </div>
      </div>

      {itemMenu && (
        <AgendaItemContextMenu
          x={itemMenu.x}
          y={itemMenu.y}
          kind={itemMenu.kind}
          onEdit={itemMenu.onEdit}
          onDelete={itemMenu.onDelete}
          onClose={() => setItemMenu(null)}
        />
      )}
    </section>
  );
}

function EmptySection({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 py-6 rounded-xl border border-dashed border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] h-full min-h-[4.5rem]">
      <Icon className="w-5 h-5 opacity-40" />
      <p className="text-xs">{label}</p>
    </div>
  );
}

function EventAgendaItem({
  event,
  onContextMenu,
}: {
  event: CalendarEvent;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onContextMenu={onContextMenu}
      className="flex items-start gap-3 p-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:bg-[hsl(var(--muted)/0.4)] transition-colors"
    >
      <span className="w-8 h-8 rounded-full bg-[hsl(var(--primary)/0.12)] flex items-center justify-center shrink-0 mt-0.5">
        <Calendar className="w-4 h-4 text-[hsl(var(--primary))]" />
      </span>
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
    </div>
  );
}

function TaskAgendaItem({
  task,
  onContextMenu,
}: {
  task: TaskWithDetails;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const isDone = task.status === "completed";

  return (
    <div
      onContextMenu={onContextMenu}
      className={cn(
        "flex items-start gap-3 p-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:bg-[hsl(var(--muted)/0.4)] transition-colors",
        isDone && "opacity-60"
      )}
    >
      <span className="w-8 h-8 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center shrink-0 mt-0.5">
        <CheckSquare
          className={cn(
            "w-4 h-4",
            isDone ? "text-emerald-500" : "text-[hsl(var(--muted-foreground))]"
          )}
        />
      </span>
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
    </div>
  );
}
