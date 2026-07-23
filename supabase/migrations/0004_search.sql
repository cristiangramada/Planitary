-- =============================================================================
-- Planitary — Search
-- Run this in the Supabase SQL editor or via `supabase db push`
--
-- Adds PostgreSQL full-text search (+ pg_trgm typo tolerance) across Tasks,
-- Journal entries, and Calendar events, exposed through a single RPC
-- (`search_planitary`) that returns normalized, ranked results. No new
-- "search document" table is introduced — the source tables are searched
-- directly via generated tsvector columns, which keeps the source of truth
-- singular and avoids sync bugs.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- EXTENSIONS
-- ---------------------------------------------------------------------------

-- Trigram similarity — used for typo tolerance and short/partial matches on
-- titles, journal content, and tag names. Not used for full document search
-- (that's PostgreSQL's built-in full-text search, below). We specifically
-- use `word_similarity(query, field)` rather than `similarity()`: plain
-- similarity() compares two whole strings and is heavily penalized when a
-- short query is compared against a much longer title/body, so a typo'd
-- short query (e.g. "calender") would fail to match a longer title (e.g.
-- "Calendar redesign polish"). word_similarity() instead finds the
-- best-matching substring of the target, which is what "typo tolerance for
-- short titles" actually requires. Both operators are backed by the same
-- trigram GIN indexes.
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- SEARCH VECTORS
--
-- Generated (stored) columns so they stay in sync automatically and can be
-- indexed like any other column. `to_tsvector('english', ...)` with a fixed
-- text-search configuration is immutable, so it's allowed in a generated
-- column expression.
--
-- Weights: title = A (highest), body/description = B. This makes
-- ts_rank_cd() naturally rank title matches above body matches without any
-- extra application logic.
-- ---------------------------------------------------------------------------

alter table public.tasks
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(notes, '')), 'B')
  ) stored;

alter table public.calendar_events
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(details, '')), 'B')
  ) stored;

-- Journal entries have a single searchable field (content), so the whole
-- document is weighted 'A'.
alter table public.journal_entries
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(content, '')), 'A')
  ) stored;

-- ---------------------------------------------------------------------------
-- INDEXES
--
-- GIN indexes on the tsvector columns power full-text search. GIN trigram
-- indexes are added only on the fields that benefit from typo/partial
-- matching (titles, journal content, tag names) — not on every text column —
-- to keep write overhead reasonable.
-- ---------------------------------------------------------------------------

create index if not exists tasks_search_vector_idx
  on public.tasks using gin (search_vector);
create index if not exists tasks_title_trgm_idx
  on public.tasks using gin (title gin_trgm_ops);

create index if not exists calendar_events_search_vector_idx
  on public.calendar_events using gin (search_vector);
create index if not exists calendar_events_title_trgm_idx
  on public.calendar_events using gin (title gin_trgm_ops);

create index if not exists journal_entries_search_vector_idx
  on public.journal_entries using gin (search_vector);
create index if not exists journal_entries_content_trgm_idx
  on public.journal_entries using gin (content gin_trgm_ops);

