"use client";

import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { cn } from "@/utils/cn";

// ─────────────────────────────────────────────────────────────────────────────
// Generic themed dropdown that opens via a portal and stays in the viewport.
// Avoids overflow-hidden clipping that breaks native <select> dropdowns.
// ─────────────────────────────────────────────────────────────────────────────

export interface PickerSelectOption<T extends string> {
  value: T;
  label: string;
}

export interface PickerSelectProps<T extends string> {
  value: T;
  options: PickerSelectOption<T>[];
  onChange: (v: T) => void;
  /** Minimum width for the dropdown list (px). Defaults to 140. */
  minWidth?: number;
  /** Extra classes for the trigger button. */
  className?: string;
  disabled?: boolean;
}

/** Matches `max-h-56` on the list panel. */
const LIST_MAX_HEIGHT = 224;

function fitDropdownPos(
  trigger: DOMRect,
  width: number,
  height: number
): { top: number; left: number; width: number } {
  const gap = 4;
  const pad = 8;
  let top = trigger.bottom + gap;
  if (top + height > window.innerHeight - pad) {
    const above = trigger.top - height - gap;
    top = above >= pad ? above : Math.max(pad, window.innerHeight - height - pad);
  }
  let left = trigger.left;
  left = Math.max(pad, Math.min(left, window.innerWidth - width - pad));
  return { top, left, width };
}

export function PickerSelect<T extends string>({
  value,
  options,
  onChange,
  minWidth = 140,
  className,
  disabled = false,
}: PickerSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  function toggleDropdown() {
    if (disabled) return;
    if (open) {
      setOpen(false);
      return;
    }
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const width = Math.max(r.width, minWidth);
    const estimatedH = Math.min(options.length * 32 + 8, LIST_MAX_HEIGHT);
    setPos(fitDropdownPos(r, width, estimatedH));
    setOpen(true);
  }

  // After paint, re-fit using the list's real height.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !listRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const width = Math.max(r.width, minWidth);
    const h = Math.min(listRef.current.offsetHeight || LIST_MAX_HEIGHT, LIST_MAX_HEIGHT);
    setPos(fitDropdownPos(r, width, h));
  }, [open, minWidth, options.length]);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (listRef.current?.contains(e.target as Node)) return;
      if (triggerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
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
        disabled={disabled}
        className={cn(
          "flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
          className
        )}
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
              width: pos.width,
              zIndex: 9999,
            }}
            className="max-h-56 overflow-y-auto rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-2xl py-1"
            data-picker-select-list
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
