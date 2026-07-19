// ---------------------------------------------------------------------------
// Journal-specific Standup prompt builder. This is the only place that knows
// how to turn journal entries into a prompt — the generic provider and the
// API route never construct prompt text themselves.
// ---------------------------------------------------------------------------

export interface StandupSourceDay {
  /** Human-readable day label, e.g. "Monday, July 13, 2026". */
  label: string;
  /** Trimmed, non-empty entry contents for that day, in creation order. */
  entries: string[];
}

export interface StandupPrompt {
  system: string;
  user: string;
}

const SYSTEM_PROMPT = `You write concise, professional standup updates ready to paste into Discord or Slack.

The source material is a personal journal. Summarize what the person actually wrote — activities, events, tasks, notes — under "What I worked on:". Do not filter for software-engineering work. Do not invent job tasks. Do not replace real entries with "None noted."

Rules you must follow exactly:
- Use only the journal entries provided by the user message. Never invent activities, accomplishments, or future plans.
- Never claim something was completed unless the source text says so.
- Every non-empty journal entry must be reflected in at least one bullet under "What I worked on:" (merge related/duplicate entries into fewer bullets).
- Merge duplicate or repetitive entries into a single bullet instead of listing every entry separately.
- Preserve technical names, project names, and proper nouns exactly as written in the source.
- Use concise, professional language. Write in first person when it reads naturally. Personal activities are fine (e.g. "Hung out with Jessica", "Played League of Legends with friends").
- Produce copy-ready plain text only — no markdown tables, no extra headings, no emoji.
- Do not add an introduction sentence or a closing/conclusion sentence.
- Do not mention AI, journals, or that this text was generated.
- Never say "based on the journal" or similar phrasing.
- Do not include timestamps, and do not list out every individual date unless doing so is genuinely useful.
- Aim for about 3 to 8 bullets total, combining related items rather than writing one bullet per entry.
- Your entire reply must begin with exactly "What I worked on:" and contain only that section (plus optional "Next steps:" when allowed). Never write analysis, planning, self-critique, or step-by-step reasoning.
- Never put "None noted." under "What I worked on:" when journal entries were provided.
- Do not include a Blockers section.

Output format — use exactly this section label:
What I worked on:
- ...

Only add a "Next steps:" section if the source text explicitly mentions future plans or next steps. Never infer next steps from work that is simply unfinished.`;

/**
 * True when the model returned a copy-ready standup instead of leaked reasoning
 * or an empty work section.
 */
export function isValidStandupOutput(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed.startsWith("What I worked on:")) return false;
  if (/^we need to\b/i.test(trimmed) || /\bmust (use|produce|follow)\b/i.test(trimmed.slice(0, 200))) {
    return false;
  }
  if (/\bblockers\s*:/i.test(trimmed)) return false;

  const nextStepsIndex = trimmed.search(/\nNext steps:/i);
  const workSection = (
    nextStepsIndex >= 0 ? trimmed.slice("What I worked on:".length, nextStepsIndex) : trimmed.slice("What I worked on:".length)
  ).trim();

  const workBullets = workSection
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter(Boolean);

  // With source entries present, the model must produce at least one real work bullet.
  if (workBullets.length === 0) return false;
  if (workBullets.every((b) => /^none noted\.?$/i.test(b))) return false;

  return true;
}

/**
 * Builds the Standup system + user prompt from journal entries that have
 * already been grouped by day and ordered chronologically. Pure function —
 * no I/O, no provider calls, no React.
 */
export function buildStandupPrompt(days: StandupSourceDay[]): StandupPrompt {
  if (days.length === 0) {
    throw new Error("buildStandupPrompt requires at least one day of source entries.");
  }

  const body = days
    .map((day) => `${day.label}\n${day.entries.map((entry) => `- ${entry}`).join("\n")}`)
    .join("\n\n");

  const user = `Journal entries, in chronological order and grouped by day:\n\n${body}\n\nWrite the standup update now. Summarize these entries under "What I worked on:" — do not omit them, do not write "None noted.", and do not include a Blockers section. Reply with only the standup text — no other commentary.`;

  return { system: SYSTEM_PROMPT, user };
}
