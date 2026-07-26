"use client";

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { ChevronLeft, ChevronRight, Clock, Repeat, X } from "lucide-react";
import { cn } from "@/utils/cn";
import { PickerSelect } from "@/components/ui/PickerSelect";
import { TIME_SLOTS, snapToSlot } from "@/components/ui/TimeDropdown";

// ─────────────────────────────────────────────────────────────────────────────
// Public types (exported so TaskForm can use them)
// ─────────────────────────────────────────────────────────────────────────────

export type RepeatOption =
  | "never"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly";

export interface DatePickerValue {
  /** ISO date string YYYY-MM-DD, or null for no date */
  date: string | null;
  /** HH:MM string, or null for no time */
  time: string | null;
  /** Repeat preference — stored in UI state only until DB column is added */
  repeat: RepeatOption;
}

export interface TaskDatePickerProps {
  initialDate?: string | null;
  initialTime?: string | null;
  initialRepeat?: RepeatOption;
  onConfirm: (value: DatePickerValue) => void;
  onClose: () => void;
  /** Top edge of the panel sits flush under the trigger.
   *  `x` is the left edge when align is "start", or the right edge when align is "end". */
  anchor?: { x: number; y: number };
  /** Horizontal alignment of the panel relative to `anchor.x`. Defaults to "start". */
  anchorAlign?: "start" | "end";
  /** When set, clicks on this element do not count as "outside" (lets the trigger toggle-close). */
  ignoreCloseRef?: RefObject<HTMLElement | null>;
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

const REPEAT_OPTIONS: { value: RepeatOption; label: string }[] = [
  { value: "never",   label: "Never" },
  { value: "daily",   label: "Daily" },
  { value: "weekly",  label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly",  label: "Yearly" },
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
  onSelect: (iso: string) => void;
}

function CalendarGrid({ year, month, selectedDate, onSelect }: CalendarGridProps) {
  const todayISO = toISO(localToday());
  const grid = buildMonthGrid(year, month);

  return (
    <div className="px-3 pb-2">
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

      <div className="grid grid-cols-7 gap-y-0.5">
        {grid.map((day, i) => {
          if (!day) return <div key={i} className="aspect-square" />;

          const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isToday = iso === todayISO;
          const isSelected = iso === selectedDate;

          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(iso)}
              aria-label={iso}
              aria-pressed={isSelected}
              className={cn(
                "aspect-square text-[13px] flex items-center justify-center rounded-full transition-colors font-medium",
                isSelected
                  ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-semibold"
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

export function TaskDatePicker({
  initialDate,
  initialTime,
  initialRepeat = "never",
  onConfirm,
  onClose,
  anchor,
  anchorAlign = "start",
  ignoreCloseRef,
}: TaskDatePickerProps) {
  const startDate = initialDate ? parseISO(initialDate) : localToday();
  const panelRef = useRef<HTMLDivElement>(null);

  const [calYear, setCalYear] = useState(startDate.getFullYear());
  const [calMonth, setCalMonth] = useState(startDate.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(initialDate ?? null);
  const [selectedTime, setSelectedTime] = useState<string | null>(initialTime ?? null);
  const [repeat, setRepeat] = useState<RepeatOption>(initialRepeat);

  const panelWidth = 320;
  const panelHeightEstimate = 480;
  const gap = 4;
  const pad = 8;
  const [fittedStyle, setFittedStyle] = useState<
    { left: number; top: number } | undefined
  >(undefined);

  const anchoredStyle = anchor
    ? fittedStyle ?? {
        left:
          anchorAlign === "end"
            ? Math.max(pad, anchor.x - panelWidth)
            : Math.max(pad, Math.min(anchor.x, window.innerWidth - panelWidth - pad)),
        top: Math.max(pad, anchor.y + gap),
      }
    : undefined;

  // After paint, snap the panel fully into the viewport without covering the trigger.
  useLayoutEffect(() => {
    if (!anchor || !panelRef.current) {
      setFittedStyle(undefined);
      return;
    }
    const el = panelRef.current;
    const h = el.offsetHeight || panelHeightEstimate;
    const w = el.offsetWidth || panelWidth;
    const trigger = ignoreCloseRef?.current?.getBoundingClientRect() ?? null;
    const triggerBottom = trigger?.bottom ?? anchor.y;
    const triggerTop = trigger?.top ?? anchor.y;
    const triggerLeft = trigger?.left ?? anchor.x;
    const triggerRight = trigger?.right ?? anchor.x;

    let nextLeft =
      anchorAlign === "end" ? anchor.x - w : anchor.x;
    let nextTop = triggerBottom + gap;

    const fitsBelow = nextTop + h <= window.innerHeight - pad;
    const aboveTop = triggerTop - h - gap;
    const fitsAbove = aboveTop >= pad;

    if (!fitsBelow && fitsAbove) {
      nextTop = aboveTop;
    } else if (!fitsBelow && !fitsAbove) {
      // Open beside the trigger so the button stays clickable.
      const rightLeft = triggerRight + gap;
      const leftLeft = triggerLeft - w - gap;
      if (rightLeft + w <= window.innerWidth - pad) {
        nextLeft = rightLeft;
      } else if (leftLeft >= pad) {
        nextLeft = leftLeft;
      } else {
        nextLeft = Math.max(pad, Math.min(nextLeft, window.innerWidth - w - pad));
      }
      nextTop = Math.max(pad, Math.min(triggerTop, window.innerHeight - h - pad));
    }

    nextLeft = Math.max(pad, Math.min(nextLeft, window.innerWidth - w - pad));
    nextTop = Math.max(pad, Math.min(nextTop, window.innerHeight - h - pad));

    // Last guard: if we still overlap the trigger, push fully below or above.
    if (trigger) {
      const overlaps =
        nextLeft < triggerRight &&
        nextLeft + w > triggerLeft &&
        nextTop < triggerBottom + gap &&
        nextTop + h > triggerTop - gap;
      if (overlaps) {
        if (fitsAbove || triggerTop - pad >= h + gap) {
          nextTop = triggerTop - h - gap;
        } else {
          nextTop = triggerBottom + gap;
        }
        nextTop = Math.max(pad, Math.min(nextTop, window.innerHeight - h - pad));
      }
    }

    setFittedStyle({ left: nextLeft, top: nextTop });
  }, [anchor, anchorAlign, ignoreCloseRef]);

  // Anchored mode: leave the trigger hoverable/clickable (no blocking scrim).
  // Close on outside mousedown, but ignore the trigger so it can toggle-close.
  useEffect(() => {
    if (!anchor) return;

    function onOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (ignoreCloseRef?.current?.contains(target)) return;
      // Time/repeat lists portal outside the panel.
      if ((e.target as Element | null)?.closest?.("[data-picker-select-list]")) return;
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onOutside);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      window.removeEventListener("keydown", onKey);
    };
  }, [anchor, ignoreCloseRef, onClose]);

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

  function selectDate(iso: string) {
    const d = parseISO(iso);
    setCalYear(d.getFullYear());
    setCalMonth(d.getMonth());
    setSelectedDate(iso);
  }

  function handleClear() {
    onConfirm({ date: null, time: null, repeat: "never" });
  }

  function handleOk() {
    onConfirm({
      date: selectedDate,
      time: selectedTime,
      repeat,
    });
  }

  return (
    <>
      {/* Centered (modal) mode keeps a blocking scrim. Anchored mode does not —
          the trigger stays interactive so it can hover and toggle-close. */}
      {!anchor && (
        <div
          className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[1px]"
          onClick={onClose}
          aria-hidden
        />
      )}

      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        aria-label="Date and time picker"
        className={cn(
          "fixed z-[70] w-[320px] rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-2xl flex flex-col overflow-hidden",
          !anchor && "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        )}
        style={anchoredStyle}
      >
        <div className="overflow-y-auto pt-2">
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
            onSelect={selectDate}
          />

          <div className="border-t border-[hsl(var(--border))] mt-1">
            <TimeSelector value={selectedTime} onChange={setSelectedTime} />
            <div className="border-t border-[hsl(var(--border))]">
              <RepeatSelector value={repeat} onChange={setRepeat} />
            </div>
          </div>
        </div>

        <SchedulerFooter onClear={handleClear} onOk={handleOk} />
      </div>
    </>
  );
}
