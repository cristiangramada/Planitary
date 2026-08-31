import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/utils/cn";

const WEEK_DAYS = ["S", "M", "T", "W", "T", "F", "S"];

/** [day, chip] — chip is a task (dot colored by priority) or an event (primary chip). */
type Chip = { kind: "event"; label: string } | { kind: "task"; label: string; priority: string };

/** March 2026 — the 1st falls on a Sunday. */
const GRID: (number | null)[] = [
  1, 2, 3, 4, 5, 6, 7,
  8, 9, 10, 11, 12, 13, 14,
  15, 16, 17, 18, 19, 20, 21,
  22, 23, 24, 25, 26, 27, 28,
  29, 30, 31, null, null, null, null,
];

const CHIPS: Record<number, Chip[]> = {
  9: [{ kind: "task", label: "Finish proposal", priority: "high" }],
  14: [{ kind: "event", label: "10:00 Team meeting" }, { kind: "task", label: "Gym", priority: "low" }],
  22: [{ kind: "task", label: "Review PR", priority: "medium" }],
};

const TODAY = 14;

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-green-500",
};

/** Static recreation of the Calendar month view. */
export function CalendarAppPreview() {
  return (
    <div
      role="img"
      aria-label="Preview of the Planitary Calendar in month view with a few events and due tasks."
      className="bg-[hsl(var(--background))] p-3 sm:p-4"
    >
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1">
          <ChevronLeft className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
          <ChevronRight className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
          <span className="text-xs sm:text-sm font-semibold ml-1">March 2026</span>
        </div>
        <div className="hidden sm:flex p-0.5 rounded-lg bg-[hsl(var(--muted))]">
          <span className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-[hsl(var(--background))]">
            Month
          </span>
          <span className="px-2.5 py-1 text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
            Week
          </span>
          <span className="px-2.5 py-1 text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
            Day
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-[hsl(var(--border))] overflow-hidden">
        <div className="grid grid-cols-7 bg-[hsl(var(--muted)/0.5)] border-b border-[hsl(var(--border))]">
          {WEEK_DAYS.map((d, i) => (
            <div
              key={i}
              className="text-center text-[9px] sm:text-[10px] font-semibold text-[hsl(var(--muted-foreground))] py-1 uppercase"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 divide-x divide-[hsl(var(--border))]">
          {GRID.map((day, i) => (
            <div
              key={i}
              className={cn(
                "h-11 sm:h-14 px-1 pt-1 border-t border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden",
                i < 7 && "border-t-0",
                !day && "bg-[hsl(var(--muted)/0.4)]"
              )}
            >
              {day && (
                <>
                  <span
                    className={cn(
                      "flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 rounded-full text-[9px] sm:text-[10px] font-medium",
                      day === TODAY
                        ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-bold"
                        : "text-[hsl(var(--foreground))]"
                    )}
                  >
                    {day}
                  </span>
                  <div className="mt-0.5 space-y-0.5">
                    {(CHIPS[day] ?? []).slice(0, 2).map((chip, ci) =>
                      chip.kind === "event" ? (
                        <div
                          key={ci}
                          className="hidden sm:flex items-center gap-0.5 rounded bg-[hsl(var(--primary)/0.15)] px-0.5 text-[8px] leading-tight text-[hsl(var(--primary))] truncate"
                        >
                          <span className="w-1 h-1 rounded-full bg-[hsl(var(--primary))] shrink-0" />
                          <span className="truncate">{chip.label}</span>
                        </div>
                      ) : (
                        <div
                          key={ci}
                          className="hidden sm:flex items-center gap-0.5 rounded bg-[hsl(var(--muted))] px-0.5 text-[8px] leading-tight truncate"
                        >
                          <span
                            className={cn("w-1 h-1 rounded-full shrink-0", PRIORITY_DOT[chip.priority])}
                          />
                          <span className="truncate">{chip.label}</span>
                        </div>
                      )
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
