import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { computeListTaskCounts, INBOX_COUNT_KEY } from "@/lib/task-lists";
import type { TaskWithDetails } from "@/types";

function task(overrides: Partial<TaskWithDetails>): TaskWithDetails {
  return {
    id: "id",
    user_id: "user",
    title: "Task",
    notes: null,
    priority: "medium",
    status: "active",
    due_date: null,
    due_time: null,
    completed_at: null,
    list_id: null,
    repeat: "never",
    recurrence_id: null,
    recurrence_anchor_day: null,
    custom_position: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    subtasks: [],
    list: null,
    ...overrides,
  };
}

const LIST_A = "11111111-1111-1111-1111-111111111111";
const LIST_B = "22222222-2222-2222-2222-222222222222";

describe("computeListTaskCounts", () => {
  test("counts active tasks per list and buckets null list_id under 'inbox'", () => {
    const counts = computeListTaskCounts([
      task({ id: "1", list_id: LIST_A, status: "active" }),
      task({ id: "2", list_id: LIST_A, status: "active" }),
      task({ id: "3", list_id: LIST_B, status: "active" }),
      task({ id: "4", list_id: null, status: "active" }),
    ]);
    assert.equal(counts[LIST_A], 2);
    assert.equal(counts[LIST_B], 1);
    assert.equal(counts[INBOX_COUNT_KEY], 1);
  });

  test("excludes completed tasks from counts", () => {
    const counts = computeListTaskCounts([
      task({ id: "1", list_id: LIST_A, status: "active" }),
      task({ id: "2", list_id: LIST_A, status: "completed" }),
    ]);
    assert.equal(counts[LIST_A], 1);
  });

  test("a list with zero active tasks has no key (not zero)", () => {
    const counts = computeListTaskCounts([task({ id: "1", list_id: LIST_A, status: "completed" })]);
    assert.equal(counts[LIST_A], undefined);
  });

  test("reopening a completed task (active again) is reflected in a fresh computation", () => {
    const reopened = task({ id: "1", list_id: LIST_A, status: "active" });
    const counts = computeListTaskCounts([reopened]);
    assert.equal(counts[LIST_A], 1);
  });

  test("moving a task out of a list is reflected in a fresh computation", () => {
    const moved = task({ id: "1", list_id: LIST_B, status: "active" });
    const counts = computeListTaskCounts([moved]);
    assert.equal(counts[LIST_A], undefined);
    assert.equal(counts[LIST_B], 1);
  });

  test("empty task list produces empty counts", () => {
    const counts = computeListTaskCounts([]);
    assert.deepEqual(counts, {});
  });
});
