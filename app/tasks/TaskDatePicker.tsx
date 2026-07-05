"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, ChevronDown, Clock, Bell, Repeat, X } from "lucide-react";
import { cn } from "@/utils/cn";

// ─────────────────────────────────────────────────────────────────────────────
// Public types (exported so TaskForm can use them)
// ─────────────────────────────────────────────────────────────────────────────

export type ReminderOption =
  | "none"
  | "at_due"
  | "5min"
  | "15min"
  | "30min"
  | "1hr"
  | "1day";

export type RepeatOption =
  | "never"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "custom";

export interface DatePickerValue {
  /** ISO date string YYYY-MM-DD, or null for no date */
  date: string | null;
  /** HH:MM string, or null for no time */
  time: string | null;
  /** Duration mode end date — not yet persisted, reserved for future use */
  endDate: string | null;
  /** Duration mode end time — not yet persisted, reserved for future use */
  endTime: string | null;
  /** Reminder preference — stored in UI state only until DB column is added */
  reminder: ReminderOption;
  /** Repeat preference — stored in UI state only until DB column is added */
  repeat: RepeatOption;
}

export interface TaskDatePickerProps {
  initialDate?: string | null;
  initialTime?: string | null;
  initialReminder?: ReminderOption;
  initialRepeat?: RepeatOption;
  onConfirm: (value: DatePickerValue) => void;
  onClose: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const WEEK_DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

const MONTH_NAMES = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December",
] as const;

const REMINDER_OPTIONS: { value: ReminderOption; label: string }[] = [
  { value: "none",   label: "None" },
  { value: "at_due", label: "At due time" },
  { value: "5min",   label: "5 minutes before" },
  { value: "15min",  label: "15 minutes before" },
  { value: "30min",  label: "30 minutes before" },
  { value: "1hr",    label: "1 hour before" },
  { value: "1day",   label: "1 day before" },
];

