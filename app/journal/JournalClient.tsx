"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { BookOpen, CheckSquare2, Save, Trash2, Plus } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { MiniCalendarPicker } from "@/components/ui/MiniCalendarPicker";
import { createClient } from "@/lib/supabase/client";
import { saveJournalEntry, deleteJournalEntry } from "@/lib/journal";
import { cn } from "@/utils/cn";
import { formatDate, localTodayStr, toLocalDateStr } from "@/utils/date";
import type { JournalEntry, Task } from "@/types";

type CompletedTaskLite = Pick<Task, "id" | "title" | "priority" | "status" | "completed_at">;

interface JournalClientProps {
  initialEntries: JournalEntry[];
  completedTasks: CompletedTaskLite[];
}

export function JournalClient({ initialEntries, completedTasks }: JournalClientProps) {
  const [entries, setEntries] = useState<JournalEntry[]>(initialEntries);
  const [selectedDate, setSelectedDate] = useState<string>(localTodayStr());
  const [draft, setDraft] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const confirmRef = useRef<HTMLDivElement>(null);

  // The entry (if any) that already exists for the selected date.
  const activeEntry = useMemo(
    () => entries.find((e) => e.entry_date === selectedDate) ?? null,
    [entries, selectedDate]
  );

  // Keep the editor in sync with whichever date is selected.
  useEffect(() => {
    setDraft(activeEntry?.content ?? "");
    setConfirmingDelete(false);
  }, [activeEntry]);

  // Close the delete confirmation on outside click / Escape.
  useEffect(() => {
    if (!confirmingDelete) return;
    function onOutside(e: MouseEvent) {
      if (confirmRef.current && !confirmRef.current.contains(e.target as Node)) {
        setConfirmingDelete(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setConfirmingDelete(false);
    }
    document.addEventListener("mousedown", onOutside);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      window.removeEventListener("keydown", onKey);
    };
  }, [confirmingDelete]);

  const isDirty = draft.trim() !== (activeEntry?.content ?? "").trim();
  const canSave = draft.trim().length > 0 && isDirty;

  const completedThatDay = useMemo(
    () =>
      completedTasks.filter(
        (t) => t.completed_at && toLocalDateStr(t.completed_at) === selectedDate
      ),
    [completedTasks, selectedDate]
  );

  const heading = useMemo(() => {
    if (selectedDate === localTodayStr()) return "Today";
    return formatDate(selectedDate);
  }, [selectedDate]);

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error("Not signed in");

      const saved = await saveJournalEntry(supabase, data.user.id, selectedDate, draft.trim());
      setEntries((prev) => {
        const withoutThisDate = prev.filter((e) => e.entry_date !== saved.entry_date);
        return [...withoutThisDate, saved].sort((a, b) =>
          b.entry_date.localeCompare(a.entry_date)
        );
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save entry.");
    } finally {
      setSaving(false);
    }
  }, [canSave, draft, selectedDate]);

  const handleDelete = useCallback(async () => {
    if (!activeEntry) return;
    setConfirmingDelete(false);
    try {
      const supabase = createClient();
      await deleteJournalEntry(supabase, activeEntry.id);
      setEntries((prev) => prev.filter((e) => e.id !== activeEntry.id));
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete entry.");
    }
  }, [activeEntry]);

  // Keyboard shortcut: Cmd/Ctrl+S to save
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave]);

  return (
    <AppShell title="Journal">
      <div className="h-full flex flex-col">
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

        {/* ── Two-column body ── */}
        <div className="flex-1 flex gap-4 min-h-0">
          {/* Left: editor */}
          <div className="flex-1 min-w-0 flex flex-col">
            {/* Header row */}
            <div className="flex items-center justify-between gap-3 mb-4 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <MiniCalendarPicker
                  value={selectedDate}
                  onChange={(v) => setSelectedDate(v ?? localTodayStr())}
                  className="w-56"
                />
                <span className="text-sm font-semibold text-[hsl(var(--muted-foreground))] shrink-0">
                  {heading}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {activeEntry && (
                  <div ref={confirmRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(true)}
                      title="Delete entry"
                      className={cn(
                        "p-2 rounded-lg transition-colors cursor-pointer",
                        confirmingDelete
                          ? "bg-red-500/10 text-red-500"
                          : "text-[hsl(var(--muted-foreground))] hover:bg-red-500/10 hover:text-red-500"
                      )}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    {confirmingDelete && (
                      <div className="absolute right-0 top-full mt-2 z-20 w-56 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-xl p-3">
                        <p className="text-sm font-medium mb-3">Delete this entry?</p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setConfirmingDelete(false)}
                            className="flex-1 py-1.5 text-xs font-medium rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleDelete}
                            className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!canSave || saving}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-opacity",
                    canSave && !saving
                      ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 cursor-pointer"
                      : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] cursor-not-allowed"
                  )}
                >
                  <Save className="w-4 h-4" />
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>

            {/* Text editor */}
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={
                activeEntry
                  ? "Edit your entry…"
                  : `What happened on ${formatDate(selectedDate)}?`
              }
              className="flex-1 min-h-0 w-full resize-none rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] p-4 text-sm leading-relaxed text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] transition"
            />

            {/* Completed That Day */}
            <div className="mt-4 shrink-0">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-[hsl(var(--muted-foreground))] mb-2">
                <CheckSquare2 className="w-4 h-4" />
                Completed That Day
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
                      <span className="text-xs font-medium truncate max-w-[180px]">
                        {t.title}
                      </span>
                      <PriorityBadge priority={t.priority} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: past entries */}
          <div className="w-72 shrink-0 flex flex-col overflow-hidden border-l border-[hsl(var(--border))] pl-4">
            <h3 className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-3 shrink-0">
              Past Entries
            </h3>

            {entries.length === 0 ? (
              <div className="flex-1 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                <EmptyState
                  icon={BookOpen}
                  title="No entries yet"
                  description="Write your first journal entry to see it here."
                />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2 min-h-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {entries.map((entry) => {
                  const isSelected = entry.entry_date === selectedDate;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => setSelectedDate(entry.entry_date)}
                      className={cn(
                        "w-full text-left p-3 rounded-xl border transition-colors cursor-pointer",
                        isSelected
                          ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.06)]"
                          : "border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:bg-[hsl(var(--muted)/0.5)]"
                      )}
                    >
                      <p
                        className={cn(
                          "text-xs font-semibold mb-1",
                          isSelected
                            ? "text-[hsl(var(--primary))]"
                            : "text-[hsl(var(--foreground))]"
                        )}
                      >
                        {entry.entry_date === localTodayStr()
                          ? "Today"
                          : formatDate(entry.entry_date)}
                      </p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-2">
                        {entry.content}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Quick "new entry" shortcut when today has no entry yet */}
            {!entries.some((e) => e.entry_date === localTodayStr()) && (
              <button
                type="button"
                onClick={() => setSelectedDate(localTodayStr())}
                className="mt-3 shrink-0 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-dashed border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Write today&apos;s entry
              </button>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
