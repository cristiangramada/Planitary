"use client";

import { useState } from "react";
import { Search, CheckSquare, CalendarDays, BookOpen } from "lucide-react";

const FILTER_TYPES = [
  { label: "All",     value: "all" },
  { label: "Tasks",   value: "task",    icon: CheckSquare },
  { label: "Events",  value: "event",   icon: CalendarDays },
  { label: "Journal", value: "journal", icon: BookOpen },
] as const;

type FilterType = (typeof FILTER_TYPES)[number]["value"];

export function SearchInput() {
  const [query, setQuery]   = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const hasQuery = query.trim().length > 0;

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Search bar */}
      <div className="relative shrink-0">
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
      <div className="flex gap-2 flex-wrap shrink-0">
        {FILTER_TYPES.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors cursor-pointer ${
              filter === value
                ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                : "border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Results area — fills remaining height */}
      <div className="flex-1 min-h-0 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {!hasQuery ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <Search className="w-8 h-8 text-[hsl(var(--muted-foreground))] mb-3 opacity-40" />
            <p className="text-sm font-medium">Start typing to search</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
              Search across all your tasks, calendar events, and journal entries.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              No results for &ldquo;{query}&rdquo;
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
