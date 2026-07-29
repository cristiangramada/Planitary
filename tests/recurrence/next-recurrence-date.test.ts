import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { nextRecurrenceDate, anchorDayFromDate } from "@/lib/recurrence";

describe("nextRecurrenceDate", () => {
  test("daily advances by one calendar day", () => {
    assert.equal(nextRecurrenceDate("2026-03-15", "daily", 15), "2026-03-16");
  });

  test("daily rolls over a month boundary", () => {
    assert.equal(nextRecurrenceDate("2026-03-31", "daily", 31), "2026-04-01");
  });

  test("weekly advances by seven calendar days", () => {
    assert.equal(nextRecurrenceDate("2026-03-15", "weekly", 15), "2026-03-22");
  });

  test("weekly rolls over a month boundary", () => {
    assert.equal(nextRecurrenceDate("2026-01-28", "weekly", 28), "2026-02-04");
  });

  test("monthly on a normal day-of-month just advances the month", () => {
    assert.equal(nextRecurrenceDate("2026-03-15", "monthly", 15), "2026-04-15");
  });

  test("monthly rolls over a year boundary", () => {
    assert.equal(nextRecurrenceDate("2026-12-10", "monthly", 10), "2027-01-10");
  });

  test("monthly anchored on 31 clamps to the last day of a short month", () => {
    assert.equal(nextRecurrenceDate("2026-01-31", "monthly", 31), "2026-02-28");
  });

  test("monthly anchored on 31 clamps May 31 into June 30", () => {
    assert.equal(nextRecurrenceDate("2026-05-31", "monthly", 31), "2026-06-30");
  });


  test("monthly anchored on 31 clamps into a leap February", () => {
    assert.equal(nextRecurrenceDate("2028-01-31", "monthly", 31), "2028-02-29");
  });

  test("monthly anchor of 31 is NOT permanently degraded by a short month", () => {
    // Jan 31 -> Feb 28 -> Mar 31 (not Mar 28) because the anchor day (31) is
    // fixed for the series rather than re-derived from Feb 28.
    const feb = nextRecurrenceDate("2026-01-31", "monthly", 31);
    assert.equal(feb, "2026-02-28");
    const mar = nextRecurrenceDate(feb, "monthly", 31);
    assert.equal(mar, "2026-03-31");
  });

  test("monthly anchored on 30 clamps in February", () => {
    assert.equal(nextRecurrenceDate("2026-01-30", "monthly", 30), "2026-02-28");
  });

  test("monthly anchored on 29 clamps in a non-leap February", () => {
    assert.equal(nextRecurrenceDate("2026-01-29", "monthly", 29), "2026-02-28");
  });

  test("monthly anchored on 29 lands on Feb 29 in a leap year", () => {
    assert.equal(nextRecurrenceDate("2028-01-29", "monthly", 29), "2028-02-29");
  });

  test("yearly advances to the same month/day next year", () => {
    assert.equal(nextRecurrenceDate("2026-06-10", "yearly", 10), "2027-06-10");
  });

  test("yearly on Feb 29 clamps to Feb 28 in a non-leap target year", () => {
    // 2028 is a leap year; 2029 is not.
    assert.equal(nextRecurrenceDate("2028-02-29", "yearly", 29), "2029-02-28");
  });

  test("yearly on Feb 29 returns to Feb 29 once the target year is leap again", () => {
    assert.equal(nextRecurrenceDate("2031-02-28", "yearly", 29), "2032-02-29");
  });
});

describe("anchorDayFromDate", () => {
  test("returns the local day-of-month", () => {
    assert.equal(anchorDayFromDate("2026-01-31"), 31);
    assert.equal(anchorDayFromDate("2026-02-01"), 1);
  });
});
