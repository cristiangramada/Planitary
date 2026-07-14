"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { cn } from "@/utils/cn";

// ─────────────────────────────────────────────────────────────────────────────
// Generic themed dropdown that always opens downward via a portal.
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
