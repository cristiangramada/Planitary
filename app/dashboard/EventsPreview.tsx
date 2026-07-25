"use client";

import { useState } from "react";
import { CalendarDays, Plus } from "lucide-react";
import type { CalendarEvent } from "@/types";
import { AgendaItemContextMenu } from "@/app/calendar/AgendaItemContextMenu";
import { DashboardSection, DashboardSkeletonRows, DashboardEmptyState } from "./DashboardSection";

interface EventsPreviewProps {
  events: CalendarEvent[];
  error: string | null;
  loading: boolean;
  onRetry: () => void;
  onOpenEvent: (event: CalendarEvent) => void;
  onDeleteEvent: (eventId: string) => void;
  onCreateEvent: () => void;
}

const PREVIEW_LIMIT = 6;

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function isHappeningNow(event: CalendarEvent): boolean {
  const now = Date.now();
  const start = new Date(event.start_time).getTime();
  const end = event.end_time ? new Date(event.end_time).getTime() : start + 60 * 60 * 1000;
  return now >= start && now < end;
}

export function EventsPreview({
  events,
  error,
  loading,
  onRetry,
  onOpenEvent,
  onDeleteEvent,
  onCreateEvent,
}: EventsPreviewProps) {
  const visible = events.slice(0, PREVIEW_LIMIT);
  const [itemMenu, setItemMenu] = useState<{
    x: number;
    y: number;
    onEdit: () => void;
    onDelete: () => void;
  } | null>(null);

  function openItemMenu(e: React.MouseEvent, event: CalendarEvent) {
    e.preventDefault();
    e.stopPropagation();
    setItemMenu({
      x: e.clientX,
      y: e.clientY,
      onEdit: () => onOpenEvent(event),
      onDelete: () => onDeleteEvent(event.id),
    });
  }

  return (
    <DashboardSection
      icon={CalendarDays}
      iconClassName="text-purple-500"
      title="Today's events"
      headerAction={
        <button
          type="button"
          onClick={onCreateEvent}
          className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-3 h-3" />
          Add event
        </button>
      }
      error={error}
      onRetry={onRetry}
      loading={loading}
    >
      {loading ? (
        <DashboardSkeletonRows count={3} />
      ) : visible.length === 0 ? (
        <DashboardEmptyState message="No events scheduled today." />
      ) : (
        <div className="space-y-1.5">
          {visible.map((event) => {
            const now = isHappeningNow(event);
            return (
              <button
                key={event.id}
                type="button"
                onClick={() => onOpenEvent(event)}
                onContextMenu={(e) => openItemMenu(e, event)}
                className="flex items-center gap-3 w-full text-left px-3 py-2 rounded-lg border border-[hsl(var(--border))] hover:border-[hsl(var(--primary)/0.4)] transition-colors cursor-pointer"
              >
                <div className="flex flex-col items-start shrink-0 w-16">
                  <span className="text-xs font-medium">{fmtTime(event.start_time)}</span>
                  {event.end_time && (
                    <span className="text-[11px] text-[hsl(var(--muted-foreground))]">
                      {fmtTime(event.end_time)}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{event.title}</p>
                  {event.details && (
                    <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">
                      {event.details}
                    </p>
                  )}
                </div>
                {now && (
                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.1)] px-2 py-0.5 rounded-full">
                    Now
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {itemMenu && (
        <AgendaItemContextMenu
          x={itemMenu.x}
          y={itemMenu.y}
          kind="event"
          onEdit={itemMenu.onEdit}
          onDelete={itemMenu.onDelete}
          onClose={() => setItemMenu(null)}
        />
      )}
    </DashboardSection>
  );
}
