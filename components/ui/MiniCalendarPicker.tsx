"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { cn } from "@/utils/cn";

// ─────────────────────────────────────────────────────────────────────────────
// Date utilities (all local-time safe)
// ─────────────────────────────────────────────────────────────────────────────

function localTodayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildGrid(year: number, month: number): (number | null)[] {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid: (number | null)[] = Array(firstDow).fill(null);
  for (let i = 1; i <= daysInMonth; i++) grid.push(i);
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}

/** Format YYYY-MM-DD as "Mon, Jul 6, 2026". */
function formatDisplayDate(iso: string): string {
  const d = parseISO(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const WEEK_DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;
const MONTH_NAMES = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December",
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// MiniCalendarPicker
//
// A styled trigger button that opens a calendar popover via portal.
// Replaces <input type="date"> throughout the app.
//
// Usage:
//   <MiniCalendarPicker value={date} onChange={setDate} />
//   <MiniCalendarPicker value={date} onChange={setDate} nullable placeholder="Optional" />
// ─────────────────────────────────────────────────────────────────────────────

interface MiniCalendarPickerProps {
  value: string | null;
  onChange: (v: string | null) => void;
  /** Placeholder text shown when value is null. */
  placeholder?: string;
  /** Earliest selectable date (YYYY-MM-DD). Dates before this are disabled. */
  minDate?: string;
  /** When true, a "Clear" button appears in the popover footer. */
  nullable?: boolean;
  /** Extra classes for the trigger button. */
  className?: string;
  disabled?: boolean;
}

export function MiniCalendarPicker({
  value,
  onChange,
  placeholder = "Select date",
  minDate,
  nullable = false,
  className,
  disabled = false,
}: MiniCalendarPickerProps) {
  const [open, setOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  // Calendar navigation state — initialized when popover opens
  const [calYear, setCalYear] = useState(() => {
    if (value) { const d = parseISO(value); return d.getFullYear(); }
    return new Date().getFullYear();
  });
  const [calMonth, setCalMonth] = useState(() => {
    if (value) { const d = parseISO(value); return d.getMonth(); }
    return new Date().getMonth();
  });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  function openPicker() {
    if (disabled) return;
    if (open) { setOpen(false); return; }
    if (!triggerRef.current) return;

    // Sync calendar view to selected value (or today)
    if (value) {
      const d = parseISO(value);
      setCalYear(d.getFullYear());
      setCalMonth(d.getMonth());
    } else {
      const now = new Date();
      setCalYear(now.getFullYear());
      setCalMonth(now.getMonth());
    }

    const r = triggerRef.current.getBoundingClientRect();
    setPopoverPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 260) });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (popoverRef.current?.contains(e.target as Node)) return;
      if (triggerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    function handleScroll(e: Event) {
      if (popoverRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("scroll", handleScroll, { capture: true });
    window.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("scroll", handleScroll, { capture: true });
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  function prevMonth() {
    if (calMonth === 0) { setCalYear((y) => y - 1); setCalMonth(11); }
    else setCalMonth((m) => m - 1);
  }

  function nextMonth() {
    if (calMonth === 11) { setCalYear((y) => y + 1); setCalMonth(0); }
    else setCalMonth((m) => m + 1);
  }

  function handleSelectDay(iso: string) {
    onChange(iso);
    setOpen(false);
  }

  function handleToday() {
    const iso = localTodayISO();
    onChange(iso);
    const d = parseISO(iso);
    setCalYear(d.getFullYear());
    setCalMonth(d.getMonth());
    setOpen(false);
  }

  function handleClear() {
    onChange(null);
    setOpen(false);
  }

  const todayISO = localTodayISO();
  const grid = buildGrid(calYear, calMonth);

  return (
    <>
      {/* ── Trigger button ── */}
      <button
        ref={triggerRef}
        type="button"
        onClick={openPicker}
        disabled={disabled}
        className={cn(
          "flex items-center gap-2 w-full px-3 py-2.5 text-sm rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] transition-colors text-left",
          "hover:border-[hsl(var(--primary)/0.5)] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]",
          disabled && "opacity-40 cursor-not-allowed",
          !disabled && "cursor-pointer",
          className
        )}
      >
        <CalendarDays className="w-4 h-4 text-[hsl(var(--muted-foreground))] shrink-0" />
        <span className={value ? "text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))]"}>
          {value ? formatDisplayDate(value) : placeholder}
        </span>
      </button>

      {/* ── Popover calendar ── */}
      {open && popoverPos && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: "fixed",
              top: popoverPos.top,
              left: popoverPos.left,
              width: popoverPos.width,
              zIndex: 9999,
            }}
            className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-2xl overflow-hidden"
          >
            {/* Month navigation header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-[hsl(var(--border))]">
              <button
                type="button"
                onClick={prevMonth}
                aria-label="Previous month"
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold select-none">
                  {MONTH_NAMES[calMonth]} {calYear}
                </span>
                <button
                  type="button"
                  onClick={handleToday}
                  className="h-5 px-1.5 rounded-full border border-[hsl(var(--primary))] text-[10px] font-semibold text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))] hover:text-[hsl(var(--primary-foreground))] transition-colors leading-none cursor-pointer"
                >
                  Today
                </button>
              </div>

              <button
                type="button"
                onClick={nextMonth}
                aria-label="Next month"
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Day-of-week labels */}
            <div className="grid grid-cols-7 px-2 pt-2">
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
            <div className="grid grid-cols-7 gap-y-0.5 px-2 pb-2">
              {grid.map((day, i) => {
                if (!day) return <div key={i} className="aspect-square" />;

                const iso = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const isToday = iso === todayISO;
                const isSelected = iso === value;
                const isBefore = minDate ? iso < minDate : false;

                return (
                  <button
                    key={i}
                    type="button"
                    disabled={isBefore}
                    onClick={() => handleSelectDay(iso)}
                    aria-label={iso}
                    aria-pressed={isSelected}
                    className={cn(
                      "aspect-square text-[13px] flex items-center justify-center rounded-full transition-colors font-medium",
                      isBefore
                        ? "text-[hsl(var(--muted-foreground))/0.4] cursor-not-allowed opacity-30"
                        : isSelected
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

            {/* Footer — only when Clear is available */}
            {nullable && value && (
              <div className="flex gap-2 px-3 py-2.5 border-t border-[hsl(var(--border))]">
                <button
                  type="button"
                  onClick={handleClear}
                  className="flex-1 py-1.5 text-xs font-medium rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer"
                >
                  Clear
                </button>
              </div>
            )}
          </div>,
          document.body
        )}
    </>
  );
}
