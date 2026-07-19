/**
 * Standup draft persistence. Uses localStorage so the draft survives refresh
 * and tab close; cleared explicitly on Clear / sign-out.
 */

export const STANDUP_SESSION_KEY = "planitary:standup";

export type StandupSessionStatus = "idle" | "success" | "empty" | "error";

export interface StandupSessionState {
  startDate: string;
  endDate: string;
  output: string;
  status: StandupSessionStatus;
  statusMessage: string | null;
  hasGeneratedOnce: boolean;
  expanded: boolean;
}

function readRaw(): string | null {
  try {
    const fromLocal = localStorage.getItem(STANDUP_SESSION_KEY);
    if (fromLocal) return fromLocal;
    // One-time migrate from the older sessionStorage key.
    const fromSession = sessionStorage.getItem(STANDUP_SESSION_KEY);
    if (fromSession) {
      localStorage.setItem(STANDUP_SESSION_KEY, fromSession);
      sessionStorage.removeItem(STANDUP_SESSION_KEY);
      return fromSession;
    }
    return null;
  } catch {
    return null;
  }
}

export function readStandupSession(): StandupSessionState | null {
  try {
    const raw = readRaw();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StandupSessionState>;
    if (
      typeof parsed.startDate !== "string" ||
      typeof parsed.endDate !== "string" ||
      typeof parsed.output !== "string" ||
      typeof parsed.hasGeneratedOnce !== "boolean"
    ) {
      return null;
    }
    const status = parsed.status;
    if (status !== "idle" && status !== "success" && status !== "empty" && status !== "error") {
      return null;
    }
    return {
      startDate: parsed.startDate,
      endDate: parsed.endDate,
      output: parsed.output,
      status,
      statusMessage: typeof parsed.statusMessage === "string" ? parsed.statusMessage : null,
      hasGeneratedOnce: parsed.hasGeneratedOnce,
      expanded: parsed.expanded === true,
    };
  } catch {
    return null;
  }
}

export function writeStandupSession(state: StandupSessionState) {
  try {
    localStorage.setItem(STANDUP_SESSION_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota / private-mode failures — persistence is best-effort.
  }
}

export function clearStandupSession() {
  try {
    localStorage.removeItem(STANDUP_SESSION_KEY);
    sessionStorage.removeItem(STANDUP_SESSION_KEY);
  } catch {
    // ignore
  }
}
