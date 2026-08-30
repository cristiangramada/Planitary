import { CheckSquare, CalendarDays, BookOpen, Search, ListChecks, Repeat } from "lucide-react";

const ITEMS = [
  { icon: CheckSquare, label: "Tasks & Lists", description: "Organize work into lists with priorities and due dates." },
  { icon: CalendarDays, label: "Calendar", description: "Month, week, and day views alongside your tasks." },
  { icon: BookOpen, label: "Journal", description: "Daily entries you can turn into a standup." },
  { icon: Search, label: "Search", description: "Find any task, event, or entry instantly." },
  { icon: ListChecks, label: "Weekly Standups", description: "Draft summaries from your own journal entries." },
  { icon: Repeat, label: "Recurring Tasks", description: "Set it once, let it repeat on schedule." },
];

/** Compact capability list — rows and thin dividers, not another card grid. */
export function FeatureStrip() {
  return (
    <div className="divide-y divide-[hsl(var(--border))] border-y border-[hsl(var(--border))]">
      {ITEMS.map(({ icon: Icon, label, description }) => (
        <div key={label} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-5 py-4 sm:py-5">
          <div className="flex items-center gap-2.5 sm:w-44 shrink-0">
            <Icon className="w-4 h-4 text-[hsl(var(--primary))] shrink-0" />
            <span className="text-sm font-medium">{label}</span>
          </div>
          <span className="text-sm text-[hsl(var(--muted-foreground))]">{description}</span>
        </div>
      ))}
    </div>
  );
}
