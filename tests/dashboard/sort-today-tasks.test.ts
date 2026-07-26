import { test } from "node:test";
import assert from "node:assert/strict";
import { sortTodayTasks } from "../../lib/dashboard";
import type { TaskWithDetails } from "../../types";

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
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    subtasks: [],
    tags: [],
    list: null,
    ...overrides,
  };
}

test("sortTodayTasks orders by priority first, then due time", () => {
  const tasks = [
    task({ id: "a", priority: "low", due_time: "09:00:00" }),
    task({ id: "b", priority: "high", due_time: "15:00:00" }),
    task({ id: "c", priority: "high", due_time: "08:00:00" }),
    task({ id: "d", priority: "medium", due_time: null }),
  ];
  const sorted = sortTodayTasks(tasks).map((t) => t.id);
  assert.deepEqual(sorted, ["c", "b", "d", "a"]);
});
