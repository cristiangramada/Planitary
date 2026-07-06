"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/utils/cn";

export type CalView = "month" | "week" | "day";

interface CalendarHeaderProps {
  label: string;
  view: CalView;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewChange: (v: CalView) => void;
}

export function CalendarHeader({
  label,
  view,
  onPrev,
  onNext,
  onToday,
  onViewChange,
}: CalendarHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-[hsl(var(--border))] shrink-0">
      {/* ── Left: navigation ── */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onPrev}
          aria-label="Previous"
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onNext}
          aria-label="Next"
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <h2 className="text-base font-semibold select-none whitespace-nowrap ml-1">
          {label}
        </h2>

        <button
          type="button"
          onClick={onToday}
          className="ml-1 h-7 px-3 rounded-full border border-[hsl(var(--border))] text-xs font-semibold text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))] transition-colors cursor-pointer shrink-0"
        >
          Today
        </button>
      </div>

      {/* ── Right: view switcher ── */}
      <div className="flex p-0.5 rounded-xl bg-[hsl(var(--muted))]">
        {(["month", "week", "day"] as CalView[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onViewChange(v)}
            className={cn(
              "px-4 py-1.5 text-sm font-medium rounded-[10px] capitalize transition-all",
              view === v
                ? "bg-[hsl(var(--background))] text-[hsl(var(--foreground))] shadow-sm cursor-default"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] cursor-pointer"
            )}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}
