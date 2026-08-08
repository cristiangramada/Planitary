"use client";

import { useRef } from "react";
import { cn } from "@/utils/cn";

type ColumnResizeHandleProps = {
  className?: string;
  /** Capture starting widths before deltas are applied. */
  onDragStart?: () => void;
  /** Called with horizontal delta from the pointer-down position. */
  onDrag: (deltaFromStart: number) => void;
  "aria-label"?: string;
};

/**
 * Vertical drag handle between Tasks page columns.
 * Hit target is wider than the 1px rule for easier grabbing.
 */
export function ColumnResizeHandle({
  className,
  onDragStart,
  onDrag,
  "aria-label": ariaLabel = "Resize panels",
}: ColumnResizeHandleProps) {
  const draggingRef = useRef(false);
  const startXRef = useRef(0);

  function endDrag(target: HTMLElement, pointerId: number) {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (target.hasPointerCapture(pointerId)) {
      target.releasePointerCapture(pointerId);
    }
    document.body.style.removeProperty("cursor");
    document.body.style.removeProperty("user-select");
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      tabIndex={0}
      className={cn(
        "group relative z-10 w-2 shrink-0 self-stretch cursor-col-resize touch-none",
        className
      )}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        draggingRef.current = true;
        startXRef.current = e.clientX;
        onDragStart?.();
        e.currentTarget.setPointerCapture(e.pointerId);
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
      }}
      onPointerMove={(e) => {
        if (!draggingRef.current) return;
        onDrag(e.clientX - startXRef.current);
      }}
      onPointerUp={(e) => endDrag(e.currentTarget, e.pointerId)}
      onPointerCancel={(e) => endDrag(e.currentTarget, e.pointerId)}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors",
          "bg-[hsl(var(--border))]",
          "group-hover:bg-[hsl(var(--muted-foreground))]/55",
          "group-active:bg-[hsl(var(--muted-foreground))]/70"
        )}
      />
    </div>
  );
}
