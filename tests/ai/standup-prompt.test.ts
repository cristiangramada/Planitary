import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  buildStandupPrompt,
  isValidStandupOutput,
  type StandupSourceDay,
} from "@/lib/ai/prompts/standup-prompt";

const SAMPLE_DAYS: StandupSourceDay[] = [
  {
    label: "Monday, July 13, 2026",
    entries: ["Implemented Supabase authentication.", "Fixed the dashboard layout."],
  },
  {
    label: "Tuesday, July 14, 2026",
    entries: ["Added inline Journal editing.", "Updated task sorting."],
  },
];

describe("buildStandupPrompt", () => {
  test("rejects empty source input", () => {
    assert.throws(() => buildStandupPrompt([]));
  });

  test("orders days chronologically and groups entries under each day label", () => {
    const { user } = buildStandupPrompt(SAMPLE_DAYS);
    const mondayIndex = user.indexOf("Monday, July 13, 2026");
    const tuesdayIndex = user.indexOf("Tuesday, July 14, 2026");
    assert.ok(mondayIndex >= 0 && tuesdayIndex >= 0);
    assert.ok(mondayIndex < tuesdayIndex, "Monday should appear before Tuesday");
    assert.ok(user.includes("- Implemented Supabase authentication."));
    assert.ok(user.includes("- Added inline Journal editing."));
  });

  test("system prompt instructs merging duplicate/repetitive entries", () => {
    const { system } = buildStandupPrompt(SAMPLE_DAYS);
    assert.match(system.toLowerCase(), /merge duplicate|repetitive entries/);
  });

  test("system prompt forbids inventing activities or future plans", () => {
    const { system } = buildStandupPrompt(SAMPLE_DAYS);
    assert.match(system, /never invent activities, accomplishments, or future plans/i);
    assert.match(system, /never infer next steps/i);
  });

  test("system prompt requires What I worked on and forbids Blockers", () => {
    const { system } = buildStandupPrompt(SAMPLE_DAYS);
    assert.match(system, /What I worked on:/);
    assert.match(system, /do not include a blockers section/i);
    assert.match(system, /never write analysis, planning/i);
    assert.match(system, /personal journal/i);
  });

  test("user prompt includes all supplied entries and nothing else invented", () => {
    const { user } = buildStandupPrompt(SAMPLE_DAYS);
    for (const day of SAMPLE_DAYS) {
      for (const entry of day.entries) {
        assert.ok(user.includes(entry));
      }
    }
  });

  test("isValidStandupOutput accepts copy-ready standups and rejects empty, blockers, or reasoned output", () => {
    assert.equal(isValidStandupOutput("What I worked on:\n- Built auth"), true);
    assert.equal(
      isValidStandupOutput(
        'We need to produce a standup update with sections "What I worked on:" and "Blockers:"'
      ),
      false
    );
    assert.equal(isValidStandupOutput("What I worked on:\n- None noted."), false);
    assert.equal(
      isValidStandupOutput("What I worked on:\n- Built auth\n\nBlockers:\n- None noted."),
      false
    );
  });
});
