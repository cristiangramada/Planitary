import { CheckSquare, CalendarDays, BookOpen } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { formatDate, formatTime } from "@/utils/date";
import type { SearchResult } from "@/types/search";
import { highlightQuery, stripHighlightMarks } from "./highlightText";

const TYPE_CONFIG: Record<SearchResult["entityType"], { label: string; icon: LucideIcon }> = {
  task: { label: "Task", icon: CheckSquare },
  journal: { label: "Journal", icon: BookOpen },
  calendar: { label: "Calendar", icon: CalendarDays },
};

function formatDueTime(dueTime: string): string {
  return formatTime(`1970-01-01T${dueTime}`);
}

function metadataParts(result: SearchResult): string[] {
  const parts: string[] = [];
  if (result.entityType === "task") {
    if (result.status) parts.push(result.status === "completed" ? "Completed" : "Active");
    if (result.resultDate) {
      parts.push(`Due ${formatDate(result.resultDate)}${result.dueTime ? ` at ${formatDueTime(result.dueTime)}` : ""}`);
    }
  } else if (result.entityType === "journal") {
    if (result.resultDate) parts.push(formatDate(result.resultDate));
  } else if (result.entityType === "calendar") {
    if (result.startTime) {
      const time = result.endTime
        ? `${formatTime(result.startTime)} – ${formatTime(result.endTime)}`
        : formatTime(result.startTime);
      parts.push(`${formatDate(result.startTime)} at ${time}`);
    }
  }
  return parts;
}

interface SearchResultRowProps {
  result: SearchResult;
  query: string;
  onOpen: (result: SearchResult) => void;
}

export function SearchResultRow({ result, query, onOpen }: SearchResultRowProps) {
  const { label, icon: Icon } = TYPE_CONFIG[result.entityType];
  const metadata = metadataParts(result);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(result)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(result);
        }
      }}
      aria-label={`${label}: ${result.title}`}
      className="flex items-start gap-3 px-4 py-3 rounded-xl border border-transparent hover:border-[hsl(var(--input))] hover:bg-[hsl(var(--card))] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]"
    >
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[hsl(var(--muted))] shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-[hsl(var(--muted-foreground))]" aria-hidden="true" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[10px] font-semibold tracking-wide uppercase text-[hsl(var(--muted-foreground))]">
            {label}
          </span>
          {result.entityType === "task" && result.listName && (
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
              · {result.listName}
            </span>
          )}
        </div>

        <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate">
          {/* Prefer literal query highlighting over ts_headline marks: FTS
              stemming wraps the whole word (e.g. query "chill" → <mark>chilled</mark>). */}
          {highlightQuery(stripHighlightMarks(result.title), query)}
        </p>

        {result.excerpt && (
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 line-clamp-2 break-words">
            {highlightQuery(stripHighlightMarks(result.excerpt), query)}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5">
          {result.priority && <PriorityBadge priority={result.priority} />}
          {metadata.map((part, i) => (
            <span key={i} className="text-xs text-[hsl(var(--muted-foreground))]">
              {i > 0 && <span className="mr-2 opacity-50">·</span>}
              {part}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
