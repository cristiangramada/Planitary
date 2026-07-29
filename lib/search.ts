import type { SupabaseClient } from "@supabase/supabase-js";
import type { Priority, TaskStatus } from "@/types";
import {
  isSearchEntityType,
  isSearchSortMode,
  type SearchEntityType,
  type SearchFilters,
  type SearchMatchedField,
  type SearchQueryState,
  type SearchResult,
  type SearchSortMode,
} from "@/types/search";

// ---------------------------------------------------------------------------
// Search data access — a thin, typed wrapper around the `search_planitary`
// RPC. This is the ONLY place that knows the RPC's parameter/column names;
// the Search page works entirely in terms of `SearchQueryState`/`SearchResult`.
// ---------------------------------------------------------------------------

export const SEARCH_PAGE_SIZE = 20;

const VALID_PRIORITIES: readonly Priority[] = ["none", "low", "medium", "high"];
const VALID_TASK_STATUSES: readonly TaskStatus[] = ["active", "completed"];

interface SearchPlanitaryRow {
  entity_type: string;
  entity_id: string;
  title: string;
  excerpt: string | null;
  result_date: string | null;
  start_time: string | null;
  end_time: string | null;
  due_time: string | null;
  priority: string | null;
  status: string | null;
  list_name: string | null;
  relevance_score: number;
  matched_fields: string[] | null;
}

export interface RunSearchParams {
  query: string;
  filters: SearchFilters;
  sortMode: SearchSortMode;
  limit?: number;
  offset?: number;
}

export interface RunSearchResult {
  results: SearchResult[];
  hasMore: boolean;
}

/**
 * Runs a search via the `search_planitary` RPC. Requests one extra row past
 * `limit` to cheaply determine `hasMore` without a separate count query.
 * Returns an empty result set (no RPC call) for an empty/whitespace query —
 * the database function guards this too, but skipping the network round
 * trip keeps the UI instant for the common "cleared the search box" case.
 */
export async function runSearch(
  supabase: SupabaseClient,
  { query, filters, sortMode, limit = SEARCH_PAGE_SIZE, offset = 0 }: RunSearchParams
): Promise<RunSearchResult> {
  const trimmed = query.trim();
  if (!trimmed) return { results: [], hasMore: false };

  const { data, error } = await supabase.rpc("search_planitary", {
    p_query: trimmed,
    p_entity_types: filters.entityTypes.length > 0 ? filters.entityTypes : null,
    p_start_date: filters.startDate,
    p_end_date: filters.endDate,
    p_task_status: filters.taskStatus,
    p_priorities: filters.priorities.length > 0 ? filters.priorities : null,
    p_sort_mode: sortMode,
    p_limit: limit + 1,
    p_offset: offset,
  });

  if (error) throw error;

  const rows = (data as SearchPlanitaryRow[] | null) ?? [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return { results: page.map(normalizeRow), hasMore };
}

const MATCHED_FIELDS: readonly SearchMatchedField[] = ["title", "notes", "content", "details", "list"];

/** Exported for testing — maps one raw RPC row into a strict `SearchResult`. */
export function normalizeRow(row: SearchPlanitaryRow): SearchResult {
  return {
    entityType: isSearchEntityType(row.entity_type) ? row.entity_type : "task",
    entityId: row.entity_id,
    title: row.title,
    excerpt: row.excerpt,
    resultDate: row.result_date,
    startTime: row.start_time,
    endTime: row.end_time,
    dueTime: row.due_time,
    priority: (VALID_PRIORITIES as readonly string[]).includes(row.priority ?? "")
      ? (row.priority as Priority)
      : null,
    status: (VALID_TASK_STATUSES as readonly string[]).includes(row.status ?? "")
      ? (row.status as TaskStatus)
      : null,
    listName: row.list_name,
    relevanceScore: row.relevance_score,
    matchedFields: (row.matched_fields ?? []).filter((f): f is SearchMatchedField =>
      (MATCHED_FIELDS as readonly string[]).includes(f)
    ),
  };
}

// ---------------------------------------------------------------------------
// URL <-> state — pure functions so search state survives refresh, sharing,
// and browser back/forward. Invalid/unknown URL values fall back safely to
// defaults rather than throwing.
// ---------------------------------------------------------------------------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeDateParam(value: string | null): string | null {
  return value && DATE_RE.test(value) ? value : null;
}

function isPriority(value: string): value is Priority {
  return (VALID_PRIORITIES as readonly string[]).includes(value);
}

/** Parses `?q=&type=&start=&end=&status=&priority=&sort=` into structured state. */
export function parseSearchState(params: URLSearchParams): SearchQueryState {
  const query = params.get("q") ?? "";

  const typeParam = params.get("type");
  const entityTypes: SearchEntityType[] =
    typeParam && typeParam !== "all" && isSearchEntityType(typeParam) ? [typeParam] : [];

  const taskStatusParam = params.get("status");
  const taskStatus: TaskStatus | null =
    taskStatusParam === "active" || taskStatusParam === "completed" ? taskStatusParam : null;

  const priorityParam = params.get("priority");
  const priorities: Priority[] = priorityParam
    ? Array.from(new Set(priorityParam.split(",").filter(isPriority)))
    : [];

  const sortParam = params.get("sort");
  const sortMode: SearchSortMode = sortParam && isSearchSortMode(sortParam) ? sortParam : "relevance";

  return {
    query,
    filters: {
      entityTypes,
      startDate: normalizeDateParam(params.get("start")),
      endDate: normalizeDateParam(params.get("end")),
      taskStatus,
      priorities,
    },
    sortMode,
  };
}

/** Serializes structured search state back into URL query params. */
export function buildSearchParams(state: SearchQueryState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.query) params.set("q", state.query);
  if (state.filters.entityTypes.length === 1) params.set("type", state.filters.entityTypes[0]);
  if (state.filters.startDate) params.set("start", state.filters.startDate);
  if (state.filters.endDate) params.set("end", state.filters.endDate);
  if (state.filters.taskStatus) params.set("status", state.filters.taskStatus);
  if (state.filters.priorities.length > 0) params.set("priority", state.filters.priorities.join(","));
  if (state.sortMode !== "relevance") params.set("sort", state.sortMode);
  return params;
}
