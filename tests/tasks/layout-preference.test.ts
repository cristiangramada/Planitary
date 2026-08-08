import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  TASKS_LAYOUT_DEFAULTS,
  clampListsWidth,
  clampTasksWidth,
} from "../../lib/tasks-layout-preference";

describe("tasks layout preference", () => {
  it("clamps lists width to allowed range", () => {
    assert.equal(clampListsWidth(0), 160);
    assert.equal(clampListsWidth(999), 400);
    assert.equal(clampListsWidth(240.6), 241);
  });

  it("clamps tasks width to allowed range", () => {
    assert.equal(clampTasksWidth(100), 280);
    assert.equal(clampTasksWidth(900), 900);
    assert.equal(clampTasksWidth(5000), 1600);
    assert.equal(
      clampTasksWidth(TASKS_LAYOUT_DEFAULTS.tasksWidth),
      TASKS_LAYOUT_DEFAULTS.tasksWidth
    );
  });
});
