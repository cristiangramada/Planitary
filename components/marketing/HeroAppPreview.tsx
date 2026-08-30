import { CheckSquare, CalendarDays, BookOpen, LayoutDashboard, Search, Plus } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/utils/cn";

const NAV = [
  { label: "Dashboard", icon: LayoutDashboard, active: true },
  { label: "Tasks", icon: CheckSquare },
  { label: "Calendar", icon: CalendarDays },
  { label: "Journal", icon: BookOpen },
  { label: "Search", icon: Search },
];

const TASKS = [
  { title: "Finish project proposal", priority: "high" as const, done: false },
  { title: "Review pull request", priority: "medium" as const, done: true },
  { title: "Gym", priority: "low" as const, done: false },
];

const JOURNAL_ENTRIES = ["Shipped the onboarding redesign.", "Updated weekly journal."];

const CHECK_IDLE: Record<string, string> = {
  high: "border-red-500",
  medium: "border-amber-500",
  low: "border-green-500",
};
const CHECK_DONE: Record<string, string> = {
  high: "border-red-500 bg-red-500",
  medium: "border-amber-500 bg-amber-500",
  low: "border-green-500 bg-green-500",
};

/**
 * Static, non-interactive recreation of the real Planitary dashboard —
 * used as the hero's primary visual. Sample data is intentionally fictional.
 */
export function HeroAppPreview() {
  return (
    <div
      role="img"
      aria-label="Preview of the Planitary dashboard showing today's tasks, an event, and journal entries."
      className="flex h-[380px] sm:h-[440px] lg:h-[500px] text-[hsl(var(--foreground))]"
    >
      <div className="hidden sm:flex flex-col w-[168px] shrink-0 border-r border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-bg))]">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-[hsl(var(--sidebar-border))]">
          <Logo size={22} />
          <span className="text-sm font-semibold tracking-tight">Planitary</span>
        </div>
        <div className="flex-1 px-3 py-3 space-y-0.5">
          {NAV.map(({ label, icon: Icon, active }) => (
            <div
              key={label}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium",
                active
                  ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                  : "text-[hsl(var(--muted-foreground))]"
              )}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              {label}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 min-w-0 bg-[hsl(var(--background))] p-4 sm:p-6 overflow-hidden">
        <p className="text-[11px] sm:text-xs text-[hsl(var(--muted-foreground))] mb-1">Good morning, Alex</p>
        <p className="text-lg sm:text-2xl font-semibold tracking-tight mb-4 sm:mb-5">Friday, March 14</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="sm:col-span-2 flex flex-col gap-3">
            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-2.5">
                <CheckSquare className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-xs sm:text-sm font-semibold">Today&apos;s tasks</span>
              </div>
              <div className="space-y-1.5">
                {TASKS.map((t) => (
                  <div
                    key={t.title}
                    className="flex items-center gap-2.5 rounded-lg border border-[hsl(var(--border))] px-2.5 py-2"
                  >
                    <span
                      className={cn(
                        "w-3.5 h-3.5 rounded-full border-2 shrink-0",
                        t.done ? CHECK_DONE[t.priority] : CHECK_IDLE[t.priority]
                      )}
                    />
                    <span
                      className={cn(
                        "text-[11px] sm:text-xs font-medium truncate",
                        t.done && "line-through text-[hsl(var(--muted-foreground))]"
                      )}
                    >
                      {t.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-2.5">
                <CalendarDays className="w-3.5 h-3.5 text-purple-500" />
                <span className="text-xs sm:text-sm font-semibold">Today&apos;s events</span>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] px-2.5 py-2">
                <span className="text-[11px] font-medium text-[hsl(var(--muted-foreground))] w-14 shrink-0">
                  10:00 AM
                </span>
                <span className="text-[11px] sm:text-xs font-medium truncate">Team meeting</span>
              </div>
            </div>
          </div>

          <div className="hidden sm:flex flex-col gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-sm font-semibold">Journal</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-[hsl(var(--input))] px-2.5 py-2 text-[hsl(var(--muted-foreground))]">
              <Plus className="w-3 h-3" />
              <span className="text-[11px]">Add entry</span>
            </div>
            {JOURNAL_ENTRIES.map((entry) => (
              <p key={entry} className="text-[11px] leading-relaxed px-2.5 py-1.5 rounded-lg">
                {entry}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
