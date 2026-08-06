import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordProductiveDay, countProductiveDays } from "@/lib/productive-days";
import { setTaskComplete } from "@/lib/tasks";

type Row = Record<string, unknown>;

/**
 * Minimal fake covering auth.getUser + from(table) query chains used by
 * productive-day recording and setTaskComplete.
 */
function createFakeSupabase(seed: {
  userId: string;
  tasks?: Row[];
  productiveDays?: Row[];
}) {
  const tasks = new Map((seed.tasks ?? []).map((t) => [t.id as string, { ...t }]));
  const productiveDays = new Map<string, Row>();
  for (const row of seed.productiveDays ?? []) {
    productiveDays.set(`${row.user_id}:${row.productive_date}`, { ...row });
  }
  let nextId = 1;

  const client = {
    auth: {
      async getUser() {
        return { data: { user: { id: seed.userId } }, error: null };
      },
    },
    from(table: string) {
      let op: "select" | "insert" | "update" | "upsert" = "select";
      let selectCols: string | null = null;
      let insertPayload: Row | Row[] | null = null;
      let updatePayload: Row | null = null;
      let upsertPayload: Row | Row[] | null = null;
      let ignoreDuplicates = false;
      const filters: [string, unknown][] = [];
      let wantSingle = false;
      let wantCount = false;
      let head = false;

      async function exec(): Promise<{
        data: unknown;
        error: { code?: string; message: string } | null;
        count?: number | null;
      }> {
        if (table === "user_productive_days") {
          if (op === "upsert" || op === "insert") {
            const items = Array.isArray(upsertPayload ?? insertPayload)
              ? ((upsertPayload ?? insertPayload) as Row[])
              : [((upsertPayload ?? insertPayload) as Row)];
            let inserted = 0;
            for (const item of items) {
              const key = `${item.user_id}:${item.productive_date}`;
              if (productiveDays.has(key)) {
                if (ignoreDuplicates || op === "upsert") continue;
                return {
                  data: null,
                  error: { code: "23505", message: "duplicate" },
                  count: null,
                };
              }
              productiveDays.set(key, {
                id: `pd-${nextId++}`,
                created_at: new Date().toISOString(),
                ...item,
              });
              inserted += 1;
            }
            return { data: null, error: null, count: inserted };
          }
          if (op === "select") {
            const matches = [...productiveDays.values()].filter((r) =>
              filters.every(([c, v]) => r[c] === v)
            );
            if (wantCount || head) {
              return { data: null, error: null, count: matches.length };
            }
            return { data: matches, error: null, count: matches.length };
          }
        }

        if (table === "tasks") {
          if (op === "update") {
            const matches = [...tasks.values()].filter((r) =>
              filters.every(([c, v]) => r[c] === v)
            );
            for (const row of matches) Object.assign(row, updatePayload as Row);
            const data = wantSingle ? matches[0] : matches;
            return {
              data: selectCols ? project(data, selectCols) : data,
              error: null,
            };
          }
          if (op === "select") {
            const matches = [...tasks.values()].filter((r) =>
              filters.every(([c, v]) => r[c] === v)
            );
            const data = wantSingle ? (matches[0] ?? null) : matches;
            return {
              data: selectCols && data ? project(data, selectCols) : data,
              error: null,
            };
          }
          if (op === "insert") {
            const items = Array.isArray(insertPayload) ? insertPayload : [insertPayload as Row];
            const inserted: Row[] = [];
            for (const item of items) {
              const id = `generated-${nextId++}`;
              const row = { status: "active", completed_at: null, ...item, id };
              tasks.set(id, row);
              inserted.push(row);
            }
            const data = wantSingle ? inserted[0] : inserted;
            return { data, error: null };
          }
        }

        return { data: null, error: { message: `unsupported ${table} ${op}` } };
      }

      function project(data: unknown, cols: string): unknown {
        const names = cols.split(",").map((c) => c.trim());
        const pick = (row: Row) => {
          const out: Row = {};
          for (const name of names) out[name] = row[name];
          return out;
        };
        if (Array.isArray(data)) return data.map((d) => pick(d as Row));
        return data ? pick(data as Row) : data;
      }

      const builder = {
        select(cols: string, opts?: { count?: string; head?: boolean }) {
          selectCols = cols;
          if (opts?.count === "exact") wantCount = true;
          if (opts?.head) head = true;
          return builder;
        },
        insert(payload: Row | Row[]) {
          op = "insert";
          insertPayload = payload;
          return builder;
        },
        upsert(
          payload: Row | Row[],
          opts?: { onConflict?: string; ignoreDuplicates?: boolean }
        ) {
          op = "upsert";
          upsertPayload = payload;
          ignoreDuplicates = opts?.ignoreDuplicates ?? false;
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
          resolve: (v: { data: unknown; error: unknown; count?: number | null }) => void,
          reject: (e: unknown) => void
        ) {
          exec().then(resolve, reject);
        },
      };

      return builder;
    },
  };

  return {
    client: client as unknown as SupabaseClient,
    productiveDays,
    tasks,
  };
}

