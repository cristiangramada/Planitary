import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { validateListName } from "@/lib/task-lists";

describe("validateListName", () => {
  test("accepts a simple valid name", () => {
    const result = validateListName("Work", []);
    assert.deepEqual(result, { valid: true, name: "Work" });
  });

  test("trims leading and trailing whitespace", () => {
    const result = validateListName("  Personal  ", []);
    assert.deepEqual(result, { valid: true, name: "Personal" });
  });

  test("rejects an empty name", () => {
    const result = validateListName("", []);
    assert.equal(result.valid, false);
  });

  test("rejects a whitespace-only name", () => {
    const result = validateListName("   ", []);
    assert.equal(result.valid, false);
  });

  test("rejects a name over 50 characters", () => {
    const result = validateListName("x".repeat(51), []);
    assert.equal(result.valid, false);
  });

  test("accepts a name of exactly 50 characters", () => {
    const result = validateListName("x".repeat(50), []);
    assert.equal(result.valid, true);
  });

  test("rejects a case-insensitive duplicate", () => {
    for (const candidate of ["Work", "work", " WORK "]) {
      const result = validateListName(candidate, ["Work"]);
      assert.equal(result.valid, false, `expected "${candidate}" to conflict with "Work"`);
    }
  });

  test("allows a name that isn't a duplicate of any existing name", () => {
    const result = validateListName("School", ["Work", "Personal"]);
    assert.equal(result.valid, true);
  });
});
