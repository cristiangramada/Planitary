import { Sparkles, Copy } from "lucide-react";

/** Static recreation of the Journal → Standup panel: date range, generate, editable output. */
export function StandupAppPreview() {
  return (
    <div
      role="img"
      aria-label="Preview of Planitary's standup generator, showing a date range and a generated summary drafted from journal entries."
      className="bg-[hsl(var(--background))] p-4 sm:p-6"
    >
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-4 h-4 text-[hsl(var(--primary))]" />
        <span className="text-sm font-semibold">Standup</span>
      </div>

      <div className="flex flex-wrap items-end gap-2.5 sm:gap-3 mb-4">
        <div>
          <p className="text-[10px] sm:text-[11px] font-medium text-[hsl(var(--muted-foreground))] mb-1">
            Start date
          </p>
          <div className="px-3 py-1.5 sm:py-2 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] text-xs">
            Mar 10
          </div>
        </div>
        <div>
          <p className="text-[10px] sm:text-[11px] font-medium text-[hsl(var(--muted-foreground))] mb-1">
            End date
          </p>
          <div className="px-3 py-1.5 sm:py-2 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] text-xs">
            Mar 14
          </div>
        </div>
        <div className="px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs font-semibold bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">
          Regenerate
        </div>
      </div>

      <div className="relative rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] p-3.5 pr-14 sm:pr-16">
        <p className="text-xs sm:text-sm leading-relaxed">
          This week I finished the project proposal, reviewed two pull requests, and shipped the
          onboarding redesign. I also planned next sprint&apos;s work and caught up on calendar
          scheduling for the team.
        </p>
        <span className="absolute top-2 right-2 h-6 sm:h-7 px-2 sm:px-2.5 rounded-md text-[11px] sm:text-xs font-semibold border border-[hsl(var(--border))] bg-[hsl(var(--card))] flex items-center gap-1.5">
          <Copy className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          Copy
        </span>
      </div>
    </div>
  );
}
