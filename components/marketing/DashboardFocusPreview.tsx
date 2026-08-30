import { CalendarDays } from "lucide-react";
import { cn } from "@/utils/cn";

type Priority = "high" | "medium" | "low" | "none";

const TASKS: { title: string; priority: Priority; done: boolean }[] = [
  { title: "Finish project proposal", priority: "high", done: false },
  { title: "Review pull request", priority: "medium", done: true },
  { title: "Update weekly journal", priority: "low", done: false },
  { title: "Team standup", priority: "none", done: false },
];

const CHECK_IDLE: Record<Priority, string> = {
  high: "border-red-500",
  medium: "border-amber-500",
  low: "border-green-500",
  none: "border-[hsl(var(--muted-foreground))]",
};
const CHECK_DONE: Record<Priority, string> = {
  high: "border-red-500 bg-red-500",
  medium: "border-amber-500 bg-amber-500",
  low: "border-green-500 bg-green-500",
  none: "border-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted-foreground))]",
};

/** Static, focused "today" view — used for the "Do it" walkthrough step. */
export function DashboardFocusPreview() {
  return (
    <div
      role="img"
      aria-label="Preview of Planitary's focused view of today's tasks."
      className="bg-[hsl(var(--background))] p-4 sm:p-6"
    >
      <p className="text-xs text-[hsl(var(--muted-foreground))] mb-1">Good afternoon</p>
      <p className="text-lg sm:text-xl font-semibold tracking-tight mb-4">Today</p>
      <div className="space-y-2">
        {TASKS.map((t) => (
          <div
            key={t.title}
            className="flex items-center gap-3 rounded-xl border border-[hsl(var(--border))] px-3.5 py-3"
          >
            <span
              className={cn(
                "w-4 h-4 rounded-full border-2 shrink-0",
                t.done ? CHECK_DONE[t.priority] : CHECK_IDLE[t.priority]
              )}
            />
            <span
              className={cn(
                "text-sm font-medium truncate",
                t.done && "line-through text-[hsl(var(--muted-foreground))]"
              )}
            >
              {t.title}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-4 text-xs text-[hsl(var(--muted-foreground))]">
        <CalendarDays className="w-3.5 h-3.5" />
        Next: Team meeting at 2:00 PM
      </div>
    </div>
  );
}
