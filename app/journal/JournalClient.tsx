"use client";

import {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { CheckSquare2, ChevronLeft, ChevronRight, Plus, SortAsc } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { MiniCalendarPicker } from "@/components/ui/MiniCalendarPicker";
import { JournalEntryContextMenu } from "./JournalEntryContextMenu";
import { StandupSection } from "./StandupSection";
import { createClient } from "@/lib/supabase/client";
import {
  fetchJournalEntriesByDate,
  createJournalEntry,
  updateJournalEntry,
  deleteJournalEntry,
} from "@/lib/journal";
import { cn } from "@/utils/cn";
import { localTodayStr, toLocalDateStr, shiftDateStr } from "@/utils/date";
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

// Keeps "today" correct across a midnight rollover (and after the tab regains
// focus) without ever calling setState from inside an effect: React re-renders
// automatically whenever the external snapshot (the client's local date)
// changes, and the server snapshot keeps first paint hydration-safe.
function subscribeToLocalDate(callback: () => void) {
  const interval = setInterval(callback, 60_000);
  window.addEventListener("focus", callback);
  document.addEventListener("visibilitychange", callback);
  return () => {
    clearInterval(interval);
    window.removeEventListener("focus", callback);
    document.removeEventListener("visibilitychange", callback);
  };
}

function useClientLocalToday(serverToday: string): string {
  return useSyncExternalStore(subscribeToLocalDate, localTodayStr, () => serverToday);
}

export function JournalClient({
  initialDate,
  initialEntries,
  completedTasks,
}: JournalClientProps) {
  const clientToday = useClientLocalToday(initialDate);
  const [manualDate, setManualDate] = useState<string | null>(null);
  // Tracks today automatically (via clientToday) until the user manually
  // navigates, at which point the manually chosen date takes over.
  const selectedDate = manualDate ?? clientToday;
  const [entries, setEntries] = useState<JournalEntry[]>(initialEntries);
  const [quickAddValue, setQuickAddValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const isFirstRun = useRef(true);

  // ---------------------------------------------------------------------------
  // Date-scoped entry loading
  // ---------------------------------------------------------------------------

  const loadEntriesForDate = useCallback(async (date: string) => {
    setError(null);
    try {
      const supabase = createClient();
      const data = await fetchJournalEntriesByDate(supabase, date);
      setEntries(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load entries.");
    }
  }, []);

  useEffect(() => {
    if (isFirstRun.current) {
      // The initial entries prop already matches `selectedDate` for first paint.
      isFirstRun.current = false;
      return;
    }
    setContextMenu(null);
    loadEntriesForDate(selectedDate);
  }, [selectedDate, loadEntriesForDate]);

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
          <StandupSection />
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

// ─────────────────────────────────────────────────────────────────────────────
// Journal entry row — divider-separated, click-to-edit, right-click to delete.
// ─────────────────────────────────────────────────────────────────────────────

interface JournalEntryRowProps {
  entry: JournalEntry;
  onSave: (id: string, content: string) => Promise<void>;
  onOpenContextMenu: (entryId: string, x: number, y: number) => void;
}

function caretIndexFromPoint(x: number, y: number): number | null {
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  if (typeof doc.caretRangeFromPoint === "function") {
    const range = doc.caretRangeFromPoint(x, y);
    if (range?.startContainer.nodeType === Node.TEXT_NODE) {
      return range.startOffset;
    }
  }
  if (typeof doc.caretPositionFromPoint === "function") {
    const pos = doc.caretPositionFromPoint(x, y);
    if (pos?.offsetNode.nodeType === Node.TEXT_NODE) {
      return pos.offset;
    }
  }
  return null;
}

function JournalEntryRow({ entry, onSave, onOpenContextMenu }: JournalEntryRowProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(entry.content);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const touchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false);
  const caretIndexRef = useRef<number | null>(null);

  // Note: `value` only backs the input while editing — `startEdit` always
  // seeds it fresh from `entry.content`, and the read-only view below renders
  // `entry.content` directly, so no effect is needed to keep them in sync.

  useEffect(() => {
    if (!editing || !inputRef.current) return;
    const el = inputRef.current;
    el.focus();
    const len = el.value.length;
    const idx = caretIndexRef.current;
    caretIndexRef.current = null;
    if (idx != null && idx >= 0 && idx <= len) {
      el.setSelectionRange(idx, idx);
    } else {
      el.setSelectionRange(len, len);
    }
  }, [editing]);

  function startEdit(caretIndex: number | null = null) {
    if (editing || saving) return;
    caretIndexRef.current = caretIndex;
    setValue(entry.content);
    setEditing(true);
  }

  async function commitEdit() {
    if (saving) return;
    const trimmed = value.trim();

    if (!trimmed) {
      // Do not save an empty value — restore the previous content instead.
      setValue(entry.content);
      setEditing(false);
      return;
    }
    if (trimmed === entry.content.trim()) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      await onSave(entry.id, trimmed);
      setEditing(false);
    } catch {
      // Restore the previous content on failure; the page-level banner shows the error.
      setValue(entry.content);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    setValue(entry.content);
    setEditing(false);
  }

  function handleEditKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
  }

  function handleRowClick(e: React.MouseEvent) {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    startEdit(caretIndexFromPoint(e.clientX, e.clientY));
  }

  function handleRowKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (editing) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      startEdit(null);
    }
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    onOpenContextMenu(entry.id, e.clientX, e.clientY);
  }

  // Mobile fallback: long-press opens the same context menu used on desktop right-click.
  function handleTouchStart(e: React.TouchEvent) {
    const touch = e.touches[0];
    if (!touch) return;
    touchTimer.current = setTimeout(() => {
      suppressClick.current = true;
      onOpenContextMenu(entry.id, touch.clientX, touch.clientY);
    }, 550);
  }
  function clearTouchTimer() {
    if (touchTimer.current) {
      clearTimeout(touchTimer.current);
      touchTimer.current = null;
    }
  }

  return (
    <div
      role={editing ? undefined : "button"}
      tabIndex={editing ? -1 : 0}
      onClick={handleRowClick}
      onKeyDown={handleRowKeyDown}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchMove={clearTouchTimer}
      onTouchEnd={clearTouchTimer}
      aria-label={editing ? undefined : `Journal entry: ${entry.content}. Press Enter to edit.`}
      className={cn(
        "px-4 py-3 rounded-xl border transition-colors cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]",
        editing
          ? "border-[hsl(var(--input))] bg-[hsl(var(--card))]"
          : "border-transparent hover:border-[hsl(var(--input))] hover:bg-[hsl(var(--card))]"
      )}
    >
      {editing ? (
        <>
          <label htmlFor={`journal-edit-${entry.id}`} className="sr-only">
            Edit journal entry
          </label>
          <input
            id={`journal-edit-${entry.id}`}
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleEditKeyDown}
            onBlur={commitEdit}
            onClick={(e) => e.stopPropagation()}
            disabled={saving}
            className="w-full bg-transparent text-sm leading-relaxed text-[hsl(var(--foreground))] cursor-text focus:outline-none disabled:opacity-60"
          />
        </>
      ) : (
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words select-none">
          <span className="cursor-text">{entry.content}</span>
        </p>
      )}
    </div>
  );
}
