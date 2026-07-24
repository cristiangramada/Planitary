"use client";

import {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckSquare2, ChevronLeft, ChevronRight, Plus, SortAsc } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { MiniCalendarPicker } from "@/components/ui/MiniCalendarPicker";
import { JournalEntryContextMenu } from "./JournalEntryContextMenu";
import { JournalEntryRow } from "./JournalEntryRow";
import { StandupSection } from "./StandupSection";
import { useClientLocalToday } from "@/hooks/useClientLocalToday";
import { createClient } from "@/lib/supabase/client";
import {
  fetchJournalEntriesByDate,
  createJournalEntry,
  updateJournalEntry,
  deleteJournalEntry,
} from "@/lib/journal";
import { cn } from "@/utils/cn";
import { toLocalDateStr, shiftDateStr } from "@/utils/date";
import type { JournalEntry, Task } from "@/types";

type CompletedTaskLite = Pick<Task, "id" | "title" | "priority" | "status" | "completed_at">;

type SortKey = "newest" | "oldest";

const SORT_LABELS: Record<SortKey, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
};

interface JournalClientProps {
  initialDate: string;
  initialEntries: JournalEntry[];
  completedTasks: CompletedTaskLite[];
}

interface ContextMenuState {
  entryId: string;
  x: number;
  y: number;
}

