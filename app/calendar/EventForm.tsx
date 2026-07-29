"use client";

import { useState, useEffect } from "react";
import { X, AlertCircle } from "lucide-react";
import { MiniCalendarPicker } from "@/components/ui/MiniCalendarPicker";
import { TimeDropdown } from "@/components/ui/TimeDropdown";
import type { CalendarEvent } from "@/types";
import type { EventFormData } from "@/lib/calendar";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Split a UTC ISO timestamp into local YYYY-MM-DD and HH:MM. */
function parseToLocal(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return { date, time };
}

function todayLocalDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Round up to the next half-hour slot from now. */
function nextHalfHour(): string {
  const d = new Date();
  const m = d.getMinutes();
  if (m < 30) return `${String(d.getHours()).padStart(2, "0")}:30`;
  const h = (d.getHours() + 1) % 24;
  return `${String(h).padStart(2, "0")}:00`;
}

/** Add 60 minutes to a HH:MM string. */
function addOneHour(t: string): string {
  const [hStr, mStr] = t.split(":");
  const h = (parseInt(hStr, 10) + 1) % 24;
  return `${String(h).padStart(2, "0")}:${mStr}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface EventFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: EventFormData) => Promise<void>;
  editEvent?: CalendarEvent | null;
  /** Pre-fill start date when creating from a specific day. */
  defaultDate?: string | null;
  /** Pre-fill start time when creating from a double-clicked time slot. */
  defaultTime?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Inner body — keyed by editEvent?.id so state fully resets on event switch
// ─────────────────────────────────────────────────────────────────────────────

interface BodyProps extends EventFormProps {
  isEdit: boolean;
}

function EventFormBody({
  onClose,
  onSave,
  editEvent,
  isEdit,
  defaultDate,
  defaultTime,
}: BodyProps) {
  const [title, setTitle] = useState(editEvent?.title ?? "");
  const [details, setDetails] = useState(editEvent?.details ?? "");

  const [startDate, setStartDate] = useState<string | null>(() =>
    editEvent ? parseToLocal(editEvent.start_time).date : (defaultDate ?? todayLocalDate())
  );
  const [startTime, setStartTime] = useState<string>(() => {
    if (editEvent) return parseToLocal(editEvent.start_time).time;
    if (defaultTime) return defaultTime;
    return nextHalfHour();
  });
  const [endDate, setEndDate] = useState<string | null>(() =>
    editEvent?.end_time ? parseToLocal(editEvent.end_time).date : null
  );
  const [endTime, setEndTime] = useState<string | null>(() =>
    editEvent?.end_time ? parseToLocal(editEvent.end_time).time : null
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // When end date is cleared, also clear end time
  function handleEndDateChange(v: string | null) {
    setEndDate(v);
    if (!v) {
      setEndTime(null);
    } else if (!endTime) {
      // Auto-fill end time as 1 hour after start
      setEndTime(addOneHour(startTime));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !startDate) return;
    setError(null);
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        details: details.trim() || null,
        start_date: startDate,
        start_time: startTime,
        end_date: endDate,
        end_time: endDate ? endTime : null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save event.");
    } finally {
      setSaving(false);
    }
  }

  const labelCls =
    "block text-xs font-medium mb-1.5 text-[hsl(var(--muted-foreground))] uppercase tracking-wide";

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal
        aria-label={isEdit ? "Edit event" : "New event"}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg flex flex-col bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-2xl shadow-2xl max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))] shrink-0">
          <h2 className="text-base font-semibold">
            {isEdit ? "Edit event" : "New event"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <form
          id="event-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-5 py-5 space-y-5"
        >
          {/* Title */}
          <div>
            <label className={labelCls}>
              Title <span className="text-red-500">*</span>
            </label>
            <input
              autoFocus
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What's happening?"
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] focus:outline-none transition"
            />
          </div>

          {/* Details */}
          <div>
            <label className={labelCls}>Details</label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Add any details or notes…"
              rows={3}
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] focus:outline-none transition resize-none"
            />
          </div>

          {/* Start */}
          <div>
            <label className={labelCls}>
              Start <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <MiniCalendarPicker
                value={startDate}
                onChange={setStartDate}
                placeholder="Pick a date"
              />
              <TimeDropdown
                value={startTime}
                onChange={(v) => setStartTime(v ?? nextHalfHour())}
                minWidth={150}
              />
            </div>
          </div>

          {/* End (optional) */}
          <div>
            <label className={labelCls}>
              End{" "}
              <span className="text-[hsl(var(--muted-foreground))] normal-case font-normal">
                (optional)
              </span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <MiniCalendarPicker
                value={endDate}
                onChange={handleEndDateChange}
                placeholder="No end date"
                minDate={startDate ?? undefined}
                nullable
              />
              <TimeDropdown
                value={endTime}
                onChange={setEndTime}
                nullable
                placeholder="No time"
                disabled={!endDate}
                minWidth={150}
              />
            </div>
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
            form="event-form"
            disabled={saving || !title.trim() || !startDate}
            className="flex-1 py-2.5 text-sm font-semibold rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity cursor-pointer"
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create event"}
          </button>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Public export — key resets body state on each editEvent/defaultDate change
// ─────────────────────────────────────────────────────────────────────────────

export function EventForm(props: EventFormProps) {
  if (!props.open) return null;
  return (
    <EventFormBody
      key={`${props.editEvent?.id ?? "new"}-${props.defaultDate}-${props.defaultTime}`}
      {...props}
      isEdit={!!props.editEvent}
    />
  );
}
