import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { normalizeDisplayName, validateDisplayName, DISPLAY_NAME_MAX_LENGTH } from "@/lib/profile";

describe("normalizeDisplayName", () => {
  test("trims leading and trailing whitespace", () => {
    assert.equal(normalizeDisplayName("  Cristian  "), "Cristian");
  });

  test("collapses a whitespace-only value to null", () => {
    assert.equal(normalizeDisplayName("   "), null);
  });

  test("collapses an empty value to null", () => {
    assert.equal(normalizeDisplayName(""), null);
  });

  test("keeps internal spacing intact", () => {
    assert.equal(normalizeDisplayName(" Cristian Rivera "), "Cristian Rivera");
  });
});

describe("validateDisplayName", () => {
  test("accepts a normal name", () => {
    assert.equal(validateDisplayName("Cristian"), null);
  });

  test("accepts an empty value (removes personalization)", () => {
    assert.equal(validateDisplayName(""), null);
  });

  test("accepts a name exactly at the maximum length", () => {
    assert.equal(validateDisplayName("a".repeat(DISPLAY_NAME_MAX_LENGTH)), null);
  });

  test("rejects a name longer than the maximum length", () => {
    const error = validateDisplayName("a".repeat(DISPLAY_NAME_MAX_LENGTH + 1));
    assert.match(error ?? "", /50 characters/);
  });
});
