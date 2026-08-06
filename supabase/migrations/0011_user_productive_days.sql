-- =============================================================================
-- Planitary — User productive days
-- Run in the Supabase SQL editor or via `supabase db push`
--
-- Permanent per-user record of calendar dates on which at least one task was
-- completed. Used to unlock planet appearance themes. Rows are never deleted
-- when a task is reopened or removed — progress is cumulative and durable.
-- =============================================================================

create table if not exists public.user_productive_days (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users (id) on delete cascade,
  productive_date  date        not null,
  created_at       timestamptz not null default now(),
  unique (user_id, productive_date)
);

create index if not exists user_productive_days_user_id_idx
  on public.user_productive_days (user_id);

alter table public.user_productive_days enable row level security;

-- Users may read their own productive-day history (for unlock progress UI).
create policy "user_productive_days: select own"
  on public.user_productive_days for select
  using (auth.uid() = user_id);

-- Users may insert their own rows only. Conflict-safe upserts rely on the
-- unique (user_id, productive_date) constraint; no update/delete policies so
-- progress cannot be rewritten or removed from the client.
create policy "user_productive_days: insert own"
  on public.user_productive_days for insert
  with check (auth.uid() = user_id);
