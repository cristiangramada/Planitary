import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { defaultStandupRange, validateStandupRange, STANDUP_LIMITS } from "@/lib/standup";

describe("defaultStandupRange", () => {
  test("returns an inclusive 7-day range ending today", () => {
    const { startDate, endDate } = defaultStandupRange("2026-07-18");
    assert.equal(endDate, "2026-07-18");
    assert.equal(startDate, "2026-07-12");
  });

  test("crosses a month boundary correctly", () => {
    const { startDate, endDate } = defaultStandupRange("2026-08-02");
    assert.equal(endDate, "2026-08-02");
    assert.equal(startDate, "2026-07-27");
  });

  test("crosses a year boundary correctly", () => {
    const { startDate, endDate } = defaultStandupRange("2027-01-03");
    assert.equal(endDate, "2027-01-03");
    assert.equal(startDate, "2026-12-28");
  });
});

describe("validateStandupRange", () => {
  test("accepts a valid inclusive range", () => {
    const result = validateStandupRange("2026-07-12", "2026-07-18");
    assert.equal(result.valid, true);
    assert.equal(result.error, null);
  });

  test("accepts a single-day range", () => {
    const result = validateStandupRange("2026-07-18", "2026-07-18");
    assert.equal(result.valid, true);
  });

  test("rejects a reversed range (start after end)", () => {
    const result = validateStandupRange("2026-07-18", "2026-07-12");
    assert.equal(result.valid, false);
    assert.match(result.error ?? "", /start date/i);
  });

  test("accepts a range exactly at the maximum", () => {
    // 31-day inclusive range: Jan 1 through Jan 31.
    const result = validateStandupRange("2026-01-01", "2026-01-31");
    assert.equal(result.valid, true);
  });

  test("rejects a range longer than the maximum", () => {
    const result = validateStandupRange("2026-01-01", "2026-02-01");
    assert.equal(result.valid, false);
    assert.match(result.error ?? "", new RegExp(`${STANDUP_LIMITS.maxRangeDays} days`));
  });

  test("rejects malformed date strings", () => {
    const result = validateStandupRange("07/18/2026", "2026-07-18");
    assert.equal(result.valid, false);
  });

  test("rejects empty dates", () => {
    const result = validateStandupRange("", "");
    assert.equal(result.valid, false);
  });

  test("handles local dates without UTC shifting across a month boundary", () => {
    // Local-date parsing must not shift Jan 1 to Dec 31 due to UTC conversion.
    const result = validateStandupRange("2026-12-31", "2027-01-01");
    assert.equal(result.valid, true);
  });
});