export function JournalClient({
  initialDate,
  initialEntries,
  completedTasks,
}: JournalClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientToday = useClientLocalToday(initialDate);

  // Read deep-link params into initial state so the first load targets the
  // linked date (not "today"). Applying them only in an effect raced the
  // date-load effect and could leave the correct date with empty/stale rows.
  const [manualDate, setManualDate] = useState<string | null>(() => searchParams.get("date"));
  const [highlightEntryId, setHighlightEntryId] = useState<string | null>(() => searchParams.get("entry"));
  // Tracks today automatically (via clientToday) until the user manually
  // navigates, at which point the manually chosen date takes over.
  const selectedDate = manualDate ?? clientToday;
  const [entries, setEntries] = useState<JournalEntry[]>(() =>
    // Only trust SSR rows when we're actually showing that SSR date.
    (searchParams.get("date") ?? initialDate) === initialDate ? initialEntries : []
  );
  const [quickAddValue, setQuickAddValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [forceStandupExpand, setForceStandupExpand] = useState(
    () => searchParams.get("section") === "standup"
  );

  const isFirstRun = useRef(true);
  const loadRequestIdRef = useRef(0);

  // ---------------------------------------------------------------------------
  // Date-scoped entry loading
  // ---------------------------------------------------------------------------

  const loadEntriesForDate = useCallback(async (date: string) => {
    const requestId = ++loadRequestIdRef.current;
    setError(null);
    try {
      const supabase = createClient();
      const data = await fetchJournalEntriesByDate(supabase, date);
      if (requestId !== loadRequestIdRef.current) return; // superseded by a newer date
      setEntries(data);
    } catch (err) {
      if (requestId !== loadRequestIdRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to load entries.");
    }
  }, []);

  useEffect(() => {
    // Always load on the client for the date being shown. Skipping the first
    // run used to trust SSR data, but on Vercel the server clock is UTC (so
    // "today" can differ from the user's local date) and the first paint after
    // login can also come back empty before the session cookie is usable.
    if (isFirstRun.current) {
      isFirstRun.current = false;
      if (selectedDate === initialDate && initialEntries.length > 0) {
        // Fast path: SSR already returned rows for this exact local date.
        return;
      }
    }
    setContextMenu(null);
    loadEntriesForDate(selectedDate);
  }, [selectedDate, loadEntriesForDate, initialDate, initialEntries.length]);

  // ---------------------------------------------------------------------------
  // Deep-link support: /journal?date=<date>&entry=<id> (e.g. from a Search
  // result) and /journal?section=standup (from the Dashboard). State is seeded
  // from the URL above; here we only clear the params so navigating away and
  // back doesn't reopen the highlight, and handle soft-nav updates if the
  // params change while already on /journal.
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const dateParam = searchParams.get("date");
    const entryParam = searchParams.get("entry");
    const sectionParam = searchParams.get("section");
    if (!dateParam && !entryParam && !sectionParam) return;
    /* eslint-disable react-hooks/set-state-in-effect -- sync deep-link if params arrive via client navigation */
    if (dateParam) setManualDate(dateParam);
    if (entryParam) setHighlightEntryId(entryParam);
    if (sectionParam === "standup") setForceStandupExpand(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    router.replace("/journal", { scroll: false });
  }, [searchParams, router]);

  useEffect(() => {
    if (!forceStandupExpand) return;
    document.getElementById("standup-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [forceStandupExpand]);

  useEffect(() => {
    if (!highlightEntryId) return;
    if (!entries.some((e) => e.id === highlightEntryId)) return;
    document
      .getElementById(`journal-entry-${highlightEntryId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    // The highlight is a temporary visual cue, not a permanent style change.
    const timer = setTimeout(() => setHighlightEntryId(null), 2000);
    return () => clearTimeout(timer);
  }, [highlightEntryId, entries]);

  const sortedEntries = useMemo(() => {
    const sorted = [...entries].sort((a, b) => a.created_at.localeCompare(b.created_at));
    return sortBy === "newest" ? sorted.reverse() : sorted;
  }, [entries, sortBy]);

  const todayStr = clientToday;
  const completedThatDay = useMemo(
    () =>
      completedTasks.filter(
        (t) => t.completed_at && toLocalDateStr(t.completed_at) === selectedDate
      ),
    [completedTasks, selectedDate]
  );

  // ---------------------------------------------------------------------------
  // Date navigation
  // ---------------------------------------------------------------------------

  function goToDate(date: string) {
    setManualDate(date);
  }
  function handlePrevDay() {
    goToDate(shiftDateStr(selectedDate, -1));
  }
  function handleNextDay() {
    goToDate(shiftDateStr(selectedDate, 1));
  }
  function handleToday() {
    // Clearing the manual override re-attaches selectedDate to the live
    // clientToday snapshot (so it keeps tracking across a midnight rollover).
    setManualDate(null);
  }

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  const getUserId = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw new Error("Not signed in");
    return data.user.id;
  }, []);

  const handleQuickAddSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitting) return; // guard against duplicate Enter presses
      const trimmed = quickAddValue.trim();
      if (!trimmed) return;

      setSubmitting(true);
      setError(null);
      try {
        const supabase = createClient();
        const userId = await getUserId();
        const created = await createJournalEntry(supabase, userId, selectedDate, trimmed);
        setEntries((prev) => [created, ...prev]);
        setQuickAddValue("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create entry.");
        // keep the typed text so the user doesn't lose it
      } finally {
        setSubmitting(false);
      }
    },
    [submitting, quickAddValue, getUserId, selectedDate]
  );

  const handleSaveEdit = useCallback(async (id: string, content: string) => {
    const supabase = createClient();
    const updated = await updateJournalEntry(supabase, id, content);
    setEntries((prev) => prev.map((e) => (e.id === id ? updated : e)));
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const supabase = createClient();
      await deleteJournalEntry(supabase, id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete entry.");
    }
  }, []);

  const handleOpenContextMenu = useCallback((entryId: string, x: number, y: number) => {
    setContextMenu({ entryId, x, y });
  }, []);

  return (
    <AppShell title="Journal">
      <div className="h-full flex flex-col max-w-3xl mx-auto w-full">
        {/* ── Error banner ── */}
        {error && (
          <div className="mb-3 px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/10 text-sm text-red-500 shrink-0">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 underline text-xs cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ── Date navigation + sort ── */}
        <div className="flex items-center justify-between gap-3 mb-4 shrink-0">
          <div className="flex items-center gap-1 min-w-0">
            <button
              type="button"
              onClick={handlePrevDay}
              aria-label="Previous day"
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNextDay}
              aria-label="Next day"
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer shrink-0"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <div className="ml-1 min-w-0">
              <MiniCalendarPicker
                value={selectedDate}
                onChange={(v) => goToDate(v ?? todayStr)}
                className="w-48"
              />
            </div>

            <button
              type="button"
              onClick={handleToday}
              disabled={selectedDate === todayStr}
              className={cn(
                "ml-2 h-7 px-3 rounded-full border text-xs font-semibold transition-colors shrink-0",
                selectedDate === todayStr
                  ? "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] opacity-50 cursor-default"
                  : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))] cursor-pointer"
              )}
            >
              Today
            </button>
          </div>

          {/* Sort dropdown — mirrors the Tasks page sort control */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowSortMenu((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={showSortMenu}
              aria-label={`Sort entries: ${SORT_LABELS[sortBy]}`}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer"
            >
              <SortAsc className="w-3.5 h-3.5" />
              {SORT_LABELS[sortBy]}
            </button>
            {showSortMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowSortMenu(false)}
                />
                <div
                  role="listbox"
                  className="absolute right-0 z-20 mt-1 w-40 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-lg py-1"
                >
                  {(Object.entries(SORT_LABELS) as [SortKey, string][]).map(
                    ([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        role="option"
                        aria-selected={sortBy === key}
                        onClick={() => {
                          setSortBy(key);
                          setShowSortMenu(false);
                        }}
                        className={cn(
                          "w-full px-3 py-1.5 text-xs text-left hover:bg-[hsl(var(--muted))] transition-colors",
                          sortBy === key
                            ? "text-[hsl(var(--primary))] font-medium cursor-default"
                            : "text-[hsl(var(--foreground))] cursor-pointer"
                        )}
                      >
                        {label}
                      </button>
                    )
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Quick-add input ── */}
        <form onSubmit={handleQuickAddSubmit} className="mb-2 shrink-0">
          <label htmlFor="journal-quick-add" className="sr-only">
            Add a journal entry
          </label>
          <div className="relative">
            <input
              id="journal-quick-add"
              type="text"
              value={quickAddValue}
              onChange={(e) => setQuickAddValue(e.target.value)}
              aria-label="Add a journal entry"
              disabled={submitting}
              autoComplete="off"
              className="w-full pl-4 pr-4 py-3 text-sm rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] focus:outline-none transition disabled:opacity-60"
            />
            {/* Custom placeholder: larger "+" glyph, hidden once typing starts.
                pointer-events-none lets clicks pass through to the input beneath. */}
            {quickAddValue.length === 0 && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-4 flex items-center gap-1.5 text-[hsl(var(--muted-foreground))]"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" strokeWidth={2.25} />
                <span className="text-sm leading-none">Add entry</span>
              </div>
            )}
          </div>
        </form>

        {/* ── Scrollable region: entries, completed tasks, and Standup ── */}
        <div className="flex-1 overflow-y-auto min-h-0 flex flex-col [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {sortedEntries.length === 0 ? (
            <p className="py-6 pl-4 text-sm text-[hsl(var(--muted-foreground))] shrink-0">
              No entries for this day.
            </p>
          ) : (
            <div className="divide-y divide-[hsl(var(--border))] shrink-0">
              {sortedEntries.map((entry) => (
                <JournalEntryRow
                  key={entry.id}
                  entry={entry}
                  onSave={handleSaveEdit}
                  onOpenContextMenu={handleOpenContextMenu}
                  highlighted={entry.id === highlightEntryId}
                />
              ))}
            </div>
          )}

          {/* ── Completed that day ── */}
          <div className="mt-4 shrink-0">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-[hsl(var(--muted-foreground))] mb-2">
              <CheckSquare2 className="w-4 h-4" />
              {selectedDate === todayStr ? "Completed Today" : "Completed That Day"}
            </h3>
            {completedThatDay.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[hsl(var(--border))] px-4 py-3 text-xs text-[hsl(var(--muted-foreground))]">
                No tasks were completed on this day.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {completedThatDay.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]"
                  >
                    <CheckSquare2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span className="text-xs font-medium truncate max-w-[180px]">{t.title}</span>
                    <PriorityBadge priority={t.priority} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Standup ── */}
          <StandupSection autoExpand={forceStandupExpand} />
        </div>
      </div>

      {/* ── Right-click / long-press context menu ── */}
      {contextMenu && (
        <JournalEntryContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onDelete={() => handleDelete(contextMenu.entryId)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </AppShell>
  );
}
