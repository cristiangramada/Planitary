-- Allow tasks to have no priority ("none").
alter table public.tasks drop constraint if exists tasks_priority_check;
alter table public.tasks
  add constraint tasks_priority_check
  check (priority in ('none', 'low', 'medium', 'high'));
