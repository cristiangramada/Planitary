import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAppendToContainerUpdates,
  buildCustomPositionUpdates,
  compareCustomOrder,
  reorderWithinContainer,
  sortByCustomOrder,
  type CustomOrderable,
} from "@/lib/tasks-custom-order";
import { buildNextOccurrenceInsert } from "@/lib/tasks";
import { TASKS_SORT_KEYS, parseTasksSortPreferenceRaw } from "@/lib/tasks-sort-preference";
import { reorderIds, shouldStartPointerDrag } from "@/utils/reorder";

// ---------------------------------------------------------------------------
// Fixtures — a container is a List, or Inbox (list_id null). Tasks carry only
// the fields Custom ordering reads.
// ---------------------------------------------------------------------------

let clock = 0;

/** A task created after every previously-built task, unpositioned by default. */
function task(id: string, custom_position: number | null = null): CustomOrderable {
  clock += 1;
  return {
    id,
    custom_position,
    created_at: `2026-01-01T00:00:${String(clock).padStart(2, "0")}.000Z`,
  };
}

function ids(tasks: CustomOrderable[]): string[] {
  return tasks.map((t) => t.id);
}

/** Applies position updates the way TasksClient does optimistically, and the
 *  way a refetch would come back from Supabase. */
function applyUpdates(
  tasks: CustomOrderable[],
  updates: { id: string; custom_position: number }[]
): CustomOrderable[] {
  const applied = new Map(updates.map((u) => [u.id, u.custom_position]));
  return tasks.map((t) =>
    applied.has(t.id) ? { ...t, custom_position: applied.get(t.id)! } : t
  );
}

/** One full drag: map the drop onto the container order, then persist. */
function drag(
  container: CustomOrderable[],
  visibleIds: string[],
  draggedId: string,
  insertAt: number
): { tasks: CustomOrderable[]; updates: { id: string; custom_position: number }[] } {
  const ordered = reorderWithinContainer(ids(sortByCustomOrder(container)), visibleIds, draggedId, insertAt);
  if (!ordered) return { tasks: container, updates: [] };
  const updates = buildCustomPositionUpdates(
    ordered,
    new Map(container.map((t) => [t.id, t.custom_position]))
  );
  return { tasks: applyUpdates(container, updates), updates };
}

// ---------------------------------------------------------------------------

describe("Custom sort option", () => {
  it("is offered alongside the existing sorts", () => {
    assert.ok(TASKS_SORT_KEYS.includes("custom"));
    assert.deepEqual(
      [...TASKS_SORT_KEYS],
      ["priority", "due_date", "created_at", "created_oldest", "custom"]
    );
  });

  it("round-trips through the stored preference", () => {
    assert.equal(parseTasksSortPreferenceRaw("custom"), "custom");
  });
});

describe("initial ordering", () => {
  it("matches Oldest first when nothing has ever been positioned", () => {
    const oldest = task("oldest");
    const middle = task("middle");
    const newest = task("newest");

    // Deliberately shuffled input — the sort, not the input, decides.
    assert.deepEqual(ids(sortByCustomOrder([newest, oldest, middle])), [
      "oldest",
      "middle",
      "newest",
    ]);
  });

  it("puts unpositioned tasks after positioned ones, still oldest-first", () => {
    const a = task("a", 0);
    const b = task("b", 1);
    const older = task("older-unpositioned");
    const newer = task("newer-unpositioned");

    assert.deepEqual(ids(sortByCustomOrder([newer, older, b, a])), [
      "a",
      "b",
      "older-unpositioned",
      "newer-unpositioned",
    ]);
  });

  it("breaks ties deterministically on created_at then id", () => {
    const sameInstant = "2026-03-01T09:00:00.000Z";
    const bravo = { id: "bravo", custom_position: 3, created_at: sameInstant };
    const alpha = { id: "alpha", custom_position: 3, created_at: sameInstant };
    const earlier = { id: "zulu", custom_position: 3, created_at: "2026-02-01T09:00:00.000Z" };

    assert.deepEqual(ids(sortByCustomOrder([bravo, alpha, earlier])), [
      "zulu",
      "alpha",
      "bravo",
    ]);
    // Same set, different input order — same result.
    assert.deepEqual(ids(sortByCustomOrder([alpha, earlier, bravo])), [
      "zulu",
      "alpha",
      "bravo",
    ]);
    assert.equal(compareCustomOrder(alpha, alpha), 0);
  });
});

