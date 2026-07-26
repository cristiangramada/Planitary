"use client";

import { useEffect, useRef, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Flag } from "lucide-react";
import { cn } from "@/utils/cn";
import type { Priority } from "@/types";

export const PRIORITY_OPTIONS: {
  value: Priority;
  label: string;
  flagClass: string;
  filled: boolean;
}[] = [
  { value: "high", label: "High", flagClass: "text-red-500", filled: true },
  { value: "medium", label: "Medium", flagClass: "text-amber-500", filled: true },
  { value: "low", label: "Low", flagClass: "text-green-600 dark:text-green-500", filled: true },
  { value: "none", label: "None", flagClass: "text-[hsl(var(--muted-foreground))]", filled: false },
];

function priorityMeta(priority: Priority) {
  return (
    PRIORITY_OPTIONS.find((p) => p.value === priority) ??
    PRIORITY_OPTIONS.find((p) => p.value === "none")!
  );
}

export function PriorityFlag({
  priority,
  className,
}: {
  priority: Priority;
  className?: string;
}) {
  const meta = priorityMeta(priority);
  return (
    <Flag
      className={cn(className, meta.flagClass)}
      fill={meta.filled ? "currentColor" : "none"}
    />
  );
}

export function PriorityMenu({
  x,
  y,
  current,
  ignoreCloseRef,
  onSelect,
  onClose,
}: {
  /** Right edge of the flag button (viewport coords). */
  x: number;
  /** Bottom edge of the flag button (viewport coords). */
  y: number;
  current: Priority;
  ignoreCloseRef: RefObject<HTMLElement | null>;
  onSelect: (p: Priority) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const menuHeight = 188;
  const top =
    y + menuHeight > window.innerHeight - 8
      ? Math.max(8, window.innerHeight - menuHeight - 8)
      : y;
  const right = Math.max(8, window.innerWidth - x);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if (ignoreCloseRef.current?.contains(target)) return;
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
  }, [onClose, ignoreCloseRef]);

  return createPortal(
    <div
      ref={ref}
      role="menu"
      className="fixed z-50 w-max rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-xl overflow-hidden"
      style={{ right, top }}
    >
      {PRIORITY_OPTIONS.map((p) => (
        <button
          key={p.value}
          type="button"
          role="menuitem"
          onClick={() => onSelect(p.value)}
          className={cn(
            "flex w-full items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer whitespace-nowrap",
            current === p.value && "font-medium"
          )}
        >
          <PriorityFlag priority={p.value} className="w-4 h-4 shrink-0" />
          {p.label}
        </button>
      ))}
    </div>,
    document.body
  );
}
