import { Inbox, Flag } from "lucide-react";
import { cn } from "@/utils/cn";

const LISTS = [
  { name: "Work", count: 4, active: true },
  { name: "Personal", count: 1 },
];

type Priority = "high" | "medium" | "low" | "none";

const TASKS: { title: string; priority: Priority; due: string }[] = [
  { title: "Finish project proposal", priority: "high", due: "Today" },
  { title: "Review pull request", priority: "medium", due: "Today" },
  { title: "Plan sprint retro", priority: "none", due: "Tomorrow" },
  { title: "Update weekly journal", priority: "low", due: "Fri" },
];

const FLAG_CLASS: Record<Priority, string> = {
  high: "text-red-500",
  medium: "text-amber-500",
  low: "text-green-500",
  none: "text-[hsl(var(--muted-foreground))]",
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
            className="flex items-center gap-3 rounded-xl border border-[hsl(var(--border))] px-3 py-2.5"
          >
            <span className="w-4 h-4 rounded-full border-2 border-[hsl(var(--muted-foreground))] shrink-0" />
            <span className="flex-1 text-xs sm:text-sm font-medium truncate">{t.title}</span>
            {t.priority !== "none" && (
              <Flag className={cn("w-3 h-3 shrink-0", FLAG_CLASS[t.priority])} fill="currentColor" />
            )}
            <span className="text-[11px] text-[hsl(var(--muted-foreground))] shrink-0">{t.due}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