describe("reordering", () => {
  it("persists a drag from the middle to the top", () => {
    const container = [task("a"), task("b"), task("c"), task("d")];

    const { tasks, updates } = drag(container, ["a", "b", "c", "d"], "c", 0);

    assert.deepEqual(ids(sortByCustomOrder(tasks)), ["c", "a", "b", "d"]);
    // First drag in an untouched container backfills every row.
    assert.deepEqual(updates, [
      { id: "c", custom_position: 0 },
      { id: "a", custom_position: 1 },
      { id: "b", custom_position: 2 },
      { id: "d", custom_position: 3 },
    ]);
  });

  it("only rewrites the rows whose position actually changes", () => {
    const container = [task("a", 0), task("b", 1), task("c", 2), task("d", 3)];

    const { updates } = drag(container, ["a", "b", "c", "d"], "b", 3);

    assert.deepEqual(updates, [
      { id: "c", custom_position: 1 },
      { id: "b", custom_position: 2 },
    ]);
  });

  it("survives a refresh and a round trip through another sort", () => {
    const container = [task("a"), task("b"), task("c")];
    const { tasks } = drag(container, ["a", "b", "c"], "c", 0);

    // A refresh re-reads rows in whatever order the database hands back.
    const refetched = [...tasks].reverse().map((t) => ({ ...t }));
    assert.deepEqual(ids(sortByCustomOrder(refetched)), ["c", "a", "b"]);

    // Switching to "Newest first" and back only changes which comparator runs.
    const byNewest = [...refetched].sort((x, y) => y.created_at.localeCompare(x.created_at));
    assert.deepEqual(ids(byNewest), ["c", "b", "a"]);
    assert.deepEqual(ids(sortByCustomOrder(byNewest)), ["c", "a", "b"]);
  });

  it("ignores a drop that leaves the order unchanged", () => {
    const container = [task("a", 0), task("b", 1), task("c", 2)];

    assert.equal(reorderWithinContainer(ids(container), ["a", "b", "c"], "b", 1), null);
    assert.equal(reorderWithinContainer(ids(container), ["a", "b", "c"], "b", 2), null);
  });
});

describe("filtered views", () => {
  it("shows the matching subset in the underlying Custom order", () => {
    const container = [task("a", 0), task("b", 1), task("c", 2), task("d", 3), task("e", 4)];
    const today = new Set(["a", "c", "e"]);

    const visible = sortByCustomOrder(container).filter((t) => today.has(t.id));

    assert.deepEqual(ids(visible), ["a", "c", "e"]);
  });

  it("keeps hidden tasks in place when reordering a filtered subset", () => {
    const container = [task("a", 0), task("b", 1), task("c", 2), task("d", 3), task("e", 4)];

    // Only a, c, e are on screen; drag e above a.
    const { tasks } = drag(container, ["a", "c", "e"], "e", 0);

    assert.deepEqual(ids(sortByCustomOrder(tasks)), ["e", "a", "b", "c", "d"]);
  });

  it("drops to the bottom of a filtered subset above the tasks that follow it", () => {
    const container = [task("a", 0), task("b", 1), task("c", 2), task("d", 3)];

    // Visible: a and c. Drag a below c — b stays between them, d stays last.
    const { tasks } = drag(container, ["a", "c"], "a", 2);

    assert.deepEqual(ids(sortByCustomOrder(tasks)), ["b", "c", "a", "d"]);
  });

  it("treats a no-op drop as a no-op even with hidden tasks in between", () => {
    const container = [task("a", 0), task("hidden", 1), task("b", 2)];

    assert.equal(reorderWithinContainer(ids(container), ["a", "b"], "a", 1), null);
  });
});

