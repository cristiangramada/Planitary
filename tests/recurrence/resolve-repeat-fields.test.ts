import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { resolveRepeatFields } from "@/lib/recurrence";

describe("resolveRepeatFields", () => {
  test("never clears recurrence_id and anchor day", () => {
    const result = resolveRepeatFields("never", "2026-05-10", {
      repeat: "weekly",
      recurrence_id: "series-1",
      recurrence_anchor_day: 10,
      due_date: "2026-05-10",
    });
    assert.deepEqual(result, {
      repeat: "never",
      recurrence_id: null,
      recurrence_anchor_day: null,
    });
  });

  test("a repeat without a due date is normalized to never", () => {
    const result = resolveRepeatFields("daily", null, null);
    assert.equal(result.repeat, "never");
    assert.equal(result.recurrence_id, null);
    assert.equal(result.recurrence_anchor_day, null);
  });

  test("a brand-new recurring task gets a fresh recurrence_id and anchor day", () => {
    const result = resolveRepeatFields("monthly", "2026-01-31", null);
    assert.equal(result.repeat, "monthly");
    assert.equal(typeof result.recurrence_id, "string");
    assert.ok(result.recurrence_id!.length > 0);
    assert.equal(result.recurrence_anchor_day, 31);
  });

  test("editing a task already in a series keeps its recurrence_id", () => {
    const result = resolveRepeatFields("monthly", "2026-02-15", {
      repeat: "monthly",
      recurrence_id: "series-42",
      recurrence_anchor_day: 15,
      due_date: "2026-02-15",
    });
    assert.equal(result.recurrence_id, "series-42");
    assert.equal(result.recurrence_anchor_day, 15);
  });

  test("re-enabling repeat after it was 'never' starts a new series", () => {
    const result = resolveRepeatFields("weekly", "2026-02-15", {
      repeat: "never",
      recurrence_id: null,
      recurrence_anchor_day: null,
      due_date: "2026-02-15",
    });
    assert.notEqual(result.recurrence_id, null);
    assert.equal(result.recurrence_anchor_day, 15);
  });

  test("changing repeat cadence mid-series keeps the same recurrence_id", () => {
    const result = resolveRepeatFields("weekly", "2026-02-15", {
      repeat: "daily",
      recurrence_id: "series-7",
      recurrence_anchor_day: 15,
      due_date: "2026-02-15",
    });
    assert.equal(result.repeat, "weekly");
    assert.equal(result.recurrence_id, "series-7");
  });

  test("saving a clamped short-month occurrence preserves the series anchor day", () => {
    // Feb 28 occurrence of a series anchored on the 31st — a title-only save
    // (same due_date day) must not permanently degrade the anchor to 28.
    const result = resolveRepeatFields("monthly", "2026-02-28", {
      repeat: "monthly",
      recurrence_id: "series-31",
      recurrence_anchor_day: 31,
      due_date: "2026-02-28",
    });
    assert.equal(result.recurrence_id, "series-31");
    assert.equal(result.recurrence_anchor_day, 31);
  });

  test("moving a clamped occurrence to the same day next month keeps the anchor", () => {
    const result = resolveRepeatFields("monthly", "2026-03-28", {
      repeat: "monthly",
      recurrence_id: "series-31",
      recurrence_anchor_day: 31,
      due_date: "2026-02-28",
    });
    assert.equal(result.recurrence_anchor_day, 31);
  });

  test("intentionally changing the due day retargets the series anchor", () => {
    const result = resolveRepeatFields("monthly", "2026-02-15", {
      repeat: "monthly",
      recurrence_id: "series-31",
      recurrence_anchor_day: 31,
      due_date: "2026-01-31",
    });
    assert.equal(result.recurrence_id, "series-31");
    assert.equal(result.recurrence_anchor_day, 15);
  });
});
