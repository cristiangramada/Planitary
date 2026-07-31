import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  buildNextOccurrenceInsert,
  buildNextOccurrenceSubtasks,
  type RecurrenceSourceTask,
} from "@/lib/tasks";

function sourceTask(overrides: Partial<RecurrenceSourceTask> = {}): RecurrenceSourceTask {
  return {
    user_id: "user-1",
    title: "Water the plants",
    notes: "Use the blue can",
    priority: "medium",
    due_date: "2026-01-31",
    due_time: "09:00:00",
    list_id: "list-1",
    repeat: "monthly",
    recurrence_id: "series-1",
    recurrence_anchor_day: 31,
    ...overrides,
  };
}

describe("buildNextOccurrenceInsert", () => {
  test("preserves title, notes, priority, list_id, due_time, repeat, and series id", () => {
    const insert = buildNextOccurrenceInsert(sourceTask());
    assert.equal(insert.user_id, "user-1");
    assert.equal(insert.title, "Water the plants");
    assert.equal(insert.notes, "Use the blue can");
    assert.equal(insert.priority, "medium");
    assert.equal(insert.list_id, "list-1");
    assert.equal(insert.due_time, "09:00:00");
    assert.equal(insert.repeat, "monthly");
    assert.equal(insert.recurrence_id, "series-1");
    assert.equal(insert.recurrence_anchor_day, 31);
  });

  test("next occurrence always belongs to the source task's owner (never a different user)", () => {
    const insert = buildNextOccurrenceInsert(sourceTask({ user_id: "owner-abc" }));
    assert.equal(insert.user_id, "owner-abc");
    const subtasks = buildNextOccurrenceSubtasks([{ title: "A" }], "owner-abc", "new-id");
    assert.equal(subtasks[0].user_id, "owner-abc");
  });


  test("advances due_date using the recurrence rule and anchor day", () => {
    const insert = buildNextOccurrenceInsert(sourceTask({ due_date: "2026-01-31", recurrence_anchor_day: 31 }));
    assert.equal(insert.due_date, "2026-02-28");
  });

  test("daily/weekly series advance from the current due_date", () => {
    const daily = buildNextOccurrenceInsert(
      sourceTask({ repeat: "daily", due_date: "2026-03-01", recurrence_anchor_day: 1 })
    );
    assert.equal(daily.due_date, "2026-03-02");

    const weekly = buildNextOccurrenceInsert(
      sourceTask({ repeat: "weekly", due_date: "2026-03-01", recurrence_anchor_day: 1 })
    );
    assert.equal(weekly.due_date, "2026-03-08");
  });
});

describe("buildNextOccurrenceSubtasks", () => {
  test("copies titles onto the new task and resets completion to false", () => {
    const rows = buildNextOccurrenceSubtasks(
      [{ title: "Buy fertilizer" }, { title: "Check soil" }],
      "user-1",
      "new-task-id"
    );
    assert.deepEqual(rows, [
      { task_id: "new-task-id", user_id: "user-1", title: "Buy fertilizer", is_completed: false },
      { task_id: "new-task-id", user_id: "user-1", title: "Check soil", is_completed: false },
    ]);
  });

  test("returns an empty array for a task with no subtasks", () => {
    assert.deepEqual(buildNextOccurrenceSubtasks([], "user-1", "new-task-id"), []);
  });
});
