-- =============================================================================
-- Planitary — Task Lists
-- Run this in the Supabase SQL editor or via `supabase db push`
--
-- Adds user-owned Lists as an optional container for Tasks. A task with a
-- null `list_id` is considered "Inbox" — Inbox is a system view (unassigned
-- tasks), not a row in this table. Deleting a List never deletes its Tasks;
-- `on delete set null` moves them back to Inbox automatically.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLE
-- ---------------------------------------------------------------------------

create table if not exists public.task_lists (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users (id) on delete cascade,
  name          text        not null,
  color         text,
  icon          text,
  position      integer     not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.tasks
  add column if not exists list_id uuid references public.task_lists (id) on delete set null;

-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------

-- Case-insensitive per-user uniqueness ("Work" / "work" / " WORK " conflict).
-- Application code also trims/validates before insert, but this is the
-- authoritative guard against races and any non-app writers.
create unique index if not exists task_lists_user_id_name_lower_idx
  on public.task_lists (user_id, lower(name));

create index if not exists task_lists_user_id_idx
  on public.task_lists (user_id);
create index if not exists task_lists_user_id_position_idx
  on public.task_lists (user_id, position);

create index if not exists tasks_list_id_idx
  on public.tasks (list_id);

-- ---------------------------------------------------------------------------
-- TRIGGERS
-- ---------------------------------------------------------------------------

-- Reuses the existing handle_updated_at() function from 0001_initial_schema.sql.
drop trigger if exists task_lists_set_updated_at on public.task_lists;
create trigger task_lists_set_updated_at
  before update on public.task_lists
  for each row execute procedure public.handle_updated_at();

-- Defense-in-depth: a task's list_id must reference a list owned by the same
-- user. RLS already prevents a user from reading/updating another user's
-- task, but this guards against a task being assigned a foreign list_id
-- (the foreign key alone does not check ownership).
create or replace function public.enforce_task_list_ownership()
returns trigger
language plpgsql
as $$
begin
  if new.list_id is not null and not exists (
    select 1 from public.task_lists
    where id = new.list_id
      and user_id = new.user_id
  ) then
    raise exception 'Cannot assign task to a list you do not own';
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_enforce_list_ownership on public.tasks;
create trigger tasks_enforce_list_ownership
  before insert or update of list_id on public.tasks
  for each row execute procedure public.enforce_task_list_ownership();

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

alter table public.task_lists enable row level security;

create policy "task_lists: select own"
  on public.task_lists for select
  using (auth.uid() = user_id);

create policy "task_lists: insert own"
  on public.task_lists for insert
  with check (auth.uid() = user_id);

create policy "task_lists: update own"
  on public.task_lists for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "task_lists: delete own"
  on public.task_lists for delete
  using (auth.uid() = user_id);
