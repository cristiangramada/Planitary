-- =============================================================================
-- Planitary — Task Repeat (recurrence)
-- Run this in the Supabase SQL editor or via `supabase db push`
--
-- Adds persisted recurrence to `tasks`. Recurrence model (V1, "Option A"):
-- completing a recurring task creates exactly one next-occurrence task row
-- with an advanced due date; no future occurrences are pre-generated.
--
--   repeat                  — cadence for this task/series ('never' = no repeat)
--   recurrence_id            — shared by every task in a series; null for
--                              non-recurring tasks
--   recurrence_anchor_day    — day-of-month (1-31) the series anchors to, used
--                              to clamp monthly/yearly occurrences without
--                              permanently degrading the series after a short
--                              month (e.g. Jan 31 -> Feb 28 -> Mar 31)
--
-- Idempotency: a unique constraint on (user_id, recurrence_id, due_date)
-- guarantees at most one row per series per occurrence date. NULL
-- recurrence_id (non-recurring tasks) never collides, since Postgres never
-- treats two NULLs as equal for uniqueness purposes. Completion logic relies
-- on this constraint (catching a unique-violation as "already created") to
-- stay safe under double-clicks/retries/races without needing a DB function.
-- =============================================================================

alter table public.tasks
  add column repeat text not null default 'never'
    check (repeat in ('never', 'daily', 'weekly', 'monthly', 'yearly')),
  add column recurrence_id uuid,
  add column recurrence_anchor_day smallint
    check (recurrence_anchor_day is null or recurrence_anchor_day between 1 and 31);

-- A task is either non-recurring (no series linkage) or fully recurring
-- (series id + anchor day both set); no half-states, and repeat requires a
-- due date to advance from.
alter table public.tasks
  add constraint tasks_repeat_recurrence_consistency
  check (
    (repeat = 'never' and recurrence_id is null and recurrence_anchor_day is null)
    or
    (repeat <> 'never' and recurrence_id is not null and recurrence_anchor_day is not null and due_date is not null)
  );

alter table public.tasks
  add constraint tasks_recurrence_occurrence_unique unique (user_id, recurrence_id, due_date);
