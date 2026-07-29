import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { setTaskComplete } from "@/lib/tasks";

// ---------------------------------------------------------------------------
// A minimal in-memory fake of the subset of the supabase-js query builder
// used by lib/tasks.ts (select/insert/update + eq + single, all awaitable).
// Good enough to exercise setTaskComplete's recurrence + idempotency logic
// without a live Supabase project.
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

interface FakeBuilder {
  select(cols: string): FakeBuilder;
  insert(payload: Row | Row[]): FakeBuilder;
  update(payload: Row): FakeBuilder;
  eq(col: string, val: unknown): FakeBuilder;
  single(): FakeBuilder;
  then(
    resolve: (v: { data: unknown; error: unknown }) => void,
    reject: (e: unknown) => void
  ): void;
}

function pick(row: Row, cols: string): Row {
  const names = cols.split(",").map((c) => c.trim());
  const out: Row = {};
  for (const name of names) out[name] = row[name];
  return out;
}

function createFakeSupabase(seed: { tasks: Row[]; subtasks: Row[] }) {
  const tasks = new Map(seed.tasks.map((t) => [t.id as string, { ...t }]));
  const subtasks = new Map(seed.subtasks.map((s) => [s.id as string, { ...s }]));
  let nextId = 1;

  function from(table: "tasks" | "subtasks") {
    const store = table === "tasks" ? tasks : subtasks;
    let op: "select" | "insert" | "update" = "select";
    let selectCols: string | null = null;
    let insertPayload: Row | Row[] | null = null;
    let updatePayload: Row | null = null;
    const filters: [string, unknown][] = [];
    let wantSingle = false;

    async function exec(): Promise<{ data: unknown; error: { code?: string; message: string } | null }> {
      if (op === "insert") {
        const items = Array.isArray(insertPayload) ? insertPayload : [insertPayload as Row];
        const inserted: Row[] = [];
        for (const item of items) {
          if (table === "tasks" && item.recurrence_id) {
            const duplicate = [...store.values()].some(
              (r) =>
                r.user_id === item.user_id &&
                r.recurrence_id === item.recurrence_id &&
                r.due_date === item.due_date
            );
            if (duplicate) {
              return {
                data: null,
                error: { code: "23505", message: "duplicate key value violates unique constraint" },
              };
            }
          }
          const id = `generated-${nextId++}`;
          const row: Row = { status: "active", completed_at: null, ...item, id };
          store.set(id, row);
          inserted.push(row);
        }
        const data = wantSingle ? inserted[0] : inserted;
        return { data: selectCols ? projectMaybe(data, selectCols) : data, error: null };
      }
      if (op === "update") {
        const matches = [...store.values()].filter((r) => filters.every(([c, v]) => r[c] === v));
        for (const row of matches) Object.assign(row, updatePayload as Row);
        const data = wantSingle ? matches[0] : matches;
        return { data: selectCols ? projectMaybe(data, selectCols) : data, error: null };
      }
      const matches = [...store.values()].filter((r) => filters.every(([c, v]) => r[c] === v));
      const data = wantSingle ? (matches[0] ?? null) : matches;
      return { data: selectCols && data ? projectMaybe(data, selectCols) : data, error: null };
    }

    // The real TASK_SELECT ("*, subtasks ( * ), task_lists ( ... )") is a
    // nested-relation select that a naive comma-split can't parse; special-case
    // it to attach subtasks from the fake store the way PostgREST would.
    function projectMaybe(data: unknown, cols: string): unknown {
      const wantsJoin = cols.includes("subtasks");
      function projectRow(row: Row): Row {
        if (!wantsJoin) return pick(row, cols);
        const rowSubtasks = [...subtasks.values()].filter((s) => s.task_id === row.id);
        return { ...row, subtasks: rowSubtasks, task_lists: null };
      }
      if (Array.isArray(data)) return data.map((d) => projectRow(d as Row));
      return data ? projectRow(data as Row) : data;
    }

    const builder: FakeBuilder = {
      select(cols: string) {
        selectCols = cols;
        return builder;
      },
      insert(payload: Row | Row[]) {
        op = "insert";
        insertPayload = payload;
        return builder;
      },
      update(payload: Row) {
        op = "update";
        updatePayload = payload;
        return builder;
      },
      eq(col: string, val: unknown) {
        filters.push([col, val]);
        return builder;
      },
      single() {
        wantSingle = true;
        return builder;
      },
      then(
        resolve: (v: { data: unknown; error: unknown }) => void,
        reject: (e: unknown) => void
      ) {
        exec().then(resolve, reject);
      },
    };
    return builder;
  }

  return { fake: { from } as unknown as SupabaseClient, tasks, subtasks };
}

