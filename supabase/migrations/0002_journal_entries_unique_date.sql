-- =============================================================================
-- Planitary — Journal: one entry per user per date
-- Run this in the Supabase SQL editor or via `supabase db push`
-- =============================================================================

-- Enforce a single primary journal entry per user per calendar date.
-- Lets us upsert on (user_id, entry_date) from the client.
alter table public.journal_entries
  add constraint journal_entries_user_date_unique unique (user_id, entry_date);
