import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseSearchState, buildSearchParams } from "@/lib/search";
import { DEFAULT_SEARCH_FILTERS, type SearchQueryState } from "@/types/search";

describe("parseSearchState", () => {
  test("defaults to an empty query with no filters and relevance sort", () => {
    const state = parseSearchState(new URLSearchParams(""));
    assert.equal(state.query, "");
    assert.deepEqual(state.filters, DEFAULT_SEARCH_FILTERS);
    assert.equal(state.sortMode, "relevance");
  });

  test("reads the query string", () => {
    const state = parseSearchState(new URLSearchParams("q=authentication"));
    assert.equal(state.query, "authentication");
  });

  test("'type=all' is equivalent to no type filter", () => {
    const state = parseSearchState(new URLSearchParams("type=all"));
    assert.deepEqual(state.filters.entityTypes, []);
  });

  test("a single valid type narrows entityTypes", () => {
    const state = parseSearchState(new URLSearchParams("type=journal"));
    assert.deepEqual(state.filters.entityTypes, ["journal"]);
  });

  test("an unknown type value falls back safely to 'all'", () => {
    const state = parseSearchState(new URLSearchParams("type=bogus"));
    assert.deepEqual(state.filters.entityTypes, []);
  });

  test("valid start/end dates are kept", () => {
    const state = parseSearchState(new URLSearchParams("start=2026-07-01&end=2026-07-22"));
    assert.equal(state.filters.startDate, "2026-07-01");
    assert.equal(state.filters.endDate, "2026-07-22");
  });

  test("malformed dates fall back to null rather than throwing", () => {
    const state = parseSearchState(new URLSearchParams("start=07/01/2026&end=not-a-date"));
    assert.equal(state.filters.startDate, null);
    assert.equal(state.filters.endDate, null);
  });

  test("a valid task status is kept", () => {
    const state = parseSearchState(new URLSearchParams("status=completed"));
    assert.equal(state.filters.taskStatus, "completed");
  });

  test("an invalid task status falls back to null", () => {
    const state = parseSearchState(new URLSearchParams("status=archived"));
    assert.equal(state.filters.taskStatus, null);
  });

  test("priorities parse from a comma-separated list, dropping invalid values and duplicates", () => {
    const state = parseSearchState(new URLSearchParams("priority=high,bogus,high,low"));
    assert.deepEqual(state.filters.priorities, ["high", "low"]);
  });

  test("a valid sort mode is kept", () => {
    const state = parseSearchState(new URLSearchParams("sort=newest"));
    assert.equal(state.sortMode, "newest");
  });

  test("an invalid sort mode falls back to relevance", () => {
    const state = parseSearchState(new URLSearchParams("sort=bogus"));
    assert.equal(state.sortMode, "relevance");
  });
});

describe("buildSearchParams", () => {
  test("an empty/default state produces no params", () => {
    const params = buildSearchParams({ query: "", filters: DEFAULT_SEARCH_FILTERS, sortMode: "relevance" });
    assert.equal(params.toString(), "");
  });

  test("omits 'type' param when 'all' entity types are selected, includes it otherwise", () => {
    const allTypes = buildSearchParams({
      query: "x",
      filters: { ...DEFAULT_SEARCH_FILTERS },
      sortMode: "relevance",
    });
    assert.equal(allTypes.get("type"), null);

    const oneType = buildSearchParams({
      query: "x",
      filters: { ...DEFAULT_SEARCH_FILTERS, entityTypes: ["task"] },
      sortMode: "relevance",
    });
    assert.equal(oneType.get("type"), "task");
  });

  test("serializes priorities as a comma-separated list", () => {
    const params = buildSearchParams({
      query: "x",
      filters: { ...DEFAULT_SEARCH_FILTERS, priorities: ["high", "low"] },
      sortMode: "relevance",
    });
    assert.equal(params.get("priority"), "high,low");
  });

  test("omits 'sort' param for the default relevance mode", () => {
    const params = buildSearchParams({ query: "x", filters: DEFAULT_SEARCH_FILTERS, sortMode: "relevance" });
    assert.equal(params.get("sort"), null);
  });

  test("round-trips through parseSearchState", () => {
    const original: SearchQueryState = {
      query: "meeting with Alex",
      filters: {
        entityTypes: ["calendar"],
        startDate: "2026-07-01",
        endDate: "2026-07-31",
        taskStatus: null,
        priorities: [],
      },
      sortMode: "newest",
    };
    const roundTripped = parseSearchState(buildSearchParams(original));
    assert.deepEqual(roundTripped, original);
  });
});
