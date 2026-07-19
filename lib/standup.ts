import type { SupabaseClient } from "@supabase/supabase-js";
import { parseDateOnly, shiftDateStr } from "@/utils/date";
import type { StandupSourceDay } from "@/lib/ai/prompts/standup-prompt";

// ---------------------------------------------------------------------------
// Standup-specific data rules: date-range validation, Journal retrieval
// (server-side, RLS-scoped), grouping, and deterministic size limits. Kept
// separate from `lib/ai/*` so the generic AI layer stays feature-agnostic.
// ---------------------------------------------------------------------------

export const STANDUP_LIMITS = {
  maxRangeDays: 31,
  maxEntries: 200,
  maxSourceCharacters: 30_000,
} as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface DateRangeValidation {
  valid: boolean;
  error: string | null;
}

/**
 * Validates a YYYY-MM-DD start/end pair using local-date-safe comparisons.
 * Shared by the client (to disable Generate) and the server (to reject bad
 * requests) so the rules can never drift apart.
 */
export function validateStandupRange(startDate: string, endDate: string): DateRangeValidation {
  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
    return { valid: false, error: "Dates must be valid calendar dates." };
  }

  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { valid: false, error: "Dates must be valid calendar dates." };
  }
  if (start.getTime() > end.getTime()) {
    return { valid: false, error: "Start date must be on or before the end date." };
  }

  const dayCount = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (dayCount > STANDUP_LIMITS.maxRangeDays) {
    return { valid: false, error: `Select a range of ${STANDUP_LIMITS.maxRangeDays} days or fewer.` };
  }

  return { valid: true, error: null };
}

/** Default range: the seven most recent calendar dates, including today. */
export function defaultStandupRange(todayStr: string): { startDate: string; endDate: string } {
  return { startDate: shiftDateStr(todayStr, -6), endDate: todayStr };
}

interface StandupRow {
  entry_date: string;
  content: string;
  created_at: string;
}

export interface StandupSourceResult {
  days: StandupSourceDay[];
  /** Total matching entries before any truncation, for response metadata. */
  entryCount: number;
  /** True when source content had to be trimmed to fit the configured limits. */
  truncated: boolean;
}

/**
 * Fetches the authenticated user's journal entries within [startDate, endDate]
 * (inclusive), excludes empty entries, groups them by day, and applies
 * deterministic limits so a very large range can't overflow the model's
 * practical context budget. Row Level Security (scoped to auth.uid()) is the
 * caller's responsibility — pass an authenticated server Supabase client.
 */
export async function fetchStandupSource(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string
): Promise<StandupSourceResult> {
  const { data, error } = await supabase
    .from("journal_entries")
    .select("entry_date, content, created_at")
    .gte("entry_date", startDate)
    .lte("entry_date", endDate)
    .order("entry_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;

  const rows = ((data as StandupRow[]) ?? [])
    .map((r) => ({ ...r, content: r.content.trim() }))
    .filter((r) => r.content.length > 0);

  const entryCount = rows.length;
  const { kept, truncated } = applySizeLimits(rows);

  const byDate = new Map<string, string[]>();
  for (const row of kept) {
    const list = byDate.get(row.entry_date) ?? [];
    list.push(row.content);
    byDate.set(row.entry_date, list);
  }

  const days: StandupSourceDay[] = Array.from(byDate.entries()).map(([date, entries]) => ({
    label: formatDayLabel(date),
    entries,
  }));

  return { days, entryCount, truncated };
}

function formatDayLabel(dateStr: string): string {
  return parseDateOnly(dateStr).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Deterministically caps total entries and total characters. When entries
 * must be dropped, they are sampled at an even stride across the
 * chronological list rather than trimming only the first or last day, so
 * coverage across the selected range is preserved.
 */
function applySizeLimits(rows: StandupRow[]): { kept: StandupRow[]; truncated: boolean } {
  let kept = rows;
  let truncated = false;

  if (kept.length > STANDUP_LIMITS.maxEntries) {
    const stride = kept.length / STANDUP_LIMITS.maxEntries;
    const sampled: StandupRow[] = [];
    for (let i = 0; i < STANDUP_LIMITS.maxEntries; i++) {
      sampled.push(kept[Math.floor(i * stride)]);
    }
    kept = sampled;
    truncated = true;
  }

  const totalChars = kept.reduce((sum, r) => sum + r.content.length, 0);
  if (totalChars > STANDUP_LIMITS.maxSourceCharacters) {
    truncated = true;
    const result: StandupRow[] = [];
    let used = 0;
    for (const row of kept) {
      if (used + row.content.length > STANDUP_LIMITS.maxSourceCharacters) break;
      result.push(row);
      used += row.content.length;
    }
    kept = result;
  }

  return { kept, truncated };
}