const REPEAT_OPTIONS: { value: RepeatOption; label: string }[] = [
  { value: "never",   label: "Never" },
  { value: "daily",   label: "Daily" },
  { value: "weekly",  label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly",  label: "Yearly" },
  { value: "custom",  label: "Custom…" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Date utilities (local-time safe — avoids UTC shift from toISOString)
// ─────────────────────────────────────────────────────────────────────────────

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function localToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Next Saturday from today (returns today if today is Saturday). */
function thisWeekend(): Date {
  const d = localToday();
  const dow = d.getDay(); // 0 = Sun, 6 = Sat
  return addDays(d, dow === 6 ? 0 : 6 - dow);
}

/** Returns an array of (day | null) for the month grid, padded to full weeks. */
function buildMonthGrid(year: number, month: number): (number | null)[] {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid: (number | null)[] = Array(firstDow).fill(null);
  for (let i = 1; i <= daysInMonth; i++) grid.push(i);
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}

/** Parse a YYYY-MM-DD string safely in local time. */
function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// ─────────────────────────────────────────────────────────────────────────────
// CalendarHeader
// ─────────────────────────────────────────────────────────────────────────────

interface CalendarHeaderProps {
  year: number;
  month: number;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

function CalendarHeader({ year, month, onPrev, onNext, onToday }: CalendarHeaderProps) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <button
        type="button"
        onClick={onPrev}
        aria-label="Previous month"
        className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold select-none">
          {MONTH_NAMES[month]} {year}
        </span>
        <button
          type="button"
          onClick={onToday}
          aria-label="Go to today"
          className="h-5 px-1.5 rounded-full border border-[hsl(var(--primary))] text-[10px] font-semibold text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))] hover:text-[hsl(var(--primary-foreground))] transition-colors leading-none"
        >
          Today
        </button>
      </div>

      <button
        type="button"
        onClick={onNext}
        aria-label="Next month"
        className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CalendarGrid
// ─────────────────────────────────────────────────────────────────────────────

interface CalendarGridProps {
  year: number;
  month: number;
  selectedDate: string | null;
  endDate: string | null;
  onSelect: (iso: string) => void;
}

function CalendarGrid({ year, month, selectedDate, endDate, onSelect }: CalendarGridProps) {
  const todayISO = toISO(localToday());
  const grid = buildMonthGrid(year, month);

  return (
    <div className="px-3 pb-2">
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 mb-0.5">
        {WEEK_DAYS.map((d) => (
          <div
            key={d}
            className="text-center text-[11px] font-medium text-[hsl(var(--muted-foreground))] py-1"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {grid.map((day, i) => {
          if (!day) return <div key={i} className="aspect-square" />;

          const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isToday = iso === todayISO;
          const isSelected = iso === selectedDate;
          const isEnd = endDate && iso === endDate;

          // Highlight range between start and end in duration mode
          const inRange =
            endDate &&
            selectedDate &&
            iso > selectedDate &&
            iso < endDate;

          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(iso)}
              aria-label={iso}
              aria-pressed={isSelected || !!isEnd}
              className={cn(
                "aspect-square text-[13px] flex items-center justify-center rounded-full transition-colors font-medium",
                isSelected || isEnd
                  ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-semibold"
                  : inRange
                  ? "bg-[hsl(var(--primary)/0.15)] text-[hsl(var(--primary))]"
                  : isToday
                  ? "border border-[hsl(var(--primary))] text-[hsl(var(--primary))]"
                  : "text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QuickDateButtons
// ─────────────────────────────────────────────────────────────────────────────

interface QuickDateButtonsProps {
  selectedDate: string | null;
  onSelect: (iso: string) => void;
}

function QuickDateButtons({ selectedDate, onSelect }: QuickDateButtonsProps) {
  const t = localToday();
  const options = [
    { label: "Today",        iso: toISO(t) },
    { label: "Tomorrow",     iso: toISO(addDays(t, 1)) },
    { label: "This Weekend", iso: toISO(thisWeekend()) },
    { label: "Next Week",    iso: toISO(addDays(t, 7)) },
  ];

  return (
    <div className="grid grid-cols-2 gap-1.5 px-3 pb-2">
      {options.map(({ label, iso }) => (
        <button
          key={label}
          type="button"
          onClick={() => onSelect(iso)}
          className={cn(
            "px-2.5 py-2 text-xs font-medium rounded-lg border transition-all text-left",
            selectedDate === iso
              ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))]"
              : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--muted-foreground)/0.5)] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TimeSelector — 30-minute-increment dropdown (12:00 AM → 11:30 PM)
// ─────────────────────────────────────────────────────────────────────────────

/** Generate the 48 half-hour slots as { value: "HH:MM", label: "h:MM AM/PM" }. */
function buildTimeSlots(): { value: string; label: string }[] {
  const slots: { value: string; label: string }[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      const ampm = h < 12 ? "AM" : "PM";
      const h12 = h % 12 === 0 ? 12 : h % 12;
      const label = `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
      slots.push({ value, label });
    }
  }
  return slots;
}

const TIME_SLOTS = buildTimeSlots();

/** Snap an arbitrary HH:MM string to the nearest 30-minute slot value. */
function snapToSlot(t: string): string {
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const snappedM = m < 15 ? 0 : m < 45 ? 30 : 0;
  const snappedH = m >= 45 ? (h + 1) % 24 : h;
  return `${String(snappedH).padStart(2, "0")}:${String(snappedM).padStart(2, "0")}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// PickerSelect — themed dropdown that always opens downward via a portal.
// This avoids the picker's overflow-hidden clipping native <select> dropdowns.
// ─────────────────────────────────────────────────────────────────────────────

interface PickerSelectOption<T extends string> {
  value: T;
  label: string;
}

interface PickerSelectProps<T extends string> {
  value: T;
  options: PickerSelectOption<T>[];
  onChange: (v: T) => void;
  minWidth?: number;
}

function PickerSelect<T extends string>({
  value,
  options,
  onChange,
  minWidth = 140,
}: PickerSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Fix 1: toggle — if already open, close instead of reopening
  function toggleDropdown() {
    if (open) { setOpen(false); return; }
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, minWidth) });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (listRef.current?.contains(e.target as Node)) return;
      if (triggerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    // Fix 2: only close on scroll events that originate outside the list itself
    function handleScroll(e: Event) {
      if (listRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("scroll", handleScroll, { capture: true });
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("scroll", handleScroll, { capture: true });
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleDropdown}
        className="flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
      >
        <span className="whitespace-nowrap">{selected?.label ?? "—"}</span>
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 text-[hsl(var(--muted-foreground))] transition-transform shrink-0",
            open && "rotate-180"
          )}
        />
      </button>

      {open && pos && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={listRef}
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              // Fix 3: exact width (not minWidth) so content can't push the box wider
              width: pos.width,
              zIndex: 9999,
            }}
            className="max-h-56 overflow-y-auto rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-2xl py-1"
          >
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(o.value);
                  setOpen(false);
                }}
                className={cn(
                  // No whitespace-nowrap — text wraps inside the fixed-width box
                  "w-full text-left px-3 py-1.5 text-sm transition-colors",
                  o.value === value
                    ? "bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] font-medium"
                    : "hover:bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]"
                )}
              >
                {o.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TimeSelector
// ─────────────────────────────────────────────────────────────────────────────

interface TimeSelectorProps {
  value: string | null;
  onChange: (v: string | null) => void;
  label?: string;
}

function TimeSelector({ value, onChange, label = "Time" }: TimeSelectorProps) {
  const slotValue = value ? snapToSlot(value) : null;

  return (
    <div className="flex items-center justify-between px-3 py-2.5 min-h-[44px]">
      <span className="flex items-center gap-2 text-sm font-medium">
        <Clock className="w-4 h-4 text-[hsl(var(--muted-foreground))] shrink-0" />
        {label}
      </span>

      {slotValue ? (
        <div className="flex items-center gap-1">
          <PickerSelect
            value={slotValue}
            options={TIME_SLOTS}
            onChange={onChange}
            minWidth={130}
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Clear time"
            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onChange("09:00")}
          className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] px-2 py-1 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors"
        >
          No time
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ReminderSelector
// ─────────────────────────────────────────────────────────────────────────────

interface ReminderSelectorProps {
  value: ReminderOption;
  onChange: (v: ReminderOption) => void;
}

function ReminderSelector({ value, onChange }: ReminderSelectorProps) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5">
      <span className="flex items-center gap-2 text-sm font-medium">
        <Bell className="w-4 h-4 text-[hsl(var(--muted-foreground))] shrink-0" />
        Reminder
      </span>
      <PickerSelect
        value={value}
        options={REMINDER_OPTIONS}
        onChange={onChange}
        minWidth={160}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RepeatSelector
// ─────────────────────────────────────────────────────────────────────────────

interface RepeatSelectorProps {
  value: RepeatOption;
  onChange: (v: RepeatOption) => void;
}

function RepeatSelector({ value, onChange }: RepeatSelectorProps) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5">
      <span className="flex items-center gap-2 text-sm font-medium">
        <Repeat className="w-4 h-4 text-[hsl(var(--muted-foreground))] shrink-0" />
        Repeat
      </span>
      <PickerSelect
        value={value}
        options={REPEAT_OPTIONS}
        onChange={onChange}
        minWidth={120}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SchedulerFooter
// ─────────────────────────────────────────────────────────────────────────────

interface SchedulerFooterProps {
  onClear: () => void;
  onOk: () => void;
}

function SchedulerFooter({ onClear, onOk }: SchedulerFooterProps) {
  return (
    <div className="flex gap-2 px-3 py-3 border-t border-[hsl(var(--border))]">
      <button
        type="button"
        onClick={onClear}
        className="flex-1 py-2 text-sm font-medium rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors"
      >
        Clear
      </button>
      <button
        type="button"
        onClick={onOk}
        className="flex-1 py-2 text-sm font-semibold rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity"
      >
        OK
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TaskDatePicker — main exported component
// ─────────────────────────────────────────────────────────────────────────────

type Mode = "date" | "duration";

export function TaskDatePicker({
  initialDate,
  initialTime,
  initialReminder = "none",
  initialRepeat = "never",
  onConfirm,
  onClose,
}: TaskDatePickerProps) {
  // Derive starting month from initialDate, or today
  const startDate = initialDate ? parseISO(initialDate) : localToday();

  const [mode, setMode] = useState<Mode>("date");
  const [calYear, setCalYear] = useState(startDate.getFullYear());
  const [calMonth, setCalMonth] = useState(startDate.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(initialDate ?? null);
  const [selectedTime, setSelectedTime] = useState<string | null>(initialTime ?? null);
  // Duration-mode end values — not yet persisted to DB
  const [endDate, setEndDate] = useState<string | null>(null);
  const [endTime, setEndTime] = useState<string | null>(null);
  const [reminder, setReminder] = useState<ReminderOption>(initialReminder);
  const [repeat, setRepeat] = useState<RepeatOption>(initialRepeat);

  // ── Month navigation ──────────────────────────────────────────────────────

  function prevMonth() {
    if (calMonth === 0) { setCalYear((y) => y - 1); setCalMonth(11); }
    else setCalMonth((m) => m - 1);
  }

  function nextMonth() {
    if (calMonth === 11) { setCalYear((y) => y + 1); setCalMonth(0); }
    else setCalMonth((m) => m + 1);
  }

  function jumpToToday() {
    const t = localToday();
    setCalYear(t.getFullYear());
    setCalMonth(t.getMonth());
    setSelectedDate(toISO(t));
  }

  // ── Date selection ────────────────────────────────────────────────────────

  function selectDate(iso: string) {
    // Navigate the calendar to the chosen month
    const d = parseISO(iso);
    setCalYear(d.getFullYear());
    setCalMonth(d.getMonth());
    setSelectedDate(iso);
    // In duration mode, reset end when start changes
    if (mode === "duration") setEndDate(null);
  }

  function handleCalendarSelect(iso: string) {
    if (mode === "duration" && selectedDate && !endDate && iso >= selectedDate) {
      // Second click sets the end date
      setEndDate(iso);
    } else {
      selectDate(iso);
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  function handleClear() {
    onConfirm({
      date: null, time: null,
      endDate: null, endTime: null,
      reminder: "none", repeat: "never",
    });
  }

  function handleOk() {
    onConfirm({
      date: selectedDate,
      time: selectedTime,
      endDate: mode === "duration" ? endDate : null,
      endTime: mode === "duration" ? endTime : null,
      reminder,
      repeat,
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Scrim — sits above the form drawer (z-50) but below the picker (z-70) */}
      <div
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden
      />

      {/* Picker panel — centered */}
      <div
        role="dialog"
        aria-modal
        aria-label="Date and time picker"
        className="fixed z-[70] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-2xl flex flex-col overflow-hidden"
      >
        {/* ── Mode toggle + close ─────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-3 pt-3 pb-2">
          <div className="flex flex-1 p-0.5 rounded-xl bg-[hsl(var(--muted))]">
            {(["date", "duration"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  if (m === "date") { setEndDate(null); setEndTime(null); }
                }}
                className={cn(
                  "flex-1 py-1.5 text-xs font-semibold rounded-lg capitalize transition-all",
                  mode === m
                    ? "bg-[hsl(var(--background))] text-[hsl(var(--foreground))] shadow-sm"
                    : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                )}
              >
                {m === "date" ? "Date" : "Duration"}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close date picker"
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Scrollable body ─────────────────────────────────────────────── */}
        <div className="overflow-y-auto">
          {/* Quick date buttons */}
          <QuickDateButtons selectedDate={selectedDate} onSelect={selectDate} />

          {/* Calendar */}
          <CalendarHeader
            year={calYear}
            month={calMonth}
            onPrev={prevMonth}
            onNext={nextMonth}
            onToday={jumpToToday}
          />
          <CalendarGrid
            year={calYear}
            month={calMonth}
            selectedDate={selectedDate}
            endDate={mode === "duration" ? endDate : null}
            onSelect={handleCalendarSelect}
          />

          {/* Duration end section */}
          {mode === "duration" && (
            <div className="mx-3 mb-1 rounded-xl bg-[hsl(var(--muted)/0.5)] border border-[hsl(var(--border))] overflow-hidden">
              <div className="px-3 pt-2.5 pb-1">
                <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-2">
                  End date
                </p>
                <input
                  type="date"
                  value={endDate ?? ""}
                  min={selectedDate ?? undefined}
                  onChange={(e) => setEndDate(e.target.value || null)}
                  className="w-full text-sm px-2.5 py-1.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))] transition"
                />
                {!selectedDate && (
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1.5">
                    Select a start date first.
                  </p>
                )}
                {selectedDate && !endDate && (
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1.5">
                    Click a date on the calendar, or enter it above.
                  </p>
                )}
              </div>
              <div className="border-t border-[hsl(var(--border))]">
                <TimeSelector
                  label="End time"
                  value={endTime}
                  onChange={endDate ? setEndTime : () => {}}
                />
                {!endDate && (
                  <p className="px-3 pb-2 text-[11px] text-[hsl(var(--muted-foreground))]">
                    Set an end date to enable end time.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── Scheduling rows ──────────────────────────────────────────── */}
          <div className="border-t border-[hsl(var(--border))] mt-1">
            <TimeSelector value={selectedTime} onChange={setSelectedTime} />
            <div className="border-t border-[hsl(var(--border))]">
              <ReminderSelector value={reminder} onChange={setReminder} />
            </div>
            <div className="border-t border-[hsl(var(--border))]">
              <RepeatSelector value={repeat} onChange={setRepeat} />
            </div>
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <SchedulerFooter onClear={handleClear} onOk={handleOk} />
      </div>
    </>
  );
}
