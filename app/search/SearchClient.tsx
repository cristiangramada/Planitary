"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, CheckSquare, CalendarDays, BookOpen, Loader2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/client";
import { runSearch, buildSearchParams, parseSearchState, SEARCH_PAGE_SIZE } from "@/lib/search";
import { cn } from "@/utils/cn";
import type {
  SearchEntityType,
  SearchFilters,
  SearchQueryState,
  SearchResult,
  SearchSortMode,
} from "@/types/search";
import { SearchFiltersPanel } from "./SearchFiltersPanel";
import { SearchResultRow } from "./SearchResultRow";
import { useDebouncedValue } from "./useDebouncedValue";

const DEBOUNCE_MS = 300;

const TYPE_TABS: { value: SearchEntityType | "all"; label: string; icon: typeof Search }[] = [
  { value: "all", label: "All", icon: Search },
  { value: "task", label: "Tasks", icon: CheckSquare },
  { value: "journal", label: "Journal", icon: BookOpen },
  { value: "calendar", label: "Calendar", icon: CalendarDays },
];

type LoadStatus = "idle" | "loading" | "loading-more" | "error";

export function SearchClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlState = useMemo(() => parseSearchState(searchParams), [searchParams]);

  // Fast-typing input is local state; it's debounced into the URL (which is
  // the single source of truth that actually drives the search request).
  const [inputValue, setInputValue] = useState(urlState.query);
  const debouncedInput = useDebouncedValue(inputValue, DEBOUNCE_MS);

  const [results, setResults] = useState<SearchResult[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const requestIdRef = useRef(0);
  // Last query *we* wrote to the URL. Distinguishes our debounce/replace
  // navigations from external ones (back/forward, shared links).
  const lastWrittenQueryRef = useRef(urlState.query);
  const inputFocusedRef = useRef(false);

  // Mirror URL → input only for *external* navigation. Never clobber the
  // field while the user is typing: router.replace from the debounce can
  // resolve after Ctrl+Backspace / retype, and a naive sync would paste the
  // stale URL query back into the box (delete → reappear → delete again).
  useEffect(() => {
    if (inputFocusedRef.current) return;
    if (urlState.query === lastWrittenQueryRef.current) return;
    /* eslint-disable react-hooks/set-state-in-effect -- mirror external URL navigation into the input */
    lastWrittenQueryRef.current = urlState.query;
    setInputValue(urlState.query);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [searchParams, urlState.query]);

  // Debounced typing updates the URL (replace — avoids a history entry per keystroke).
  useEffect(() => {
    if (debouncedInput === urlState.query) return;
    updateUrl({ ...urlState, query: debouncedInput }, "replace");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedInput]);

  function updateUrl(nextState: SearchQueryState, mode: "push" | "replace") {
    lastWrittenQueryRef.current = nextState.query;
    const params = buildSearchParams(nextState);
    const href = params.toString() ? `/search?${params.toString()}` : "/search";
    if (mode === "push") router.push(href, { scroll: false });
    else router.replace(href, { scroll: false });
  }

  const { query, filters, sortMode } = urlState;
  const entityTypesKey = filters.entityTypes.join(",");
  const prioritiesKey = filters.priorities.join(",");

  // ---------------------------------------------------------------------------
  // Run the search whenever the *URL-derived* query/filters/sort change.
  // Pagination always resets to page 1 here; "Load more" appends separately.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const trimmed = query.trim();
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    if (!trimmed) {
      /* eslint-disable react-hooks/set-state-in-effect -- reset results synchronously when the query is cleared, from a URL navigation */
      setResults([]);
      setHasMore(false);
      setStatus("idle");
      setError(null);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }

    setStatus("loading");
    setError(null);
    const supabase = createClient();

    runSearch(supabase, { query: trimmed, filters, sortMode, offset: 0 })
      .then(({ results: newResults, hasMore: newHasMore }) => {
        if (requestIdRef.current !== requestId) return; // a newer search superseded this one
        setResults(newResults);
        setHasMore(newHasMore);
        setStatus("idle");
      })
      .catch((err) => {
        if (requestIdRef.current !== requestId) return;
        setError(err instanceof Error ? err.message : "Search failed. Please try again.");
        setStatus("error");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, entityTypesKey, filters.startDate, filters.endDate, filters.taskStatus, prioritiesKey, sortMode]);

  const handleLoadMore = useCallback(async () => {
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    setStatus("loading-more");
    setError(null);
    try {
      const supabase = createClient();
      const { results: more, hasMore: newHasMore } = await runSearch(supabase, {
        query: query.trim(),
        filters,
        sortMode,
        offset: results.length,
        limit: SEARCH_PAGE_SIZE,
      });
      if (requestIdRef.current !== requestId) return;
      setResults((prev) => [...prev, ...more]);
      setHasMore(newHasMore);
      setStatus("idle");
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      setError(err instanceof Error ? err.message : "Failed to load more results.");
      setStatus("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, entityTypesKey, filters.startDate, filters.endDate, filters.taskStatus, prioritiesKey, sortMode, results.length]);

  function handleTabChange(tab: SearchEntityType | "all") {
    const entityTypes: SearchEntityType[] = tab === "all" ? [] : [tab];
    updateUrl({ ...urlState, filters: { ...filters, entityTypes } }, "push");
  }

  function handleFiltersChange(nextFilters: SearchFilters) {
    updateUrl({ ...urlState, filters: nextFilters }, "push");
  }

  function handleSortModeChange(nextSort: SearchSortMode) {
    updateUrl({ ...urlState, sortMode: nextSort }, "push");
  }

  function handleClearInput() {
    setInputValue("");
    updateUrl({ ...urlState, query: "" }, "replace");
  }

  function handleOpenResult(result: SearchResult) {
    if (result.entityType === "task") {
      router.push(`/tasks?task=${result.entityId}`);
    } else if (result.entityType === "journal") {
      const dateParam = result.resultDate ? `date=${result.resultDate}&` : "";
      router.push(`/journal?${dateParam}entry=${result.entityId}`);
    } else {
      const dateParam = result.resultDate ? `&date=${result.resultDate}` : "";
      router.push(`/calendar?event=${result.entityId}${dateParam}`);
    }
  }

  const activeTab: SearchEntityType | "all" = filters.entityTypes.length === 1 ? filters.entityTypes[0] : "all";
  const hasQuery = query.trim().length > 0;
  const isInitialLoading = status === "loading" && results.length === 0;

  return (
    <AppShell>
      <div className="h-full flex flex-col w-full">
        <div className="w-full max-w-3xl mx-auto shrink-0">
          {/* ── Search input ── */}
          <div className="relative">
            <label htmlFor="planitary-search-input" className="sr-only">
              Search tasks, calendar events and journal entries
            </label>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))] pointer-events-none" aria-hidden="true" />
            <input
              id="planitary-search-input"
              type="search"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onFocus={() => {
                inputFocusedRef.current = true;
              }}
              onBlur={() => {
                inputFocusedRef.current = false;
              }}
              placeholder="Search tasks, calendar events, and journal entries…"
              autoFocus
              autoComplete="off"
              className="w-full pl-10 pr-10 py-3 text-sm rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none transition [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
            />
            {inputValue.length > 0 && (
              <button
                type="button"
                onClick={handleClearInput}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* ── Type tabs ── */}
          <div className="flex gap-1 overflow-x-auto mt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Filter results by type">
            {TYPE_TABS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={activeTab === value}
                onClick={() => handleTabChange(value)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-colors cursor-pointer whitespace-nowrap shrink-0",
                  activeTab === value
                    ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                    : "border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
                )}
              >
                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Filters share the column's left edge, then extend right instead of wrapping */}
        {hasQuery && (
          <div className="shrink-0 w-full pl-[max(0px,calc((100%-48rem)/2))]">
            <SearchFiltersPanel
              filters={filters}
              sortMode={sortMode}
              onFiltersChange={handleFiltersChange}
              onSortModeChange={handleSortModeChange}
            />
          </div>
        )}

        <div className="w-full max-w-3xl mx-auto flex-1 min-h-0 flex flex-col">
          {hasQuery && <div className="shrink-0 border-b border-[hsl(var(--border))]" />}
          {/* ── Result count (announced for screen readers) ── */}
          {hasQuery && !isInitialLoading && status !== "error" && (
            <p className="shrink-0 mt-3 text-xs text-[hsl(var(--muted-foreground))]" aria-live="polite">
              {results.length === 0
                ? `No results found for "${query}"`
                : `${results.length}${hasMore ? "+" : ""} result${results.length === 1 ? "" : "s"} for "${query}"`}
            </p>
          )}

          {/* ── Results area ── */}
          <div className="flex-1 min-h-0 mt-2 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {!hasQuery ? (
              <EmptyState
                icon={Search}
                title="Search Planitary"
                description="Search tasks, calendar events, and journal entries."
              />
            ) : status === "error" ? (
              <EmptyState
                icon={Search}
                title="Something went wrong"
                description={error ?? "Search failed. Please try again."}
              />
            ) : isInitialLoading ? (
              <div className="flex items-center justify-center py-20 text-[hsl(var(--muted-foreground))]">
                <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                <span className="sr-only">Searching…</span>
              </div>
            ) : results.length === 0 ? (
              <EmptyState
                icon={Search}
                title={`No results found for "${query}"`}
                description="Check your spelling, try fewer words, or clear filters."
              />
            ) : (
              <div className="space-y-1 pb-4">
                {results.map((result) => (
                  <SearchResultRow
                    key={`${result.entityType}-${result.entityId}`}
                    result={result}
                    query={query}
                    onOpen={handleOpenResult}
                  />
                ))}

                {hasMore && (
                  <div className="flex justify-center pt-3">
                    <button
                      type="button"
                      onClick={handleLoadMore}
                      disabled={status === "loading-more"}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-default"
                    >
                      {status === "loading-more" && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
                      Load more
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
