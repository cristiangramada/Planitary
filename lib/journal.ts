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
