"use client";

import { useState, type RefObject } from "react";
import { BookOpen, Plus } from "lucide-react";
import type { JournalEntry } from "@/types";
import { JournalEntryContextMenu } from "@/app/journal/JournalEntryContextMenu";
import { JournalEntryRow } from "@/app/journal/JournalEntryRow";
import { DashboardSection, DashboardSkeletonRows } from "./DashboardSection";

interface JournalPreviewProps {
  entries: JournalEntry[];
  error: string | null;
  loading: boolean;
  onRetry: () => void;
  onQuickAdd: (content: string) => Promise<void>;
  onSave: (entryId: string, content: string) => Promise<void>;
  onDelete: (entryId: string) => Promise<void>;
  inputRef?: RefObject<HTMLInputElement | null>;
  className?: string;
}

const PREVIEW_LIMIT = 8;

export function JournalPreview({
  entries,
  error,
  loading,
  onRetry,
  onQuickAdd,
  onSave,
  onDelete,
  inputRef,
  className,
}: JournalPreviewProps) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ entryId: string; x: number; y: number } | null>(
    null
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await onQuickAdd(trimmed);
      setValue("");
    } finally {
      setSubmitting(false);
    }
  }

  const visible = entries.slice(0, PREVIEW_LIMIT);

  return (
    <DashboardSection
      icon={BookOpen}
      iconClassName="text-emerald-500"
      title="Journal"
      error={error}
      onRetry={onRetry}
      loading={loading}
      className={className}
    >
      <form onSubmit={handleSubmit} className="mb-2 shrink-0">
        <label htmlFor="dashboard-journal-quick-add" className="sr-only">
          Add a journal entry
        </label>
        <div className="relative">
          <input
            id="dashboard-journal-quick-add"
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-label="Add a journal entry"
            disabled={submitting}
            autoComplete="off"
            className="w-full pl-4 pr-4 py-3 text-sm rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] focus:outline-none transition disabled:opacity-60"
          />
          {value.length === 0 && (
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

      {loading ? (
        <DashboardSkeletonRows count={3} />
      ) : visible.length === 0 ? (
        <p className="flex-1 flex items-center justify-center py-6 text-sm text-[hsl(var(--muted-foreground))] text-center">
          No journal entries today.
        </p>
      ) : (
        <div className="flex-1 min-h-0 divide-y divide-[hsl(var(--border))] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {visible.map((entry) => (
            <JournalEntryRow
              key={entry.id}
              entry={entry}
              onSave={onSave}
              onOpenContextMenu={(entryId, x, y) => setContextMenu({ entryId, x, y })}
            />
          ))}
        </div>
      )}

      {contextMenu && (
        <JournalEntryContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onDelete={() => {
            void onDelete(contextMenu.entryId);
          }}
          onClose={() => setContextMenu(null)}
        />
      )}
    </DashboardSection>
  );
}