function recurringTask(overrides: Row = {}): Row {
  return {
    id: "task-1",
    user_id: "user-1",
    title: "Water the plants",
    notes: null,
    priority: "medium",
    status: "active",
    due_date: "2026-01-31",
    due_time: "09:00:00",
    list_id: null,
    repeat: "monthly",
    recurrence_id: "series-1",
    recurrence_anchor_day: 31,
    completed_at: null,
    ...overrides,
  };
}

describe("setTaskComplete — recurrence", () => {
  test("completing a recurring task creates exactly one next occurrence with preserved fields and reset subtasks", async () => {
    const { fake, tasks } = createFakeSupabase({
      tasks: [recurringTask()],
      subtasks: [
        { id: "sub-1", task_id: "task-1", user_id: "user-1", title: "Buy fertilizer", is_completed: true },
      ],
    });

    const result = await setTaskComplete(fake, "task-1", true);

    assert.equal(result.task.status, "completed");
    assert.ok(result.nextTask);
    assert.equal(result.nextTask!.title, "Water the plants");
    assert.equal(result.nextTask!.due_date, "2026-02-28"); // 31 clamped into Feb
    assert.equal(result.nextTask!.due_time, "09:00:00");
    assert.equal(result.nextTask!.repeat, "monthly");
    assert.equal(result.nextTask!.recurrence_id, "series-1");
    assert.equal(result.nextTask!.subtasks.length, 1);
    assert.equal(result.nextTask!.subtasks[0].title, "Buy fertilizer");
    assert.equal(result.nextTask!.subtasks[0].is_completed, false);
    assert.equal(tasks.size, 2);
  });

  test("completing a non-recurring task never creates a next occurrence", async () => {
    const { fake, tasks } = createFakeSupabase({
      tasks: [recurringTask({ repeat: "never", recurrence_id: null, recurrence_anchor_day: null })],
      subtasks: [],
    });

    const result = await setTaskComplete(fake, "task-1", true);

    assert.equal(result.nextTask, null);
    assert.equal(tasks.size, 1);
  });

  test("reopening a completed recurring task does not create a next occurrence", async () => {
    const { fake, tasks } = createFakeSupabase({
      tasks: [recurringTask({ status: "completed", completed_at: "2026-01-31T12:00:00.000Z" })],
      subtasks: [],
    });

    const result = await setTaskComplete(fake, "task-1", false);

    assert.equal(result.task.status, "active");
    assert.equal(result.task.completed_at, null);
    assert.equal(result.nextTask, null);
    assert.equal(tasks.size, 1);
  });

  test("completing the same occurrence twice is idempotent (no duplicate next task)", async () => {
    const { fake, tasks } = createFakeSupabase({
      tasks: [recurringTask({ status: "active" })],
      subtasks: [],
    });

    const first = await setTaskComplete(fake, "task-1", true);
    assert.ok(first.nextTask);
    assert.equal(tasks.size, 2);

    // Simulate a double-click / retry of the same completion request.
    const second = await setTaskComplete(fake, "task-1", true);
    assert.equal(second.nextTask, null);
    assert.equal(tasks.size, 2, "no duplicate next occurrence was created");
  });

  test("reopen then complete again is still idempotent for the same occurrence date", async () => {
    const { fake, tasks } = createFakeSupabase({
      tasks: [recurringTask({ status: "active" })],
      subtasks: [],
    });

    await setTaskComplete(fake, "task-1", true);
    assert.equal(tasks.size, 2);

    await setTaskComplete(fake, "task-1", false); // reopen; due_date unchanged
    const again = await setTaskComplete(fake, "task-1", true);
    assert.equal(again.nextTask, null, "the next occurrence for this due_date already exists");
    assert.equal(tasks.size, 2);
  });

  test("next occurrence inherits the source task's user_id (ownership parity)", async () => {
    const { fake } = createFakeSupabase({
      tasks: [recurringTask({ user_id: "owner-xyz" })],
      subtasks: [],
    });

    const result = await setTaskComplete(fake, "task-1", true);
    assert.ok(result.nextTask);
    assert.equal(result.nextTask!.user_id, "owner-xyz");
  });
});

