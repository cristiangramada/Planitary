"use client";

import { useState } from "react";
import { Search, CheckSquare, CalendarDays, BookOpen } from "lucide-react";

const FILTER_TYPES = [
  { label: "All", value: "all" },
  { label: "Tasks", value: "task", icon: CheckSquare },
  { label: "Events", value: "event", icon: CalendarDays },
  { label: "Journal", value: "journal", icon: BookOpen },
] as const;

type FilterType = (typeof FILTER_TYPES)[number]["value"];

export function SearchInput() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");

  const hasQuery = query.trim().length > 0;

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tasks, events, journal entries…"
          className="w-full pl-10 pr-4 py-3 text-sm rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] transition"
          autoFocus
        />
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {FILTER_TYPES.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              filter === value
                ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                : "border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Results area */}
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] min-h-48">
        {!hasQuery ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="w-8 h-8 text-[hsl(var(--muted-foreground))] mb-3" />
            <p className="text-sm font-medium">Start typing to search</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
              Search across all your tasks, calendar events, and journal entries.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              No results for &ldquo;{query}&rdquo;
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