describe("new tasks", () => {
  it("appends a new task to the bottom of an already-reordered container", () => {
    const container = [task("a"), task("b"), task("c")];
    const { tasks } = drag(container, ["a", "b", "c"], "c", 1);
    assert.deepEqual(ids(sortByCustomOrder(tasks)), ["a", "c", "b"]);

    const created = task("d");
    assert.deepEqual(ids(sortByCustomOrder([...tasks, created])), ["a", "c", "b", "d"]);
  });

  it("appends multiple new tasks in creation order", () => {
    const container = [task("a", 0), task("b", 1)];
    const first = task("first");
    const second = task("second");
    const third = task("third");

    // Prepended, the way TasksClient adds a freshly created task to state.
    const state = [third, second, first, ...container];

    assert.deepEqual(ids(sortByCustomOrder(state)), [
      "a",
      "b",
      "first",
      "second",
      "third",
    ]);
  });

  it("appends a recurring task's next occurrence like any other new task", () => {
    const insert = buildNextOccurrenceInsert({
      user_id: "user-1",
      title: "Water plants",
      notes: null,
      priority: "medium",
      due_date: "2026-05-01",
      due_time: null,
      list_id: null,
      repeat: "weekly",
      recurrence_id: "rec-1",
      recurrence_anchor_day: 1,
    });

    // No position written, so the occurrence is unpositioned and sorts last.
    assert.equal("custom_position" in insert, false);

    const container = [task("a", 0), task("b", 1)];
    const occurrence = task("next-occurrence");
    assert.deepEqual(ids(sortByCustomOrder([occurrence, ...container])), [
      "a",
      "b",
      "next-occurrence",
    ]);
  });
});

describe("moving between containers", () => {
  /** Applies the destination backfill and the moved task's own new slot,
   *  the way handleMoveTask does. */
  function moveInto(
    destination: CustomOrderable[],
    arriving: CustomOrderable[]
  ): CustomOrderable[] {
    const updates = buildAppendToContainerUpdates(destination, arriving);
    return applyUpdates([...destination, ...arriving], updates);
  }

  it("puts a task moved into a reordered List at the bottom of that List", () => {
    const destination = [task("x", 0), task("y", 1)];
    const moved = task("moved", 0); // position 0 in the List it came from

    assert.deepEqual(ids(sortByCustomOrder(moveInto(destination, [moved]))), [
      "x",
      "y",
      "moved",
    ]);
  });

  it("puts an older task at the bottom of a destination nobody has reordered", () => {
    // The destination's tasks are all unpositioned, so they are ordered by
    // age — and the arriving task is older than every one of them.
    const moved = task("moved");
    const destination = [task("x"), task("y"), task("z")];

    assert.deepEqual(ids(sortByCustomOrder(moveInto(destination, [moved]))), [
      "x",
      "y",
      "z",
      "moved",
    ]);
  });

  it("materialises the destination's nulls so the arrival can sit last", () => {
    const moved = task("moved", 4);
    const destination = [task("x"), task("y")];

    assert.deepEqual(buildAppendToContainerUpdates(destination, [moved]), [
      { id: "x", custom_position: 0 },
      { id: "y", custom_position: 1 },
      { id: "moved", custom_position: 2 },
    ]);
  });

  it("writes only the arrival when the destination is already numbered", () => {
    const moved = task("moved");
    const destination = [task("x", 0), task("y", 1)];

    assert.deepEqual(buildAppendToContainerUpdates(destination, [moved]), [
      { id: "moved", custom_position: 2 },
    ]);
  });

  it("puts an older task moved back to Inbox at the bottom of Inbox", () => {
    const returned = task("returned", 5);
    const inbox = [task("i1"), task("i2")];

    assert.deepEqual(ids(sortByCustomOrder(moveInto(inbox, [returned]))), [
      "i1",
      "i2",
      "returned",
    ]);
  });

  it("appends a deleted List's tasks to Inbox, keeping their relative order", () => {
    // Deliberately older than Inbox's tasks, and manually ordered c → a → b.
    const orphaned = [task("a", 1), task("b", 2), task("c", 0)];
    const inbox = [task("i1"), task("i2")];

    assert.deepEqual(ids(sortByCustomOrder(moveInto(inbox, orphaned))), [
      "i1",
      "i2",
      "c",
      "a",
      "b",
    ]);
  });

  it("appends into an empty destination without disturbing the arrival order", () => {
    const orphaned = [task("a", 1), task("b", 0)];

    assert.deepEqual(ids(sortByCustomOrder(moveInto([], orphaned))), ["b", "a"]);
  });
});

