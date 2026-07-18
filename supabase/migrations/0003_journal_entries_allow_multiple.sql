-- =============================================================================
-- Planitary — Journal: allow multiple entries per user per date
-- Run this in the Supabase SQL editor or via `supabase db push`
--
-- The journal has moved from a single daily entry to a fast, list-based
-- quick-add flow (multiple entries per day). This migration safely removes
-- the (user_id, entry_date) uniqueness constraint introduced in
-- 0002_journal_entries_unique_date.sql without touching that migration file.
-- =============================================================================

alter table public.journal_entries
  drop constraint if exists journal_entries_user_date_unique;

-- Sorting/listing now happens by creation time rather than by date alone.
create index if not exists journal_entries_created_at_idx
  on public.journal_entries (created_at);
