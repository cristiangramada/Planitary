import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { normalizeRow } from "@/lib/search";

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    entity_type: "task",
    entity_id: "11111111-1111-1111-1111-111111111111",
    title: "Fix Supabase authentication",
    excerpt: null,
    result_date: "2026-07-24",
    start_time: null,
    end_time: null,
    due_time: null,
    priority: "high",
    status: "active",
    list_name: null,
    relevance_score: 40.4,
    matched_fields: ["title"],
    ...overrides,
  };
}

describe("normalizeRow", () => {
  test("maps a well-formed task row to camelCase", () => {
    const result = normalizeRow(makeRow());
    assert.equal(result.entityType, "task");
    assert.equal(result.entityId, "11111111-1111-1111-1111-111111111111");
    assert.equal(result.title, "Fix Supabase authentication");
    assert.equal(result.priority, "high");
    assert.equal(result.status, "active");
    assert.deepEqual(result.matchedFields, ["title"]);
  });

  test("maps list_name to listName, and passes through 'list' as a matched field", () => {
    const result = normalizeRow(
      makeRow({ list_name: "Work", matched_fields: ["title", "list"] })
    );
    assert.equal(result.listName, "Work");
    assert.deepEqual(result.matchedFields, ["title", "list"]);
  });

  test("defaults a null list_name to null", () => {
    const result = normalizeRow(makeRow({ list_name: null }));
    assert.equal(result.listName, null);
  });

  test("defaults null matched_fields to an empty array", () => {
    const result = normalizeRow(makeRow({ matched_fields: null }));
    assert.deepEqual(result.matchedFields, []);
  });

  test("drops an unrecognized matched field rather than throwing", () => {
    const result = normalizeRow(makeRow({ matched_fields: ["title", "something-unexpected"] }));
    assert.deepEqual(result.matchedFields, ["title"]);
  });

  test("falls back to null for an invalid priority/status rather than throwing", () => {
    const result = normalizeRow(makeRow({ priority: "urgent!", status: "archived" }));
    assert.equal(result.priority, null);
    assert.equal(result.status, null);
  });

  test("falls back to 'task' for an unrecognized entity_type rather than throwing", () => {
    const result = normalizeRow(makeRow({ entity_type: "unknown" }));
    assert.equal(result.entityType, "task");
  });

  test("passes through journal-shaped rows (no priority/status)", () => {
    const result = normalizeRow(
      makeRow({
        entity_type: "journal",
        priority: null,
        status: null,
        result_date: "2026-07-20",
      })
    );
    assert.equal(result.entityType, "journal");
    assert.equal(result.priority, null);
    assert.equal(result.status, null);
  });

  test("passes through calendar-shaped rows including start/end time", () => {
    const result = normalizeRow(
      makeRow({
        entity_type: "calendar",
        priority: null,
        status: null,
        start_time: "2026-07-23T21:00:00Z",
        end_time: "2026-07-23T22:00:00Z",
      })
    );
    assert.equal(result.entityType, "calendar");
    assert.equal(result.startTime, "2026-07-23T21:00:00Z");
    assert.equal(result.endTime, "2026-07-23T22:00:00Z");
  });
});