-- Lets a matching tag name (typo-tolerant) find its tasks efficiently.
create index if not exists tags_name_trgm_idx
  on public.tags using gin (name gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- UNIFIED SEARCH RPC
--
-- search_planitary(...) searches Tasks, Journal entries, and Calendar events
-- in one call and returns a normalized, ranked, paginated result set.
--
-- Security: SECURITY INVOKER (the default) — the function runs as the
-- calling (authenticated) role, so table RLS policies apply exactly as they
-- do for any other query. Every subquery *also* filters explicitly by
-- auth.uid() as defense-in-depth; a client can never pass its own user id.
-- No dynamic SQL is used anywhere (no `EXECUTE` on interpolated strings),
-- so there is no SQL-injection surface — `p_query` and friends are used only
-- as normal bound expressions.
--
-- Ranking (see inline scoring, kept in this single function so weights are
-- never scattered across the app):
--   1. Exact title match                 → +100
--   2. Title prefix match                 → +50
--   3. Full-text rank (title A / body B)  → up to +40 (ts_rank_cd, phrase-aware)
--   4. Trigram title/content word_similarity → up to +20 (typo tolerance;
--      threshold is length-adaptive — see body — because `<%` uses >= and
--      short queries otherwise match any shared leading letter)
--   5. Matching tag (task only)           → +15
--   6. Recency (created/entry/start date) → up to +0.5 (tiny tie-breaker only)
--
-- Journal rows also get a +50 literal-substring boost (mirrors task title
-- prefix) so a real "gam" inside "gampled" outranks a fuzzy near-miss.
--
-- Trigram matching only activates for queries of 3+ characters. The
-- word-similarity threshold is length-adaptive: short queries have few
-- trigrams, so a low fixed threshold (0.25) lets anything sharing a leading
-- letter through — e.g. "gam" <% "girlfriend" is exactly 0.25, and pg_trgm's
-- `<%` operator uses >= (not >). Longer queries keep a looser threshold so
-- typos like "calender"→"calendar" still match. 1–2 character queries fall
-- back to prefix/full-text only.
-- ---------------------------------------------------------------------------

create or replace function public.search_planitary(
  p_query text,
  p_entity_types text[] default null,
  p_start_date date default null,
  p_end_date date default null,
  p_task_status text default null,
  p_priorities text[] default null,
  p_sort_mode text default 'relevance',
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  entity_type text,
  entity_id uuid,
  title text,
  excerpt text,
  result_date date,
  start_time timestamptz,
  end_time timestamptz,
  due_time time,
  priority text,
  status text,
  tags text[],
  relevance_score double precision,
  matched_fields text[]
)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_query text := trim(coalesce(p_query, ''));
  v_tsquery tsquery;
  v_use_trigram boolean;
  v_trgm_threshold double precision;
  v_min_trgm_len constant int := 3;
  v_entity_types text[];
  v_task_status text;
  v_priorities text[];
  v_sort_mode text;
  v_limit int;
  v_offset int;
  v_start_date date := p_start_date;
  v_end_date date := p_end_date;
begin
  -- Never execute an empty search.
  if v_query = '' then
    return;
  end if;

  -- websearch_to_tsquery is forgiving of stray punctuation and supports
  -- multi-word queries, "quoted phrases", and -excluded words without
  -- raising a syntax error.
  v_tsquery := websearch_to_tsquery('english', v_query);
  v_use_trigram := length(v_query) >= v_min_trgm_len;

  -- Length-adaptive threshold (see header). Short queries need a stricter
  -- bar; longer queries keep room for typos.
  v_trgm_threshold := case
    when length(v_query) <= 3 then 0.5
    when length(v_query) <= 5 then 0.35
    else 0.3
  end;

  -- pg_trgm's indexable operators (`%`, `<%`, `%>`) compare against this
  -- session/transaction-local threshold rather than an arbitrary literal —
  -- a plain `word_similarity(a, b) > x` function-call comparison is NOT
  -- indexable and forces a sequential scan. Setting this GUC lets the `<%`
  -- operator below use the trigram GIN indexes. Note: `<%` is >= against
  -- this GUC, so the threshold must sit strictly above known false-positive
  -- scores (e.g. 0.25 for "gam"/"girlfriend").
  perform set_config('pg_trgm.word_similarity_threshold', v_trgm_threshold::text, true);

  -- Normalize entity type filter; unknown values are dropped, empty/absent
  -- falls back to searching everything.
  select coalesce(array_agg(distinct lower(t)), array['task', 'journal', 'calendar'])
    into v_entity_types
    from unnest(p_entity_types) as t
    where lower(t) in ('task', 'journal', 'calendar');
  if v_entity_types is null or array_length(v_entity_types, 1) is null then
    v_entity_types := array['task', 'journal', 'calendar'];
  end if;

  -- Normalize task status filter; an invalid value is treated as "no filter".
  v_task_status := nullif(lower(coalesce(p_task_status, '')), '');
  if v_task_status is not null and v_task_status not in ('active', 'completed') then
    v_task_status := null;
  end if;

  -- Normalize priorities; unknown values are dropped. An empty/all-invalid
  -- list falls back to "no priority filter" rather than matching nothing.
  select array_agg(distinct lower(p))
    into v_priorities
    from unnest(coalesce(p_priorities, array[]::text[])) as p
    where lower(p) in ('low', 'medium', 'high');

  -- Normalize sort mode.
  v_sort_mode := lower(coalesce(p_sort_mode, 'relevance'));
  if v_sort_mode not in ('relevance', 'newest', 'oldest') then
    v_sort_mode := 'relevance';
  end if;

  -- Bound pagination — never return unlimited results.
  v_limit := greatest(1, least(coalesce(p_limit, 20), 50));
  v_offset := greatest(0, coalesce(p_offset, 0));

  -- A reversed date range is normalized (swapped) rather than rejected.
  if v_start_date is not null and v_end_date is not null and v_start_date > v_end_date then
    v_start_date := p_end_date;
    v_end_date := p_start_date;
  end if;

  return query
  with task_rows as (
    select
      'task'::text as entity_type,
      t.id as entity_id,
      t.title,
      case
        when t.notes is not null and (
          t.notes ilike ('%' || v_query || '%')
          or (v_use_trigram and word_similarity(v_query, t.notes) > v_trgm_threshold)
        )
        then ts_headline(
          'english', t.notes, v_tsquery,
          'StartSel=<mark>,StopSel=</mark>,MaxWords=30,MinWords=10,MaxFragments=1,ShortWord=1'
        )
        else null
      end as excerpt,
      t.due_date as result_date,
      null::timestamptz as start_time,
      null::timestamptz as end_time,
      t.due_time,
      t.priority,
      t.status,
      coalesce(tag_agg.tags, '{}') as tags,
      (
        (case
          when lower(t.title) = lower(v_query) then 100
          when t.title ilike (v_query || '%') then 50
          else 0
        end)
        + coalesce(ts_rank_cd(t.search_vector, v_tsquery, 32), 0) * 40
        + (case when v_use_trigram then word_similarity(v_query, t.title) * 20 else 0 end)
        + (case when coalesce(tag_agg.tag_match, false) then 15 else 0 end)
        + greatest(0, 5 - (current_date - t.created_at::date))::double precision * 0.1
      ) as relevance_score,
      array_remove(array[
        case
          when t.title ilike ('%' || v_query || '%')
            or (v_use_trigram and word_similarity(v_query, t.title) > v_trgm_threshold)
          then 'title'
        end,
        case
          when t.notes is not null and (
            t.notes ilike ('%' || v_query || '%')
            or (v_use_trigram and word_similarity(v_query, t.notes) > v_trgm_threshold)
          )
          then 'notes'
        end,
        case when coalesce(tag_agg.tag_match, false) then 'tags' end
      ], null) as matched_fields
    from public.tasks t
    left join lateral (
      select
        coalesce(array_agg(distinct tg.name order by tg.name), '{}') as tags,
        bool_or(
          tg.name ilike ('%' || v_query || '%')
          or (v_use_trigram and v_query <% tg.name)
        ) as tag_match
      from public.task_tags tt
      join public.tags tg on tg.id = tt.tag_id
      where tt.task_id = t.id and tg.user_id = auth.uid()
    ) as tag_agg on true
    where t.user_id = auth.uid()
      and 'task' = any(v_entity_types)
      and (v_task_status is null or t.status = v_task_status)
      and (v_priorities is null or array_length(v_priorities, 1) is null or t.priority = any(v_priorities))
      and (v_start_date is null or t.due_date is null or t.due_date >= v_start_date)
      and (v_end_date is null or t.due_date is null or t.due_date <= v_end_date)
      and (
        t.search_vector @@ v_tsquery
        -- `<%` is pg_trgm's indexable word-similarity operator (uses the
        -- pg_trgm.word_similarity_threshold GUC set above) — unlike a bare
        -- `word_similarity(...) > x` comparison, this can use the trigram
        -- GIN index on tasks.title.
        or (v_use_trigram and v_query <% t.title)
        or coalesce(tag_agg.tag_match, false)
      )
  ),
  journal_rows as (
    select
      'journal'::text as entity_type,
      j.id as entity_id,
      -- Journal entries have no title; the highlighted content snippet is
      -- the primary display text (see SearchResult.title on the client).
      coalesce(
        ts_headline(
          'english', j.content, v_tsquery,
          'StartSel=<mark>,StopSel=</mark>,MaxWords=24,MinWords=10,MaxFragments=1,ShortWord=1'
        ),
        left(j.content, 140)
      ) as title,
      null::text as excerpt,
      j.entry_date as result_date,
      null::timestamptz as start_time,
      null::timestamptz as end_time,
      null::time as due_time,
      null::text as priority,
      null::text as status,
      '{}'::text[] as tags,
      (
        -- Literal substring gets a task-title-prefix-like boost so trigram-
        -- only near-misses (and recency) can't outrank a real "gam" in
        -- "gampled" just because another entry contains "game".
        (case when j.content ilike ('%' || v_query || '%') then 50 else 0 end)
        + coalesce(ts_rank_cd(j.search_vector, v_tsquery, 32), 0) * 40
        + (case when v_use_trigram then word_similarity(v_query, j.content) * 15 else 0 end)
        + greatest(0, 5 - (current_date - j.entry_date))::double precision * 0.1
      ) as relevance_score,
      array['content']::text[] as matched_fields
    from public.journal_entries j
    where j.user_id = auth.uid()
      and 'journal' = any(v_entity_types)
      and (v_start_date is null or j.entry_date >= v_start_date)
      and (v_end_date is null or j.entry_date <= v_end_date)
      and (
        j.search_vector @@ v_tsquery
        or j.content ilike ('%' || v_query || '%')
        or (v_use_trigram and v_query <% j.content)
      )
  ),
  calendar_rows as (
    select
      'calendar'::text as entity_type,
      c.id as entity_id,
      c.title,
      case
        when c.details is not null and (
          c.details ilike ('%' || v_query || '%')
          or (v_use_trigram and word_similarity(v_query, c.details) > v_trgm_threshold)
        )
        then ts_headline(
          'english', c.details, v_tsquery,
          'StartSel=<mark>,StopSel=</mark>,MaxWords=30,MinWords=10,MaxFragments=1,ShortWord=1'
        )
        else null
      end as excerpt,
      c.start_time::date as result_date,
      c.start_time,
      c.end_time,
      null::time as due_time,
      null::text as priority,
      null::text as status,
      '{}'::text[] as tags,
      (
        (case
          when lower(c.title) = lower(v_query) then 100
          when c.title ilike (v_query || '%') then 50
          else 0
        end)
        + coalesce(ts_rank_cd(c.search_vector, v_tsquery, 32), 0) * 40
        + (case when v_use_trigram then word_similarity(v_query, c.title) * 20 else 0 end)
        + greatest(0, 5 - (current_date - c.start_time::date))::double precision * 0.1
      ) as relevance_score,
      array_remove(array[
        case
          when c.title ilike ('%' || v_query || '%')
            or (v_use_trigram and word_similarity(v_query, c.title) > v_trgm_threshold)
          then 'title'
        end,
        case
          when c.details is not null and (
            c.details ilike ('%' || v_query || '%')
            or (v_use_trigram and word_similarity(v_query, c.details) > v_trgm_threshold)
          )
          then 'details'
        end
      ], null) as matched_fields
    from public.calendar_events c
    where c.user_id = auth.uid()
      and 'calendar' = any(v_entity_types)
      and (v_start_date is null or c.start_time::date >= v_start_date)
      and (v_end_date is null or c.start_time::date <= v_end_date)
      and (
        c.search_vector @@ v_tsquery
        or (v_use_trigram and v_query <% c.title)
      )
  ),
  combined as (
    select * from task_rows
    union all
    select * from journal_rows
    union all
    select * from calendar_rows
  )
  select *
  from combined
  order by
    -- Explicitly qualified: the RETURNS TABLE output columns (result_date,
    -- relevance_score, ...) are otherwise ambiguous with the identically
    -- named columns produced by the `combined` CTE.
    case when v_sort_mode = 'newest' then combined.result_date end desc nulls last,
    case when v_sort_mode = 'oldest' then combined.result_date end asc nulls last,
    combined.relevance_score desc,
    combined.result_date desc nulls last
  limit v_limit offset v_offset;
end;
$$;

-- Only authenticated users may call this function; it relies on auth.uid().
revoke all on function public.search_planitary(
  text, text[], date, date, text, text[], text, int, int
) from public;
grant execute on function public.search_planitary(
  text, text[], date, date, text, text[], text, int, int
) to authenticated;
