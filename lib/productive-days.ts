import type { SupabaseClient } from "@supabase/supabase-js";
import { themesUnlockedAtCount, type PlanetThemeId } from "@/lib/themes";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function isValidProductiveDate(value: string): boolean {
  if (!DATE_ONLY.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return (
    dt.getFullYear() === y &&
    dt.getMonth() === m - 1 &&
    dt.getDate() === d
  );
}

export interface RecordProductiveDayResult {
  /** True when a new productive-day row was inserted (first completion that day). */
  inserted: boolean;
  /** Total unique productive days for the user after this call. */
  productiveDayCount: number;
  /** Planet themes whose threshold matches the new count (only when inserted). */
  newlyUnlocked: PlanetThemeId[];
}

/**
 * Idempotently records a productive calendar date for the authenticated user.
 *
 * `productiveDate` must be the user's local YYYY-MM-DD at completion time.
 * Planitary does not store timezones; the client derives the local date and
 * passes only that date string. RLS binds the row to auth.uid().
 *
 * Never deletes rows — reopening or deleting tasks does not reduce progress.
 */
export async function recordProductiveDay(
  supabase: SupabaseClient,
  productiveDate: string
): Promise<RecordProductiveDayResult> {
  if (!isValidProductiveDate(productiveDate)) {
    throw new Error(`Invalid productive date: ${productiveDate}`);
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error("Not authenticated");

  const beforeCount = await countProductiveDays(supabase);

  const { error: insertError } = await supabase.from("user_productive_days").upsert(
    { user_id: user.id, productive_date: productiveDate },
    { onConflict: "user_id,productive_date", ignoreDuplicates: true }
  );
  if (insertError) throw insertError;

  const productiveDayCount = await countProductiveDays(supabase);
  const inserted = productiveDayCount > beforeCount;
  const newlyUnlocked = inserted ? themesUnlockedAtCount(productiveDayCount) : [];

  return { inserted, productiveDayCount, newlyUnlocked };
}

/** Count of unique productive days for the authenticated user. */
export async function countProductiveDays(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from("user_productive_days")
    .select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}