describe("deletion", () => {
  it("leaves the remaining order intact despite the gap in positions", () => {
    const container = [task("a", 0), task("b", 1), task("c", 2), task("d", 3)];

    const remaining = container.filter((t) => t.id !== "b");
    assert.deepEqual(ids(sortByCustomOrder(remaining)), ["a", "c", "d"]);

    // A later drag renumbers around the gap without needing a repair pass.
    const { tasks } = drag(remaining, ["a", "c", "d"], "d", 0);
    assert.deepEqual(ids(sortByCustomOrder(tasks)), ["d", "a", "c"]);
    assert.deepEqual(
      sortByCustomOrder(tasks).map((t) => t.custom_position),
      [0, 1, 2]
    );
  });

  it("restores the task's place when an undo puts it back", () => {
    const container = [task("a", 0), task("b", 1), task("c", 2)];
    const deleted = container[1];

    const afterDelete = container.filter((t) => t.id !== deleted.id);
    assert.deepEqual(ids(sortByCustomOrder([...afterDelete, deleted])), ["a", "b", "c"]);
  });
});

describe("persistence failure", () => {
  /** The rollback TasksClient runs when the reorder RPC rejects: restore the
   *  prior position of every row the drop touched, and nothing else. */
  function rollback(
    tasks: CustomOrderable[],
    updates: { id: string; custom_position: number }[],
    prior: ReadonlyMap<string, number | null>
  ): CustomOrderable[] {
    const applied = new Set(updates.map((u) => u.id));
    return tasks.map((t) =>
      applied.has(t.id) ? { ...t, custom_position: prior.get(t.id) ?? null } : t
    );
  }

  it("restores the pre-drag order, including rows that had no position", () => {
    const container = [task("a"), task("b"), task("c")];
    const prior = new Map(container.map((t) => [t.id, t.custom_position]));

    const { tasks, updates } = drag(container, ["a", "b", "c"], "c", 0);
    assert.deepEqual(ids(sortByCustomOrder(tasks)), ["c", "a", "b"]);

    const reverted = rollback(tasks, updates, prior);
    assert.deepEqual(ids(sortByCustomOrder(reverted)), ["a", "b", "c"]);
    assert.deepEqual(
      reverted.map((t) => t.custom_position),
      [null, null, null]
    );
  });

  it("leaves rows the drop never touched alone", () => {
    const container = [task("a", 0), task("b", 1), task("c", 2), task("d", 3)];
    const prior = new Map(container.map((t) => [t.id, t.custom_position]));

    const { tasks, updates } = drag(container, ["a", "b", "c", "d"], "a", 2);
    assert.deepEqual(
      updates.map((u) => u.id),
      ["b", "a"]
    );

    // A completion toggle lands on an untouched row while the write is in flight.
    const withConcurrentEdit = tasks.map((t) =>
      t.id === "d" ? { ...t, id: "d", custom_position: 3 } : t
    );

    const reverted = rollback(withConcurrentEdit, updates, prior);
    assert.deepEqual(ids(sortByCustomOrder(reverted)), ["a", "b", "c", "d"]);
    assert.deepEqual(
      reverted.map((t) => t.custom_position),
      [0, 1, 2, 3]
    );
  });
});

describe("drag gating", () => {
  const plainRow = { closest: () => null };
  const insideCheckbox = { closest: (selector: string) => (selector === "[data-no-drag]" ? {} : null) };

  it("starts a drag from the body of a row under Custom sort", () => {
    assert.equal(shouldStartPointerDrag(true, 0, plainRow), true);
  });

  it("does not start a drag from the completion circle or other no-drag controls", () => {
    assert.equal(shouldStartPointerDrag(true, 0, insideCheckbox), false);
  });

  it("does not start a drag under any other sort", () => {
    assert.equal(shouldStartPointerDrag(false, 0, plainRow), false);
  });

  it("ignores non-primary buttons so the context menu still opens", () => {
    assert.equal(shouldStartPointerDrag(true, 2, plainRow), false);
  });
});

describe("reorderIds", () => {
  it("moves an item to an insertion index and reports no-ops as null", () => {
    assert.deepEqual(reorderIds(["a", "b", "c"], "a", 3), ["b", "c", "a"]);
    assert.deepEqual(reorderIds(["a", "b", "c"], "c", 0), ["c", "a", "b"]);
    assert.equal(reorderIds(["a", "b", "c"], "a", 0), null);
    assert.equal(reorderIds(["a", "b", "c"], "a", 1), null);
    assert.equal(reorderIds(["a", "b", "c"], "missing", 0), null);
  });
});
