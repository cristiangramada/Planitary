import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getDashboardWeekRange,
  computeCompletionPercent,
  sortTodayTasks,
} from "../../lib/dashboard";
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
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    subtasks: [],
    tags: [],
    ...overrides,
  };
}

test("getDashboardWeekRange returns the Sunday-Saturday week containing the date", () => {
  // 2026-07-23 is a Thursday
  const range = getDashboardWeekRange("2026-07-23");
  assert.equal(range.weekStart, "2026-07-19"); // Sunday
  assert.equal(range.weekEnd, "2026-07-25"); // Saturday
});

test("getDashboardWeekRange handles a Sunday correctly (week starts on itself)", () => {
  const range = getDashboardWeekRange("2026-07-19");
  assert.equal(range.weekStart, "2026-07-19");
  assert.equal(range.weekEnd, "2026-07-25");
});

test("getDashboardWeekRange handles a month boundary", () => {
  // 2026-08-01 is a Saturday
  const range = getDashboardWeekRange("2026-08-01");
  assert.equal(range.weekStart, "2026-07-26");
  assert.equal(range.weekEnd, "2026-08-01");
});

test("computeCompletionPercent returns null when there is nothing to measure", () => {
  assert.equal(computeCompletionPercent(0, 0), null);
});

test("computeCompletionPercent rounds to the nearest whole percent", () => {
  assert.equal(computeCompletionPercent(1, 2), 33);
  assert.equal(computeCompletionPercent(3, 1), 75);
  assert.equal(computeCompletionPercent(5, 0), 100);
  assert.equal(computeCompletionPercent(0, 4), 0);
});

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
