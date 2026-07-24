import type { SupabaseClient } from "@supabase/supabase-js";
import type { JournalEntry } from "@/types";

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Fetches all journal entries for the signed-in user on a single calendar date
 * (YYYY-MM-DD, local), newest created first. RLS scopes this to the caller's own rows.
 */
export async function fetchJournalEntriesByDate(
  supabase: SupabaseClient,
  entryDate: string
): Promise<JournalEntry[]> {
  const { data, error } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("entry_date", entryDate)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as JournalEntry[]) ?? [];
}

/**
 * Fetches the distinct local dates (YYYY-MM-DD) within [startDate, endDate] that
 * have at least one journal entry. Used for the Dashboard's "journal days this
 * week" metric — only the date column is selected to keep this bounded and cheap.
 */
export async function fetchJournalEntryDatesBetween(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from("journal_entries")
    .select("entry_date")
    .gte("entry_date", startDate)
    .lte("entry_date", endDate);

  if (error) throw error;
  const rows = (data as { entry_date: string }[]) ?? [];
  return Array.from(new Set(rows.map((r) => r.entry_date)));
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Creates a new journal entry. Multiple entries per date are supported —
 * this always inserts a new row rather than upserting on date.
 */
export async function createJournalEntry(
  supabase: SupabaseClient,
  userId: string,
  entryDate: string,
  content: string
): Promise<JournalEntry> {
  const { data, error } = await supabase
    .from("journal_entries")
    .insert({ user_id: userId, entry_date: entryDate, content })
    .select()
    .single();

  if (error) throw error;
  return data as JournalEntry;
}

/** Updates the content of an existing journal entry. */
export async function updateJournalEntry(
  supabase: SupabaseClient,
  id: string,
  content: string
): Promise<JournalEntry> {
  const { data, error } = await supabase
    .from("journal_entries")
    .update({ content })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as JournalEntry;
}

/** Deletes a journal entry by id. */
export async function deleteJournalEntry(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from("journal_entries").delete().eq("id", id);
  if (error) throw error;
}
