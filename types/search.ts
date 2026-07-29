import type { Priority, TaskStatus } from "@/types";

// ---------------------------------------------------------------------------
// Reusable Search types. Kept independent of `lib/ai/types.ts` — a future
// AI layer should be able to produce a `SearchFilters` object (structured
// dates/status/priorities) directly from natural language and call the same
// `runSearch()` / `search_planitary` RPC used here, without any import
// coupling between the two feature areas.
// ---------------------------------------------------------------------------

export type SearchEntityType = "task" | "journal" | "calendar";

export const SEARCH_ENTITY_TYPES: readonly SearchEntityType[] = ["task", "journal", "calendar"];

export function isSearchEntityType(value: string): value is SearchEntityType {
  return (SEARCH_ENTITY_TYPES as readonly string[]).includes(value);
}

export type SearchSortMode = "relevance" | "newest" | "oldest";

export const SEARCH_SORT_MODES: readonly SearchSortMode[] = ["relevance", "newest", "oldest"];

export function isSearchSortMode(value: string): value is SearchSortMode {
  return (SEARCH_SORT_MODES as readonly string[]).includes(value);
}

/** Fields the server reports as having contributed to a result's match. */
export type SearchMatchedField = "title" | "notes" | "content" | "details" | "list";

/**
 * Structured search filters. This shape is intentionally the same whether it
 * comes from the Search page's UI controls or (in the future) an AI layer
 * that extracts structured filters from a natural-language query.
 */
export interface SearchFilters {
  /** Empty array means "search every entity type" (the "All" tab). */
  entityTypes: SearchEntityType[];
  /** YYYY-MM-DD, inclusive. */
  startDate: string | null;
  /** YYYY-MM-DD, inclusive. */
  endDate: string | null;
  /** Only applies to Task results. */
  taskStatus: TaskStatus | null;
  /** Only applies to Task results. Empty array means "any priority". */
  priorities: Priority[];
}

export const DEFAULT_SEARCH_FILTERS: SearchFilters = {
  entityTypes: [],
  startDate: null,
  endDate: null,
  taskStatus: null,
  priorities: [],
};

export function hasActiveFilters(filters: SearchFilters): boolean {
  return (
    filters.startDate !== null ||
    filters.endDate !== null ||
    filters.taskStatus !== null ||
    filters.priorities.length > 0
  );
}

/** Full structured search input — query text plus filters plus sort. */
export interface SearchQueryState {
  query: string;
  filters: SearchFilters;
  sortMode: SearchSortMode;
}

export interface SearchPaginationState {
  limit: number;
  offset: number;
}

/**
 * One normalized, ranked search result row. Mirrors `search_planitary()`'s
 * `RETURNS TABLE` shape (snake_case DB columns mapped to camelCase).
 */
export interface SearchResult {
  entityType: SearchEntityType;
  entityId: string;
  /** Task/Calendar: the item's title. Journal: a highlighted content snippet. */
  title: string;
  /** Highlighted excerpt (task notes / calendar details). Null for journal. */
  excerpt: string | null;
  /** YYYY-MM-DD — task due date, journal entry date, or calendar start date. */
  resultDate: string | null;
  /** Calendar only — ISO datetime with timezone. */
  startTime: string | null;
  /** Calendar only — ISO datetime with timezone. */
  endTime: string | null;
  /** Task only — HH:MM:SS. */
  dueTime: string | null;
  priority: Priority | null;
  status: TaskStatus | null;
  /** Task only — name of the List the task belongs to, if any. */
  listName: string | null;
  relevanceScore: number;
  matchedFields: SearchMatchedField[];
}

export interface SearchResponse {
  results: SearchResult[];
  hasMore: boolean;
}
