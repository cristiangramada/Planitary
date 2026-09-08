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
-- tasks sort after every positioned task, in creation order. That gives two
-- behaviours the feature needs for free —
--
--   * a container nobody has reordered reads oldest-first, matching the
--     existing "Oldest first" sort, with no migration over existing rows;
--   * a newly created task is always the newest row, so it lands at the
--     bottom of its container.
--
-- Note that "unpositioned sorts last" only holds for *new* rows. A task moved
-- into a container brings an older created_at with it, so clearing its
-- position would drop it into the middle of an all-null destination. Moves
-- and List deletions therefore assign a real position and materialise the
-- destination's nulls in the same pass (see lib/tasks-custom-order.ts).
--
-- Ordering is resolved with (custom_position, created_at, id) so it is total
-- and never depends on physical row order.
--
-- No index is added: the Tasks page loads a user's tasks in one query and
-- orders them in the client, so an ordering index would cost write
-- amplification on every task insert and update for no read benefit.
-- =============================================================================

alter table public.tasks
  add column if not exists custom_position integer;

-- ---------------------------------------------------------------------------
-- ATOMIC REORDER
-- ---------------------------------------------------------------------------

-- Applies a whole reorder in one statement. Writing the rows individually
-- would let overlapping drags — or a failure partway through a batch — leave
-- a container holding duplicate or half-applied positions.
--
-- The arguments are validated before anything is written. The app can't
-- produce a bad plan (positions are array indices, and ids come from splices
-- of existing arrays), but this is granted to `authenticated`, and duplicate
-- ids in particular would make the update's winning row unspecified.
--
-- A plan also names the container it was computed for, and rows that have
-- since left it are skipped. Positions are otherwise container-agnostic, so
-- a plan built while a task was believed to be here would happily write that
-- task a position belonging to a container it is no longer in — an ordering
-- it would then keep, since re-reading a container can't correct a row that
-- isn't in it. `p_list_id` is null for Inbox, so it is required rather than
-- defaulted: there is no value left over to mean "unchecked". Unlike the
-- validations above, a stale plan is something the app legitimately produces
-- from a view another session has moved on from, so those rows are dropped
-- quietly instead of failing the whole write.
--
-- `security invoker` keeps the caller's RLS in force, and the explicit
-- auth.uid() predicate means a caller still cannot touch another user's rows
-- even if the tasks policies are ever loosened. Rows the caller doesn't own
-- simply don't match, so they are skipped rather than raising.
create or replace function public.set_task_custom_positions(
  p_task_ids   uuid[],
  p_positions  integer[],
  p_list_id    uuid
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_count integer := coalesce(array_length(p_task_ids, 1), 0);
begin
  if v_count <> coalesce(array_length(p_positions, 1), 0) then
    raise exception 'p_task_ids and p_positions must have the same length';
  end if;

  if exists (select 1 from unnest(p_task_ids) as t(task_id) where t.task_id is null) then
    raise exception 'p_task_ids must not contain nulls';
  end if;

  if (select count(distinct t.task_id) from unnest(p_task_ids) as t(task_id)) <> v_count then
    raise exception 'p_task_ids must not contain duplicate ids';
  end if;

  if exists (
    select 1 from unnest(p_positions) as p(new_position)
     where p.new_position is null or p.new_position < 0
  ) then
    raise exception 'p_positions must be non-null and non-negative';
  end if;

  update public.tasks t
     set custom_position = v.new_position
    from unnest(p_task_ids, p_positions) as v(task_id, new_position)
   where t.id = v.task_id
     and t.user_id = auth.uid()
     and t.list_id is not distinct from p_list_id;
end;
$$;

-- Deleting a List and re-ordering the tasks it leaves behind, as one unit.
--
-- The `tasks.list_id` foreign key's `on delete set null` drops those tasks
-- into Inbox, where their old List positions would collide with Inbox's own.
-- Split across two round trips, a delete that commits before the ordering
-- write fails leaves Inbox holding two independently numbered groups that
-- interleave — and a reload can't repair it, because that *is* the stored
-- state. Here both writes commit or neither does.
--
-- The List is locked before anything is written. Without the check, a stale
-- or unknown id deletes nothing yet still applies the caller's ordering plan,
-- so the call reports success having done something the caller never asked
-- for. Without the lock, a plain existence check only rules that out for ids
-- that were already gone when this transaction started: another session
-- deleting the same List in the window between the check and the delete puts
-- the loser right back in that state. `for update` makes the loser wait, and
-- read-committed re-checks the row after the winner commits, so it finds the
-- List gone and raises instead.
--
-- Positions are applied after the delete, once the cascade has dropped the
-- List's tasks into Inbox, so they can be written as an Inbox plan and
-- checked against it. The caller builds that plan from an unlocked read, so
-- another session can move a task out of this List in between; scoping the
-- write to Inbox is what stops the plan from following that task into its
-- new List and overwriting the position it was given there.
create or replace function public.delete_task_list_with_order(
  p_list_id    uuid,
  p_task_ids   uuid[],
  p_positions  integer[]
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  perform 1
     from public.task_lists
    where id = p_list_id
      and user_id = auth.uid()
      for update;

  if not found then
    raise exception 'List % not found', p_list_id;
  end if;

  delete from public.task_lists
   where id = p_list_id
     and user_id = auth.uid();

  perform public.set_task_custom_positions(p_task_ids, p_positions, null);
end;
$$;

-- Only authenticated users may call these functions; both rely on auth.uid().
revoke all on function public.set_task_custom_positions(uuid[], integer[], uuid) from public;
grant execute on function public.set_task_custom_positions(uuid[], integer[], uuid) to authenticated;

revoke all on function public.delete_task_list_with_order(uuid, uuid[], integer[]) from public;
grant execute on function public.delete_task_list_with_order(uuid, uuid[], integer[]) to authenticated;

-- RLS is otherwise unchanged: the existing "tasks: select own" /
-- "tasks: update own" policies from 0001_initial_schema.sql already scope
-- every read and write of this column to auth.uid() = user_id.
