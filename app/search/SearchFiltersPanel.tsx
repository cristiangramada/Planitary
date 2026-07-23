"use client";

import { X } from "lucide-react";
import { MiniCalendarPicker } from "@/components/ui/MiniCalendarPicker";
import { PickerSelect } from "@/components/ui/PickerSelect";
import { cn } from "@/utils/cn";
import type { Priority, TaskStatus } from "@/types";
import { hasActiveFilters, type SearchFilters, type SearchSortMode } from "@/types/search";

const TASK_STATUS_OPTIONS: { value: "all" | TaskStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
];

const SORT_OPTIONS: { value: SearchSortMode; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
];

const PRIORITY_OPTIONS: Priority[] = ["high", "medium", "low"];

interface SearchFiltersPanelProps {
  filters: SearchFilters;
  sortMode: SearchSortMode;
  onFiltersChange: (filters: SearchFilters) => void;
  onSortModeChange: (mode: SearchSortMode) => void;
}

export function SearchFiltersPanel({
  filters,
  sortMode,
  onFiltersChange,
  onSortModeChange,
}: SearchFiltersPanelProps) {
  function togglePriority(priority: Priority) {
    const next = filters.priorities.includes(priority)
      ? filters.priorities.filter((p) => p !== priority)
      : [...filters.priorities, priority];
    onFiltersChange({ ...filters, priorities: next });
  }

  function clearFilters() {
    onFiltersChange({ entityTypes: filters.entityTypes, startDate: null, endDate: null, taskStatus: null, priorities: [] });
  }

  const showTaskFilters = filters.entityTypes.length === 0 || filters.entityTypes.includes("task");

  return (
    <div className="flex w-max flex-nowrap items-end gap-3 py-3">
      {/* Date range */}
      <div className="flex items-end gap-2 shrink-0">
        <div>
          <label htmlFor="search-start-date" className="block text-[11px] font-medium text-[hsl(var(--muted-foreground))] mb-1">
            From
          </label>
          <MiniCalendarPicker
            value={filters.startDate}
            onChange={(v) =>
              onFiltersChange({
                ...filters,
                startDate: v,
                // Keep the range valid if From moves past the current To.
                endDate: v && filters.endDate && filters.endDate < v ? v : filters.endDate,
              })
            }
            placeholder="Any"
            nullable
            className="w-[12.25rem]"
          />
        </div>
        <div>
          <label htmlFor="search-end-date" className="block text-[11px] font-medium text-[hsl(var(--muted-foreground))] mb-1">
            To
          </label>
          <MiniCalendarPicker
            value={filters.endDate}
            onChange={(v) => onFiltersChange({ ...filters, endDate: v })}
            placeholder="Any"
            nullable
            minDate={filters.startDate ?? undefined}
            className="w-[12.25rem]"
          />
        </div>
      </div>

      {/* Task status — only meaningful when Tasks can appear */}
      {showTaskFilters && (
        <div className="shrink-0">
          <span className="block text-[11px] font-medium text-[hsl(var(--muted-foreground))] mb-1">
            Task status
          </span>
          <PickerSelect
            value={filters.taskStatus ?? "all"}
            options={TASK_STATUS_OPTIONS}
            onChange={(v) => onFiltersChange({ ...filters, taskStatus: v === "all" ? null : v })}
            minWidth={120}
          />
        </div>
      )}

      {/* Priority — only meaningful when Tasks can appear */}
      {showTaskFilters && (
        <div className="shrink-0">
          <span className="block text-[11px] font-medium text-[hsl(var(--muted-foreground))] mb-1">
            Priority
          </span>
          <div className="flex gap-1" role="group" aria-label="Filter by priority">
            {PRIORITY_OPTIONS.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={filters.priorities.includes(p)}
                onClick={() => togglePriority(p)}
                className={cn(
                  "px-2.5 h-9 text-xs font-medium rounded-lg border transition-colors cursor-pointer capitalize",
                  filters.priorities.includes(p)
                    ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] border-[hsl(var(--primary))]"
                    : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sort */}
      <div className="shrink-0">
        <span className="block text-[11px] font-medium text-[hsl(var(--muted-foreground))] mb-1">Sort</span>
        <PickerSelect value={sortMode} options={SORT_OPTIONS} onChange={onSortModeChange} minWidth={130} />
      </div>

      {hasActiveFilters(filters) && (
        <button
          type="button"
          onClick={clearFilters}
          className="flex shrink-0 items-center gap-1 h-9 px-3 text-xs font-medium rounded-lg whitespace-nowrap text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
          Clear filters
        </button>
      )}
    </div>
  );
}
