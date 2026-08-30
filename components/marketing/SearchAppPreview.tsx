import { Search, CheckSquare, BookOpen, CalendarDays } from "lucide-react";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { cn } from "@/utils/cn";

const QUERY = "proposal";

const TABS = [
  { label: "All", icon: Search, active: true },
  { label: "Tasks", icon: CheckSquare },
  { label: "Journal", icon: BookOpen },
  { label: "Calendar", icon: CalendarDays },
];

const RESULTS: {
  type: "Task" | "Journal" | "Calendar";
  icon: typeof CheckSquare;
  title: string;
  excerpt?: string;
  priority?: "high";
  meta: string;
}[] = [
  {
    type: "Task",
    icon: CheckSquare,
    title: "Finish project proposal",
    priority: "high",
    meta: "Active · Due Today",
  },
  {
    type: "Calendar",
    icon: CalendarDays,
    title: "Proposal review meeting",
    meta: "Mar 14 at 10:00 AM",
  },
  {
    type: "Journal",
    icon: BookOpen,
    title: "Drafted the client proposal outline",
    excerpt: "Sketched pricing tiers and a rough timeline before the sync tomorrow.",
    meta: "Mar 12",
  },
];

/** Highlights the literal query substring, matching the real highlightQuery helper. */
function highlight(text: string) {
  const idx = text.toLowerCase().indexOf(QUERY);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="text-[hsl(var(--primary))] font-semibold">
        {text.slice(idx, idx + QUERY.length)}
      </span>
      {text.slice(idx + QUERY.length)}
    </>
  );
}

/** Static recreation of the Search page: input, type tabs, and result rows. */
export function SearchAppPreview() {
  return (
    <div
      role="img"
      aria-label="Preview of Planitary Search showing results for 'proposal' across tasks, calendar, and journal."
      className="bg-[hsl(var(--background))] p-4 sm:p-6"
    >
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
        <div className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))]">
          {QUERY}
        </div>
      </div>

      <div className="flex gap-1.5 mt-3">
        {TABS.map(({ label, icon: Icon, active }) => (
          <div
            key={label}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-full",
              active
                ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                : "border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]"
            )}
          >
            <Icon className="w-3 h-3" />
            {label}
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-1">
        {RESULTS.map((r) => (
          <div key={r.title} className="flex items-start gap-3 px-2 py-2.5 rounded-xl">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[hsl(var(--muted))] shrink-0 mt-0.5">
              <r.icon className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[9px] font-semibold tracking-wide uppercase text-[hsl(var(--muted-foreground))]">
                {r.type}
              </span>
              <p className="text-xs sm:text-sm font-semibold truncate">{highlight(r.title)}</p>
              {r.excerpt && (
                <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5 truncate">
                  {r.excerpt}
                </p>
              )}
              <div className="flex items-center gap-2 mt-1">
                {r.priority && <PriorityBadge priority={r.priority} />}
                <span className="text-[11px] text-[hsl(var(--muted-foreground))]">{r.meta}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
