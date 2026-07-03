-- =============================================================================
-- Planitary — Initial Schema
-- Run this in the Supabase SQL editor or via `supabase db push`
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLES
-- ---------------------------------------------------------------------------

-- profiles: one-to-one mirror of auth.users, created automatically on signup
create table if not exists public.profiles (
  id            uuid        primary key references auth.users (id) on delete cascade,
  email         text        not null,
  display_name  text,
  created_at    timestamptz not null default now()
);

-- tasks
create table if not exists public.tasks (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users (id) on delete cascade,
  title         text        not null,
  notes         text,
  priority      text        not null default 'medium'
                            check (priority in ('low', 'medium', 'high')),
  status        text        not null default 'active'
                            check (status in ('active', 'completed')),
  due_date      date,
  due_time      time,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- subtasks
create table if not exists public.subtasks (
  id            uuid        primary key default gen_random_uuid(),
  task_id       uuid        not null references public.tasks (id) on delete cascade,
  user_id       uuid        not null references auth.users (id) on delete cascade,
  title         text        not null,
  is_completed  boolean     not null default false,
  created_at    timestamptz not null default now()
);

-- calendar_events
create table if not exists public.calendar_events (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users (id) on delete cascade,
  title         text        not null,
  details       text,
  start_time    timestamptz not null,
  end_time      timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- journal_entries
create table if not exists public.journal_entries (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users (id) on delete cascade,
  entry_date    date        not null default current_date,
  content       text        not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- tags
create table if not exists public.tags (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users (id) on delete cascade,
  name          text        not null,
  color         text,
  unique (user_id, name)
);

-- task_tags: many-to-many junction
create table if not exists public.task_tags (
  task_id       uuid        not null references public.tasks (id) on delete cascade,
  tag_id        uuid        not null references public.tags  (id) on delete cascade,
  primary key (task_id, tag_id)
);

-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------

create index if not exists tasks_user_id_idx          on public.tasks          (user_id);
create index if not exists tasks_status_idx           on public.tasks          (status);
create index if not exists tasks_due_date_idx         on public.tasks          (due_date);
create index if not exists subtasks_task_id_idx       on public.subtasks       (task_id);
create index if not exists subtasks_user_id_idx       on public.subtasks       (user_id);
create index if not exists calendar_events_user_id_idx on public.calendar_events (user_id);
create index if not exists calendar_events_start_idx  on public.calendar_events (start_time);
create index if not exists journal_entries_user_id_idx on public.journal_entries (user_id);
create index if not exists journal_entries_date_idx   on public.journal_entries (entry_date);
create index if not exists tags_user_id_idx           on public.tags           (user_id);

-- ---------------------------------------------------------------------------
-- FUNCTIONS
-- ---------------------------------------------------------------------------

-- Auto-create a profile row when a new auth user is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

-- Bump updated_at on any update
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- TRIGGERS
-- ---------------------------------------------------------------------------

-- Profile auto-creation
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- updated_at triggers
drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute procedure public.handle_updated_at();

drop trigger if exists calendar_events_set_updated_at on public.calendar_events;
create trigger calendar_events_set_updated_at
  before update on public.calendar_events
  for each row execute procedure public.handle_updated_at();

drop trigger if exists journal_entries_set_updated_at on public.journal_entries;
create trigger journal_entries_set_updated_at
  before update on public.journal_entries
  for each row execute procedure public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

alter table public.profiles       enable row level security;
alter table public.tasks          enable row level security;
alter table public.subtasks       enable row level security;
alter table public.calendar_events enable row level security;
alter table public.journal_entries enable row level security;
alter table public.tags           enable row level security;
alter table public.task_tags      enable row level security;

-- profiles
create policy "profiles: select own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: update own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- tasks
create policy "tasks: select own"
  on public.tasks for select
  using (auth.uid() = user_id);

create policy "tasks: insert own"
  on public.tasks for insert
  with check (auth.uid() = user_id);

create policy "tasks: update own"
  on public.tasks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "tasks: delete own"
  on public.tasks for delete
  using (auth.uid() = user_id);

-- subtasks
create policy "subtasks: select own"
  on public.subtasks for select
  using (auth.uid() = user_id);

create policy "subtasks: insert own"
  on public.subtasks for insert
  with check (auth.uid() = user_id);

create policy "subtasks: update own"
  on public.subtasks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "subtasks: delete own"
  on public.subtasks for delete
  using (auth.uid() = user_id);

-- calendar_events
create policy "calendar_events: select own"
  on public.calendar_events for select
  using (auth.uid() = user_id);

create policy "calendar_events: insert own"
  on public.calendar_events for insert
  with check (auth.uid() = user_id);

create policy "calendar_events: update own"
  on public.calendar_events for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "calendar_events: delete own"
  on public.calendar_events for delete
  using (auth.uid() = user_id);

-- journal_entries
create policy "journal_entries: select own"
  on public.journal_entries for select
  using (auth.uid() = user_id);

create policy "journal_entries: insert own"
  on public.journal_entries for insert
  with check (auth.uid() = user_id);

create policy "journal_entries: update own"
  on public.journal_entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "journal_entries: delete own"
  on public.journal_entries for delete
  using (auth.uid() = user_id);

-- tags
create policy "tags: select own"
  on public.tags for select
  using (auth.uid() = user_id);

create policy "tags: insert own"
  on public.tags for insert
  with check (auth.uid() = user_id);

create policy "tags: update own"
  on public.tags for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "tags: delete own"
  on public.tags for delete
  using (auth.uid() = user_id);

-- task_tags: a user can manage task_tags for tasks they own
create policy "task_tags: select own"
  on public.task_tags for select
  using (
    exists (
      select 1 from public.tasks
      where tasks.id = task_tags.task_id
        and tasks.user_id = auth.uid()
    )
  );

create policy "task_tags: insert own"
  on public.task_tags for insert
  with check (
    exists (
      select 1 from public.tasks
      where tasks.id = task_tags.task_id
        and tasks.user_id = auth.uid()
    )
  );

create policy "task_tags: delete own"
  on public.task_tags for delete
  using (
    exists (
      select 1 from public.tasks
      where tasks.id = task_tags.task_id
        and tasks.user_id = auth.uid()
    )
  );