describe("productive-day recording", () => {
  test("recording the same date twice is idempotent", async () => {
    const { client, productiveDays } = createFakeSupabase({ userId: "user-1" });

    const first = await recordProductiveDay(client, "2026-08-05");
    assert.equal(first.inserted, true);
    assert.equal(first.productiveDayCount, 1);
    assert.equal(productiveDays.size, 1);

    const second = await recordProductiveDay(client, "2026-08-05");
    assert.equal(second.inserted, false);
    assert.equal(second.productiveDayCount, 1);
    assert.equal(second.newlyUnlocked.length, 0);
    assert.equal(productiveDays.size, 1);
  });

  test("distinct dates accumulate and unlock at the Mercury boundary", async () => {
    const { client } = createFakeSupabase({ userId: "user-1" });

    await recordProductiveDay(client, "2026-08-01");
    await recordProductiveDay(client, "2026-08-02");
    const third = await recordProductiveDay(client, "2026-08-03");

    assert.equal(third.productiveDayCount, 3);
    assert.deepEqual(third.newlyUnlocked, ["mercury"]);
  });

  test("countProductiveDays reflects unique rows only", async () => {
    const { client } = createFakeSupabase({
      userId: "user-1",
      productiveDays: [
        { user_id: "user-1", productive_date: "2026-01-01" },
        { user_id: "user-1", productive_date: "2026-01-02" },
      ],
    });
    assert.equal(await countProductiveDays(client), 2);
  });

  test("setTaskComplete records a productive day on completion only", async () => {
    const { client, productiveDays } = createFakeSupabase({
      userId: "user-1",
      tasks: [
        {
          id: "task-1",
          user_id: "user-1",
          title: "Ship themes",
          notes: null,
          priority: "medium",
          due_date: null,
          due_time: null,
          list_id: null,
          repeat: "never",
          recurrence_id: null,
          recurrence_anchor_day: null,
          status: "active",
          completed_at: null,
        },
      ],
    });

    const completed = await setTaskComplete(client, "task-1", true, {
      localProductiveDate: "2026-08-05",
    });
    assert.equal(completed.productiveDay?.inserted, true);
    assert.equal(productiveDays.size, 1);

    const reopened = await setTaskComplete(client, "task-1", false);
    assert.equal(reopened.productiveDay, null);
    assert.equal(productiveDays.size, 1, "reopen must not remove productive days");

    const again = await setTaskComplete(client, "task-1", true, {
      localProductiveDate: "2026-08-05",
    });
    assert.equal(again.productiveDay?.inserted, false);
    assert.equal(productiveDays.size, 1);
  });
});

describe("user isolation (client binding)", () => {
  test("recordProductiveDay always writes auth.uid(), never a caller-supplied user id", async () => {
    const { client, productiveDays } = createFakeSupabase({ userId: "auth-user" });
    await recordProductiveDay(client, "2026-08-05");
    const row = [...productiveDays.values()][0];
    assert.equal(row.user_id, "auth-user");
  });
});
