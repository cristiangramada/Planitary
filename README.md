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

### Layout

Desktop (`lg+`): two columns — **Today's tasks** and **Today's events** stacked on the left (2/3 width); **Journal** on the right (1/3), stretched to match the left column height. On narrow screens the sections stack: tasks → events → journal.

### Sections

1. **Header** — time-of-day greeting (`Good morning`/`afternoon`/`evening`, plus the profile's `display_name` if set) and the friendly local date.
2. **Today's tasks** — active tasks due today (`lib/tasks.ts:fetchTasksDueOn`), rendered with the same `TaskCard` as `/tasks` (including right-click Edit/Delete). Header **Add task** opens `TaskForm` with due date defaulted to today. Sorted by shared `TASK_PRIORITY_ORDER`, then due time.
3. **Today's events** — events starting today (`lib/calendar.ts:fetchEventsBetween`), chronological, with a "Now" badge when an event is in progress. Header **Add event** opens `EventForm` for today; right-click uses the same Edit/Delete menu as the Calendar agenda.
4. **Journal** — today's entries with the same click-to-edit row as `/journal`, plus an inline quick-add. Right-click deletes an entry (same menu as Journal).

### Data fetching

`lib/dashboard.ts:fetchDashboardData(supabase, todayStr)` runs the bounded section queries in parallel via `Promise.all`, wrapping each in `settle()` so one section's failure never blocks the others — each section carries its own `{ data, error }`. The Server Component (`app/dashboard/page.tsx`) fetches with the server clock's date; `DashboardClient` re-runs with the browser's local date if that differs (same pattern as Journal; server clock is UTC on Vercel), and after mutations that need a full refresh.

### Deep links

- `/tasks?task=<id>` (existing) — not used by Dashboard edit (form opens in place).
- `/journal?date=<date>&entry=<id>` (existing) — available from Search; Dashboard journal edits in place.
- `/journal?section=standup` — expands and scrolls to Standup on the Journal page (`StandupSection` `autoExpand`).

### Components reused

`AppShell`, `TaskCard`, `TaskForm`, `EventForm`, `AgendaItemContextMenu`, `JournalEntryRow`, `JournalEntryContextMenu`, and the mutation helpers in `lib/tasks.ts`, `lib/calendar.ts`, `lib/journal.ts`.

### Components added

`app/dashboard/DashboardClient.tsx`, `DashboardSection.tsx`, `JournalPreview.tsx`, `EventsPreview.tsx`.

### Shared extractions

- `TASK_PRIORITY_ORDER` in `lib/tasks.ts` (Tasks + Dashboard).
- `hooks/useClientLocalToday.ts` (`useClientLocalToday`, `useClientLocalHour`) shared by Journal and Dashboard.
- `app/journal/JournalEntryRow.tsx` shared by Journal and Dashboard.

### Related Tasks page changes (same branch)

- Filter tabs: All / Active / Overdue / Completed (Overdue = active tasks with `due_date` before today).
- Sort options include Newest first / Oldest first; choice is persisted per account in localStorage (`lib/tasks-sort-preference.ts`).
- Completed list is always expanded (no fold control). Completed cards no longer show a Reopen button (checkbox still reopens).

### Known limitations

- Section "Retry" re-runs the full dashboard query set (cheap/bounded), so unrelated sections may briefly show "Refreshing…".
- Mobile order is tasks → events → journal.

### Manual testing checklist

- [ ] Greeting matches local time of day and shows `display_name` only when set.
- [ ] Completing a task on the Dashboard removes it from Today's tasks.
- [ ] **Add task** / empty-state flows create a task due today and it appears in Today's tasks.
- [ ] **Add event** creates today's event and it appears in Today's events; right-click Edit/Delete works.
- [ ] Journal quick-add appears in the list; click-to-edit and right-click delete work.
- [ ] Two-column layout holds on desktop; stacks cleanly on mobile; no horizontal scroll.
- [ ] A Calendar query failure still renders Tasks/Journal with a section-level error + Retry for Events only.
- [ ] Dark and light mode both render correctly.
- [ ] Tasks page: Overdue filter, Oldest/Newest sort persistence across reload, and Completed list without fold.

## Lists (Tasks page)

`/tasks` adds a TickTick-style **Lists** panel alongside the existing smart-view filter tabs (All / Active / Overdue / Completed), which are unchanged. A List is a user-owned container for Tasks; a Task belongs to zero or one List. This is a V1 — see [Known limitations](#known-limitations-2) below for what's intentionally out of scope.

### Database

- **Migrations:** `supabase/migrations/0006_task_lists.sql` and `0007_search_list_support.sql` (run in order; do not modify `0001`–`0005`).
- **Schema:** `public.task_lists (id, user_id, name, color, icon, position, created_at, updated_at)`; `public.tasks` gains a nullable `list_id uuid references public.task_lists(id) on delete set null`.
- **Inbox is not a database row.** A task with `list_id = null` is the "Inbox" system view — same convention as the existing smart views (All/Active/Overdue/Completed), which also aren't stored rows.
- **Deleting a List never deletes its Tasks.** `on delete set null` moves them to Inbox automatically; the app also mirrors this locally so the UI doesn't need a refetch.
- **Uniqueness:** a unique index on `(user_id, lower(name))` enforces case-insensitive duplicate names ("Work" / "work" / " WORK " all conflict) at the database level; the client also validates before submitting for instant feedback.
- **Ownership:** a `before insert or update of list_id` trigger (`enforce_task_list_ownership`) rejects assigning a task to a List the task's `user_id` doesn't own — defense-in-depth on top of RLS, since the foreign key alone doesn't check ownership.
- **Indexes:** `task_lists(user_id)`, `task_lists(user_id, position)`, `tasks(list_id)`, plus the unique `(user_id, lower(name))` index above.
- **RLS:** `task_lists` has the same four-policy pattern (`select/insert/update/delete own`, `auth.uid() = user_id`) as every other user-owned table. `tasks` RLS is unchanged.
- **Colors:** a fixed 8-key palette (`red/orange/yellow/green/blue/purple/pink/gray`, see `lib/task-lists.ts:LIST_COLOR_SWATCH`) — the stored value is the color *key*, not a hex/CSS value, so the palette can be restyled without a migration. Color is optional.
- **Search:** `search_planitary()` (from `0004_search.sql`) is recreated in `0007` to also return `list_name` for task rows and let a matching List name weakly boost relevance (+8) — well below an exact/prefix title match (+100/+50) or a tag match (+15), so it can never outrank a real title match.

### Application layer

| Concern | File |
|---|---|
| `TaskList` type, `Task.list_id`, `TaskWithDetails.list` | `types/index.ts` |
| List CRUD, color palette, name validation, count aggregation | `lib/task-lists.ts` |
| Task fetch/create/update — `list_id` plumbed through `TASK_SELECT` | `lib/tasks.ts` |
| Scope (`all`/`inbox`/`list:<id>`) ⇄ URL helpers | `lib/tasks-url-state.ts` |
| Lists panel (smart views, Lists, add/rename/delete UI) | `app/tasks/ListsPanel.tsx` |
| List right-click/overflow menu (Rename, Change color, Delete) | `app/tasks/ListContextMenu.tsx` |
| List selector in the Task form | `app/tasks/TaskForm.tsx` |
| "Move to list" submenu on the task context menu | `app/calendar/AgendaItemContextMenu.tsx` (shared with Calendar events; the submenu only renders when a `lists` prop is passed, so Calendar's usage is unaffected) |
| Task row's subtle List chip + move handler wiring | `app/tasks/TaskCard.tsx` |
| Search's `listName`/`"list"` matched field | `lib/search.ts`, `types/search.ts`, `app/search/SearchResultRow.tsx` |

### Behavior

- **Task counts** shown beside each List (and Inbox) are **active tasks only**, computed client-side from the Tasks page's already-loaded task set (`computeListTaskCounts`) — no extra query, no N+1.
- **Creating a task while a custom List is selected** auto-assigns `list_id` to that List; Inbox and smart views default new tasks to Inbox. The Task form's List selector can always override this before saving.
- **Moving a task** (Edit form's List selector, or the task context menu's "Move to list") updates `list_id` optimistically, with rollback + an inline error ("Couldn't move the task.") on failure.
- **Deleting a List** shows a confirmation naming the List and stating its Tasks move to Inbox; after confirming, the List's Tasks are preserved with `list_id = null`, and if the deleted List was selected, the view falls back to Inbox.
- **A deleted or foreign List id in the URL** (`?list=<id>`) falls back to the "All Tasks" view rather than erroring or leaking another user's data — verified by `parseTasksScope`'s unit tests.

### URL parameters

`/tasks` (default, All Tasks — unchanged from before Lists) · `/tasks?view=inbox` (Inbox) · `/tasks?list=<uuid>` (a custom List). Selecting a scope uses `router.push` (not `replace`), so browser Back/Forward step through List/view changes; refreshing preserves the current scope.

### Mobile

The Lists panel is a persistent ~240px column on desktop (`lg+`), and a left slide-over drawer on mobile (reusing `AppShell`'s existing overlay + translate-x pattern), opened via a "Lists" button in the Tasks header. List creation, rename, delete, and color are all available from the same panel on both layouts — nothing is desktop-only.

### Known limitations

- **V1 does not include:** folders, sections within a List, shared/collaborative Lists, List permissions, archived Lists, or assigning one Task to multiple Lists. The schema/types are intentionally minimal so these could be added later without a Tasks rewrite.
- The Task form's List selector (built on the existing `PickerSelect`) shows List names but not color swatches inline in the dropdown list — `PickerSelect`'s option type is plain-text and is shared elsewhere in the app, so it wasn't widened just for this. The List's color still appears everywhere else (Lists panel, task row chip, context menu).
- **No local Supabase/Postgres test environment exists in this repo** (no `supabase/config.toml`), so RLS cross-user isolation, the ownership trigger, the `on delete set null` cascade, and the unique-index duplicate rejection are **not** covered by the automated test suite — see the manual Supabase steps below. Everything expressible as a pure function (name validation, URL scope parsing, count aggregation, search row normalization) has unit tests instead.

### Manual Supabase steps

- [ ] Apply `supabase/migrations/0006_task_lists.sql`, then `0007_search_list_support.sql` (SQL editor or `supabase db push`), in that order.
- [ ] Confirm `task_lists` has RLS enabled with 4 policies (Database → Tables → task_lists → RLS).
- [ ] Confirm the unique index `task_lists_user_id_name_lower_idx` exists (Database → Indexes).
- [ ] As User A, create a List, then as User B confirm `select * from task_lists` (via the app, not the SQL editor's superuser context) never returns User A's List.
- [ ] As User A, attempt to `update tasks set list_id = '<a User B list id>' where id = '<a User A task id>'` directly in the SQL editor while impersonating User A (`set local role authenticated; set local request.jwt.claims = ...`) and confirm the ownership trigger raises an exception.
- [ ] Delete a List with Tasks in it and confirm the Tasks still exist afterward with `list_id = null`.
- [ ] Attempt to create two Lists named `Work` and `work` for the same user and confirm the second is rejected.

### Manual testing checklist

- [ ] Create a List, select it, and confirm only its Tasks show.
- [ ] Create a Task while a List is selected; confirm it's assigned to that List without extra steps.
- [ ] Create a Task from Inbox/All Tasks/a smart view; confirm it defaults to Inbox.
- [ ] Move a Task via the Edit form's List selector, and separately via the task's right-click → "Move to list"; confirm it disappears from the old List's view and appears in the new one.
- [ ] Move a Task to Inbox; confirm `list_id` becomes null.
- [ ] Rename a List; confirm Enter saves, Escape cancels, and a duplicate name is rejected with the existing name preserved.
- [ ] Delete a List with Tasks; confirm the confirmation mentions Inbox, the Tasks survive, and the view falls back to Inbox if it was selected.
- [ ] Refresh on `/tasks?list=<id>` and confirm the same List stays selected; use Back/Forward after switching Lists.
- [ ] Visit `/tasks?list=<a deleted or nonexistent id>` and confirm it falls back to All Tasks without an error.
- [ ] Confirm existing (pre-Lists) Tasks appear in Inbox.
- [ ] Confirm the existing sort options, tag filter, and Completed section all still work identically within a selected List.
- [ ] Search for a List's name and confirm a Task in that List can appear in results with the List name shown, without outranking an exact title match elsewhere.
- [ ] Confirm the Dashboard's Today's tasks section is unaffected (still shows tasks due today regardless of List).
- [ ] Mobile: open the Lists drawer from the Tasks header, select/create/rename/delete a List, and confirm no horizontal overflow.
- [ ] Dark mode and light mode both render the Lists panel, color swatches, and context menus correctly.

