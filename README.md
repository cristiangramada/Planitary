This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## AI — Journal Standup (OpenRouter)

The Journal page's **Standup** section generates a copy-ready weekly update from your journal entries using [OpenRouter](https://openrouter.ai). Generation happens entirely server-side — the OpenRouter API key never reaches the browser, and journal content is never logged.

### Environment variables

```env
OPENROUTER_API_KEY=
OPENROUTER_MODEL=google/gemma-4-26b-a4b-it:free
OPENROUTER_FALLBACK_MODEL=google/gemma-4-31b-it:free
```

- **Getting an API key**: sign up at [openrouter.ai](https://openrouter.ai), then create a key at [openrouter.ai/keys](https://openrouter.ai/keys).
- **Local development**: add the three variables above to `.env.local` (never commit real values).
- **Vercel**: add the same three variables under Project Settings → Environment Variables for every environment (Development/Preview/Production) that should support the Standup feature. Redeploy after saving.
- **Server-only**: none of these variables use the `NEXT_PUBLIC_` prefix. They are only read inside `lib/ai/*`, `lib/standup.ts`, and `app/api/ai/standup/route.ts` — all server-side code.

### Why a fixed model instead of `openrouter/free`

`openrouter/free` auto-routes each request to a different underlying free model, which produces inconsistent tone and formatting between generations. Planitary always uses the exact model IDs configured in `OPENROUTER_MODEL` / `OPENROUTER_FALLBACK_MODEL`. If either variable is unset, or is set to `openrouter/free`, the Standup feature returns a clear "not configured" error instead of silently choosing a different model.

### Fallback behavior

Each generation makes **at most one primary attempt and one fallback attempt**:

1. `OPENROUTER_MODEL` is tried first.
2. If that request fails for a provider-level reason (model unavailable, rate limited, or a timeout), `OPENROUTER_FALLBACK_MODEL` is tried once.
3. If the primary succeeds, the fallback is never called. If both fail, the request fails with a typed error.

To change either model, just update the corresponding environment variable — no code changes are required.

### Known limitations of free OpenRouter models

- Free-tier models can change availability, rate limits, or be deprecated by OpenRouter without notice. If generation stops working, verify the configured model IDs are still listed at [openrouter.ai/models](https://openrouter.ai/models).
- Free models may have lower/variable request-per-minute limits than paid models; the Standup feature applies a request timeout and a single fallback attempt, but does not implement retry-with-backoff or per-user quotas.

### Where things live

| Concern | Location |
| --- | --- |
| Feature-agnostic AI types/errors | `lib/ai/types.ts`, `lib/ai/errors.ts` |
| Model + generation-parameter config | `lib/ai/config.ts` |
| Generic provider interface + fallback policy | `lib/ai/provider.ts` |
| OpenRouter implementation | `lib/ai/openrouter-provider.ts` |
| Standup prompt builder (Journal-specific) | `lib/ai/prompts/standup-prompt.ts` |
| Standup data rules (date validation, retrieval, truncation) | `lib/standup.ts` |
| Standup API route | `app/api/ai/standup/route.ts` |
| Standup UI | `app/journal/StandupSection.tsx` |

A future AI-assisted Search feature can reuse `lib/ai/config.ts`, `lib/ai/provider.ts`, and `lib/ai/openrouter-provider.ts` as-is — it only needs its own prompt builder (e.g. `lib/ai/prompts/search-prompt.ts`) and its own entries in `AI_FEATURE_SETTINGS`/`AIFeature`.

### Manual testing checklist

- [ ] With no `OPENROUTER_API_KEY` set, clicking **Generate standup** shows a "not configured" message (no crash).
- [ ] With valid credentials, the default range covers the last 7 days and generation succeeds.
- [ ] Selecting a custom start/end date and generating produces an update scoped to that range.
- [ ] Selecting a reversed range (start after end) or a range over 31 days disables **Generate** and shows an inline error.
- [ ] Selecting a range with zero journal entries shows "No journal entries were found for this date range." without an error banner.
- [ ] The output textarea is editable, and **Copy** copies the edited text (verify by editing then pasting elsewhere).
- [ ] Changing either date after generating clears the previous result.
- [ ] **Regenerate** replaces the output; **Clear** removes it.
- [ ] Journal entry creation, editing, deletion, sorting, and date navigation still all work as before.
- [ ] Dark mode and light mode both render the Standup section correctly.
- [ ] Works on a narrow (mobile-width) viewport without horizontal overflow.

## Search

`/search` searches Tasks, Journal entries, and Calendar events (and task Tags) using PostgreSQL full-text search and `pg_trgm` typo tolerance — **no AI, no embeddings, no OpenRouter call**. It's built so a future AI layer can produce the same structured filters and call the same RPC without any rework of the page.

### Database

- **Migration:** `supabase/migrations/0004_search.sql` (run in the Supabase SQL editor or via `supabase db push` — does not modify `0001`–`0003`).
- **Extension enabled:** `pg_trgm`.
- **Search vectors** (generated, stored `tsvector` columns, always in sync — no separate search-document table):
  - `tasks.search_vector` — `title` weight **A**, `notes` weight **B**.
  - `calendar_events.search_vector` — `title` weight **A**, `details` weight **B**. (The schema has no `location` column, so there's no weight-C field.)
  - `journal_entries.search_vector` — `content` weight **A** (single-field document).
  - Task tags aren't baked into the tasks vector (tag names live in a joined table); instead the RPC checks a tag match via a `LEFT JOIN LATERAL` against `task_tags`/`tags` and folds it into the same ranking.
- **Indexes:**
  - GIN on each `search_vector` (full-text search).
  - GIN trigram (`gin_trgm_ops`) on `tasks.title`, `calendar_events.title`, `journal_entries.content`, and `tags.name` — trigram indexes are added **only** on fields that benefit from typo/partial matching, not on every text column.
- **RPC:** `public.search_planitary(p_query, p_entity_types, p_start_date, p_end_date, p_task_status, p_priorities, p_sort_mode, p_limit, p_offset)`, `security invoker` (runs as the calling authenticated user, so table RLS applies normally) **and** every subquery additionally filters by `auth.uid()` explicitly — the client can never pass a user id. No dynamic SQL/`EXECUTE` is used anywhere, so there's no SQL-injection surface.
- **Query parsing:** `websearch_to_tsquery('english', query)` — tolerant of stray punctuation, supports `"quoted phrases"` and `-excluded words` without erroring.
- **Typo tolerance:** `pg_trgm`'s indexable **word-similarity** operator (`<%`, threshold `0.25`, set via the `pg_trgm.word_similarity_threshold` GUC inside the function) — not a bare `similarity()`/`word_similarity()` comparison, which isn't indexable and forces a sequential scan. Word-similarity (rather than whole-string `similarity()`) is what lets a short typo'd query (e.g. `calender`) still match a much longer title (e.g. "Calendar redesign polish"). Trigram matching only activates for queries of 3+ characters, so 1–2 character queries fall back to prefix/full-text matching.
- **Ranking** (combined additively, all in this one function — see its header comment for the full breakdown): exact title match (+100) → title prefix match (+50) → full-text rank via `ts_rank_cd` (title weight A / body weight B, up to +40) → trigram word-similarity (up to +20) → matching tag, tasks only (+15) → recency tie-breaker (up to +0.5). Completed tasks are never hidden unless the status filter excludes them.
- **Excerpts/highlighting:** `ts_headline()` wraps matched terms in a fixed, controlled `<mark>...</mark>` marker. The client (`app/search/highlightText.tsx`) never uses `dangerouslySetInnerHTML` — it splits the plain-text string on the literal `<mark>`/`</mark>` substrings and renders each segment as a React text node, so arbitrary content is always escaped by React regardless of what it contains.
- **Validated locally:** the migration was applied and exercised against a throwaway Postgres 16 container (stubbing Supabase's `auth` schema) during development — ranking order, cross-user isolation, typo tolerance, phrase queries, all filters, pagination, and reversed-date normalization were checked directly, and `EXPLAIN`/`EXPLAIN ANALYZE` at 5,000+ rows/table confirmed the planner uses `BitmapOr` over the full-text **and** trigram GIN indexes (not a sequential scan). This isn't a substitute for running it against a real Supabase project — see the manual checklist below.

### Application layer

| Concern | File |
|---|---|
| Shared search types (`SearchResult`, `SearchFilters`, `SearchQueryState`, `SearchSortMode`, ...) | `types/search.ts` |
| RPC caller, row normalization, URL ⇄ state helpers | `lib/search.ts` |
| Page shell, URL sync, debouncing, pagination, stale-request handling | `app/search/SearchClient.tsx` |
| Date range / task status / priority / sort controls | `app/search/SearchFiltersPanel.tsx` |
| One result row (type icon, highlighted title/excerpt, metadata, tags) | `app/search/SearchResultRow.tsx` |
| Safe `<mark>`-marker highlighting (no raw HTML rendering) | `app/search/highlightText.tsx` |
| Recent searches (`localStorage` only, no Supabase table) | `app/search/useRecentSearches.ts` |
| Debounce (no existing utility/dependency — minimal custom hook) | `app/search/useDebouncedValue.ts` |

`types/search.ts` is intentionally independent of `lib/ai/types.ts` — a future AI layer can extract a `SearchFilters` object from natural language and call `runSearch()` directly with it, without any coupling to today's Search UI.

### URL parameters

`/search?q=<text>&type=<all|task|journal|calendar>&start=<date>&end=<date>&status=<active|completed>&priority=<comma list>&sort=<relevance|newest|oldest>`

- Typing is debounced (300ms) and written to the URL with `replace` (no history spam while typing); tab/filter/sort changes use `push` (deliberate navigation, back button works).
- Unknown/malformed values fall back safely to defaults instead of throwing (e.g. `type=bogus` → all types, `start=not-a-date` → no start filter).
- An in-flight request is superseded (not raced) by a newer one via a request-id counter, so a slow older response can never overwrite a newer query's results — the installed `@supabase/postgrest-js` version doesn't expose `AbortSignal` support on `.rpc()`.
- Pagination is a **Load more** button, 20 results per page (`SEARCH_PAGE_SIZE`), requesting one extra row to cheaply know if another page exists; changing the query/filters/tab/sort always resets to page 1.

### Result navigation

- **Task** → `/tasks?task=<id>` — `TasksClient` reads the param, opens the existing `TaskForm` editor, then clears the param.
- **Journal** → `/journal?date=<date>&entry=<id>` — `JournalClient` selects that date, scrolls the matching entry into view, and briefly (2s) highlights it, then clears the params.
- **Calendar** → `/calendar?event=<id>&date=<date>` — `CalendarClient` navigates to that date and opens the existing `EventForm` editor, then clears the params.

No second Task/Event/Journal-entry detail UI was created — all three reuse their existing forms/components.

### Known limitations

- `matched_fields` (used for the "which field matched" hint) is computed with a best-effort `ILIKE`/trigram substring check per field, not a true per-field decomposition of the combined `tsvector` match — for a multi-word query that matches across two fields via full-text search alone, it can occasionally be empty even though the row matched.
- Sorting by "Newest"/"Oldest" uses: task due date, journal entry date, calendar start date. Tasks without a due date sort last regardless of direction.
- Recent searches are local to the browser (not synced across devices) and don't store filters — only the query text.

### Manual Supabase steps

- [ ] Apply `supabase/migrations/0004_search.sql` (SQL editor or `supabase db push`).
- [ ] Confirm `pg_trgm` shows as enabled under Database → Extensions.
- [ ] Confirm `search_planitary` appears under Database → Functions with `security invoker` and is only executable by the `authenticated` role (not `anon`/`public`).

### Manual testing checklist

- [ ] Searching "authentication" (or any term matching a task title) ranks that task above a journal entry that only loosely mentions the term.
- [ ] Typo'd queries (e.g. "calender", "authetication") still find the intended results.
- [ ] `"quoted phrase"` and `word -excluded` queries don't error.
- [ ] Switching the All/Tasks/Journal/Calendar tabs updates results and the URL.
- [ ] Date range, task status, and priority filters narrow results correctly; **Clear filters** resets them without clearing the query.
- [ ] Sorting by Relevance/Newest/Oldest changes order as expected.
- [ ] Refreshing the page, or using browser Back/Forward, preserves the exact search state.
- [ ] Typing quickly doesn't flash intermediate result sets or show a stale response.
- [ ] **Load more** appends another page without resetting scroll or duplicating rows.
- [ ] Clicking a Task/Journal/Calendar result navigates to and opens/highlights the correct item.
- [ ] Signing in as a second user never surfaces the first user's tasks/journal/calendar/tags.
- [ ] Empty query shows the "Search Planitary…" prompt (or recent searches); a query with no matches shows the "No results found" state with suggestions.
- [ ] Dark mode and light mode both render correctly; layout holds on a narrow (mobile-width) viewport.

## Dashboard

`/dashboard` is the "Today" page — a daily overview built entirely from existing Task, Calendar, and Journal logic. **No AI, no OpenRouter call.**

### Sections

1. **Header** — time-of-day greeting (`Good morning`/`afternoon`/`evening`, plus the profile's `display_name` if set), the friendly local date, and a Search field that pushes to `/search?q=...`.
2. **Quick actions** — New Task, New Event, Add Journal Entry (focuses the quick-add input below), Generate Standup (`/journal?section=standup`).
3. **Today's tasks** — active tasks due today (`lib/tasks.ts:fetchTasksDueOn`), rendered with the same `TaskCard` component as `/tasks`, sorted by the shared `TASK_PRIORITY_ORDER` then due time.
4. **Today's events** — events starting today (`lib/calendar.ts:fetchEventsBetween`), chronological, with a "Now" badge for an event currently in progress.
5. **Overdue** — active tasks with `due_date` before today (`lib/tasks.ts:fetchOverdueActiveTasks`), oldest first. The section is hidden entirely when there are none.
6. **Journal** — today's entries (`lib/journal.ts:fetchJournalEntriesByDate`), read-only rows (no timestamps) plus a compact quick-add that calls `createJournalEntry` directly.
7. **Weekly progress** — deterministic stats only (see below), with a "Weekly standup" shortcut to `/journal?section=standup`.

### Data fetching

`lib/dashboard.ts:fetchDashboardData(supabase, todayStr)` runs all of the above in parallel via `Promise.all`, wrapping each in a small `settle()` helper so one section's failure (e.g. Calendar) never blocks the others — each section carries its own `{ data, error }`. The Server Component (`app/dashboard/page.tsx`) calls this once with the server clock's date; the Client Component (`app/dashboard/DashboardClient.tsx`) re-runs it with the browser's local date if that differs (same pattern as the Journal page, since the server clock is UTC on Vercel), and after any mutation that isn't fully covered by an optimistic local update.

### Weekly progress definition

Week = **Sunday–Saturday**, matching the Calendar's existing `getWeekStart` convention (`app/calendar/calendarUtils.ts`), not the Mon–Sun default.

- **Tasks completed** — `status = 'completed'` and `completed_at` within the week.
- **Tasks active** — `status = 'active'` and `due_date` within the week (regardless of whether that's today, later this week, or already past).
- **Journal days** — distinct `entry_date`s with at least one entry this week (0–7).
- **Calendar events this week** — count of events with `start_time` in the week.
- **Completion %** — `tasksCompleted / (tasksCompleted + tasksActiveDue)`, rounded; shown as "No tasks scheduled this week" instead of `0%` when the denominator is 0.

### Deep links used

- `/tasks?task=<id>` (existing) — Overdue/Today's tasks "Edit" reuses the on-page `TaskForm`, not this deep link (form opens in place).
- `/journal?date=<date>&entry=<id>` (existing) — Journal preview rows.
- `/journal?section=standup` (**new**) — Weekly standup / Generate Standup shortcuts. Adds an optional `autoExpand` prop to `StandupSection` and a `section` search param handled in `JournalClient.tsx`; expands the section and scrolls it into view, then clears the param.
- `/search?q=<query>` — header search field.

### Components reused (unmodified)

`AppShell`, `TaskCard`, `TaskForm`, `EventForm`, and the mutation functions in `lib/tasks.ts`, `lib/calendar.ts`, `lib/journal.ts`. Task/Event/Journal validation, timestamps, and cascades are therefore identical to their source pages by construction.

### Components added

`app/dashboard/DashboardClient.tsx` (orchestrator), `DashboardSection.tsx` (shared card/header/error/skeleton/empty-state primitives), `WeeklyProgress.tsx`, `JournalPreview.tsx`, `EventsPreview.tsx`.

### Small shared-logic extractions (to avoid duplicating rules the Dashboard also needs)

- `TASK_PRIORITY_ORDER` moved from `TasksClient.tsx` into `lib/tasks.ts` (single source for the "priority, then due time" sort used by both `/tasks` and the Dashboard).
- The local-date/local-hour `useSyncExternalStore` hooks moved from `JournalClient.tsx` into `hooks/useClientLocalToday.ts` (`useClientLocalToday`, `useClientLocalHour`), used by both Journal and Dashboard.

### Known limitations

- Section "Retry" buttons re-run the full bounded query set rather than retrying just the failed section — acceptable because every query here is cheap and bounded, but it does mean an unrelated section may briefly show its own "Refreshing…" state too.
- No global `Cmd+K`/`Ctrl+K` search shortcut was added (optional in the spec); Search is reachable via the sidebar, the header field, and the Quick actions row.
- Mobile stacking order is: Today's tasks → Today's events → Journal → Overdue → Weekly progress (the two-column desktop layout is implemented as two independently-stacking columns, so Overdue/Weekly appear after the main column's three sections on narrow screens rather than interleaved).
- "New Task"/"New Event" quick actions default to today; there's no dedicated Dashboard-only creation form, by design.

### Manual testing checklist

- [ ] Greeting matches the local time of day and shows the display name only when `profiles.display_name` is set.
- [ ] Completing a task on the Dashboard removes it from Today's tasks/Overdue and updates Weekly progress shortly after.
- [ ] Creating a task due today (via Quick actions) appears in Today's tasks without a page reload.
- [ ] Creating an event today (via Quick actions or "Add an event") appears in Today's events.
- [ ] Adding a journal entry (Quick actions or the inline quick-add) appears at the top of the Journal preview.
- [ ] The Overdue section is hidden when there are no overdue tasks, and appears when one exists.
- [ ] "Generate Standup" and "Weekly standup" navigate to `/journal`, auto-expand the Standup section, and scroll it into view — no request to OpenRouter happens from the Dashboard.
- [ ] The header Search field navigates to `/search?q=...`.
- [ ] Simulating a Calendar query failure still renders Tasks/Journal/Weekly progress normally, with a section-level error + Retry for Events only.
- [ ] Dark and light mode both render correctly; the layout holds (no horizontal scroll) at common mobile widths.
