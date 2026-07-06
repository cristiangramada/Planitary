"use client";

import { PickerSelect } from "./PickerSelect";
import { cn } from "@/utils/cn";

// ─────────────────────────────────────────────────────────────────────────────
// Time slot generation (30-minute increments, 12:00 AM → 11:30 PM)
// ─────────────────────────────────────────────────────────────────────────────

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

export const TIME_SLOTS = buildTimeSlots();

/** Snap an arbitrary HH:MM string to the nearest 30-minute slot value. */
export function snapToSlot(t: string): string {
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const snappedM = m < 15 ? 0 : m < 45 ? 30 : 0;
  const snappedH = m >= 45 ? (h + 1) % 24 : h;
  return `${String(snappedH).padStart(2, "0")}:${String(snappedM).padStart(2, "0")}`;
}

/** Format a HH:MM string as "h:MM AM/PM". */
export function formatTimeValue(t: string): string {
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// TimeDropdown
//
// A styled time selector that looks like a form input and opens a portal
// dropdown with 30-minute time slots.
//
// Usage:
//   <TimeDropdown value={time} onChange={setTime} />          // required time
//   <TimeDropdown value={time} onChange={setTime} nullable />  // optional time
// ─────────────────────────────────────────────────────────────────────────────

// Internal sentinel for "no time" when nullable
const NO_TIME_VALUE = "__no_time__";

type InternalValue = string; // either NO_TIME_VALUE or a HH:MM slot

interface TimeDropdownProps {
  /** HH:MM value or null (null only meaningful when nullable=true). */
  value: string | null;
  onChange: (v: string | null) => void;
  /** When true, a "No time" option appears at the top of the list. */
  nullable?: boolean;
  /** Text shown when value is null and nullable=true. */
  placeholder?: string;
  disabled?: boolean;
  /** Extra classes applied to the trigger button. */
  className?: string;
  /** Minimum dropdown width in px. */
  minWidth?: number;
}

export function TimeDropdown({
  value,
  onChange,
  nullable = false,
  placeholder = "No time",
  disabled = false,
  className,
  minWidth = 140,
}: TimeDropdownProps) {
  const snappedValue = value ? snapToSlot(value) : NO_TIME_VALUE;

  const options: { value: InternalValue; label: string }[] = [
    ...(nullable ? [{ value: NO_TIME_VALUE, label: placeholder }] : []),
    ...TIME_SLOTS,
  ];

  function handleChange(v: InternalValue) {
    onChange(v === NO_TIME_VALUE ? null : v);
  }

  return (
    <PickerSelect
      value={snappedValue as InternalValue}
      options={options}
      onChange={handleChange}
      minWidth={minWidth}
      disabled={disabled}
      className={cn(
        // Look like a form input field
        "w-full justify-between px-3 py-2.5 rounded-lg border border-[hsl(var(--input))]",
        className
      )}
    />
  );
}
