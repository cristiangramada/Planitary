-- =============================================================================
-- Planitary — Task Custom Order
-- Run this in the Supabase SQL editor or via `supabase db push`
--
-- Adds the manual ("Custom") task order used by the Tasks page sort selector.
-- A task belongs to exactly one container — a List, or Inbox when `list_id`
-- is null — so one nullable position per task is enough to describe the
-- user's manual order everywhere that task can appear.
--
--   custom_position — 0-based slot inside the task's container, or null when
--                     the task has never been placed by hand
--
-- Null is deliberately the default and is never backfilled: unpositioned
-- tasks sort after every positioned task, in creation order. That gives the
-- three behaviours the feature needs for free —
--
--   * a container nobody has reordered reads oldest-first, matching the
--     existing "Oldest first" sort, with no migration over existing rows;
--   * a newly created task lands at the bottom of its container;
--   * a task moved into another List (or back to Inbox) has its position
--     cleared and lands at the bottom of its new container.
--
-- Reordering writes contiguous 0..n-1 positions for the affected container,
-- but only for the rows whose value actually changes, so a short drag
-- rewrites a handful of rows rather than the whole container.
--
-- Ordering is resolved with (custom_position, created_at, id) so it is total
-- and never depends on physical row order.
-- =============================================================================

alter table public.tasks
  add column if not exists custom_position integer;

-- Supports reading a single container in manual order. Positioned rows only:
-- unpositioned tasks are resolved by created_at, which tasks_user_id_idx and
-- the primary key already cover.
create index if not exists tasks_user_id_list_id_custom_position_idx
  on public.tasks (user_id, list_id, custom_position)
  where custom_position is not null;

-- RLS is unchanged: the existing "tasks: select own" / "tasks: update own"
-- policies from 0001_initial_schema.sql already scope every read and write of
-- this column to auth.uid() = user_id.
