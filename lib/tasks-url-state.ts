// ---------------------------------------------------------------------------
// URL <-> state for the Tasks page's List/Inbox scope. Pure functions so the
// selected scope survives refresh, browser back/forward, and sharing — same
// pattern as lib/search.ts's parseSearchState/buildSearchParams.
//
// URL shape:
//   /tasks                 -> { type: "all" }      (default, unchanged from before Lists)
//   /tasks?view=inbox       -> { type: "inbox" }
//   /tasks?list=<uuid>      -> { type: "list", id: "<uuid>" }
//
// Invalid, foreign, or deleted list ids fall back to "all" rather than
// throwing or leaking another user's data.
// ---------------------------------------------------------------------------

export type TasksScope = { type: "all" } | { type: "inbox" } | { type: "list"; id: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Parses `?list=` / `?view=` into a TasksScope. `ownedListIds` should contain
 *  every List id the current user owns (from the already-loaded lists array),
 *  so a foreign or stale id safely falls back to "all". */
export function parseTasksScope(
  params: URLSearchParams,
  ownedListIds: ReadonlySet<string>
): TasksScope {
  const listId = params.get("list");
  if (listId && UUID_RE.test(listId) && ownedListIds.has(listId)) {
    return { type: "list", id: listId };
  }

  const view = params.get("view");
  if (view === "inbox") {
    return { type: "inbox" };
  }

  return { type: "all" };
}

/** Serializes a TasksScope back into URL query params. */
export function buildTasksScopeParams(scope: TasksScope): URLSearchParams {
  const params = new URLSearchParams();
  if (scope.type === "list") {
    params.set("list", scope.id);
  } else if (scope.type === "inbox") {
    params.set("view", "inbox");
  }
  return params;
}
