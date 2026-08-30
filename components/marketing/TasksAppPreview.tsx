import { Inbox, Calendar } from "lucide-react";
import { cn } from "@/utils/cn";

const LISTS = [
  { name: "Work", count: 4, active: true },
  { name: "Personal", count: 1 },
];

type Priority = "high" | "medium" | "low" | "none";

const TASKS: { title: string; priority: Priority; due: string | null }[] = [
  { title: "Finish project proposal", priority: "high", due: "Today" },
  { title: "Review pull request", priority: "medium", due: "Today" },
  { title: "Plan sprint retro", priority: "none", due: null },
  { title: "Update weekly journal", priority: "low", due: "Fri" },
];

/** Matches the real TaskCard: priority is shown by the checkbox border color, not a flag. */
const CHECK_CLASS: Record<Priority, string> = {
  high: "border-red-500",
  medium: "border-amber-500",
  low: "border-green-600",
  none: "border-[hsl(var(--muted-foreground))]",
};

/** Static recreation of the Tasks view — lists sidebar + a task list. */
export function TasksAppPreview() {
  return (
    <div
      role="img"
      aria-label="Preview of the Planitary Tasks view with lists and a task list."
      className="flex h-[300px] sm:h-[340px] text-[hsl(var(--foreground))]"
    >
      <div className="hidden sm:flex flex-col w-[152px] shrink-0 border-r border-[hsl(var(--border))] bg-[hsl(var(--sidebar-bg))] p-3 gap-0.5">
        <div className="flex items-center gap-2 px-2 py-1.5 text-[13px] text-[hsl(var(--muted-foreground))]">
          <Inbox className="w-3.5 h-3.5" /> Inbox
        </div>
        <p className="px-2 pt-2 pb-1 text-[10px] font-medium text-[hsl(var(--muted-foreground))]">Lists</p>
        {LISTS.map((l) => (
          <div
            key={l.name}
            className={cn(
              "flex items-center justify-between px-2 py-1.5 rounded-lg text-[13px]",
              l.active ? "bg-[hsl(var(--muted))] font-medium" : "text-[hsl(var(--muted-foreground))]"
            )}
          >
            {l.name}
            <span className="text-[11px] text-[hsl(var(--muted-foreground))]">{l.count}</span>
          </div>
        ))}
      </div>
      <div className="flex-1 min-w-0 bg-[hsl(var(--background))] p-4 sm:p-5 space-y-2">
        {TASKS.map((t) => (
          <div
            key={t.title}
            className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3.5 py-3"
          >
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 shrink-0 mt-0.5",
                  CHECK_CLASS[t.priority]
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium truncate">{t.title}</p>
                {t.due && (
                  <div className="flex items-center gap-1 mt-1.5 text-[11px] text-[hsl(var(--muted-foreground))]">
                    <Calendar className="w-3 h-3" />
                    {t.due}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
