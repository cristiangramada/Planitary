import type { SupabaseClient } from "@supabase/supabase-js";
import type { JournalEntry } from "@/types";

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/** Fetches all journal entries for the signed-in user, newest date first. */
export async function fetchJournalEntries(
  supabase: SupabaseClient
): Promise<JournalEntry[]> {
  const { data, error } = await supabase
    .from("journal_entries")
    .select("*")
    .order("entry_date", { ascending: false });

  if (error) throw error;
  return (data as JournalEntry[]) ?? [];
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Creates or updates the single journal entry for a given date
 * (one primary entry per user per date, enforced by a unique constraint).
 */
export async function saveJournalEntry(
  supabase: SupabaseClient,
  userId: string,
  entryDate: string,
  content: string
): Promise<JournalEntry> {
  const { data, error } = await supabase
    .from("journal_entries")
    .upsert(
      { user_id: userId, entry_date: entryDate, content },
      { onConflict: "user_id,entry_date" }
    )
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
