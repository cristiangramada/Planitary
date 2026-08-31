import { Plus } from "lucide-react";
import { PriorityBadge } from "@/components/ui/PriorityBadge";

const ENTRIES = [
  "Shipped the onboarding redesign — cleaner first-run experience.",
  "Fixed a sync bug reported by two users.",
  "Reviewed the calendar pull request.",
];

const COMPLETED: { title: string; priority: "high" | "medium" }[] = [
  { title: "Finish project proposal", priority: "high" },
  { title: "Review pull request", priority: "medium" },
];

/** Static recreation of the Journal view — quick add, completed tasks, entries. */
export function JournalAppPreview() {
  return (
    <div
      role="img"
      aria-label="Preview of the Planitary Journal with daily entries and completed tasks."
      className="bg-[hsl(var(--background))] p-4 sm:p-6"
    >
      <div className="flex items-center gap-1.5 rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-4 py-3 text-[hsl(var(--muted-foreground))]">
        <Plus className="w-3.5 h-3.5" />
        <span className="text-sm">Add entry</span>
      </div>

      <div className="flex flex-wrap gap-2 pt-3 pb-1">
        {COMPLETED.map((c) => (
          <span
            key={c.title}
            className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-[hsl(var(--border))] pl-2.5 pr-1.5 py-1 text-[11px] text-[hsl(var(--muted-foreground))]"
          >
            {c.title}
            <PriorityBadge priority={c.priority} />
          </span>
        ))}
      </div>

      <div className="divide-y divide-[hsl(var(--border))] mt-1">
        {ENTRIES.map((entry) => (
          <p key={entry} className="px-1 py-3 text-sm leading-relaxed">
            {entry}
          </p>
        ))}
      </div>
    </div>
  );
}
