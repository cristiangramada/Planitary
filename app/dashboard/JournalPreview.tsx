"use client";

import { useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Plus } from "lucide-react";
import type { JournalEntry } from "@/types";
import { DashboardSection, DashboardSkeletonRows } from "./DashboardSection";

interface JournalPreviewProps {
  entries: JournalEntry[];
  todayStr: string;
  error: string | null;
  loading: boolean;
  onRetry: () => void;
  onQuickAdd: (content: string) => Promise<void>;
  inputRef?: RefObject<HTMLInputElement | null>;
}

const PREVIEW_LIMIT = 5;

export function JournalPreview({
  entries,
  todayStr,
  error,
  loading,
  onRetry,
  onQuickAdd,
  inputRef,
}: JournalPreviewProps) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
      viewAllHref={`/journal?date=${todayStr}`}
      error={error}
      onRetry={onRetry}
      loading={loading}
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
            disabled={submitting}
            autoComplete="off"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] focus:outline-none transition disabled:opacity-60"
          />
          <Plus
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]"
          />
          {value.length === 0 && (
            <span className="pointer-events-none absolute left-9 top-1/2 -translate-y-1/2 text-sm text-[hsl(var(--muted-foreground))]">
              Add entry
            </span>
          )}
        </div>
      </form>

      {loading ? (
        <DashboardSkeletonRows count={3} />
      ) : visible.length === 0 ? (
        <p className="py-3 text-sm text-[hsl(var(--muted-foreground))]">No journal entries today.</p>
      ) : (
        <div className="divide-y divide-[hsl(var(--border))]">
          {visible.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => router.push(`/journal?date=${todayStr}&entry=${entry.id}`)}
              className="w-full text-left px-1 py-2.5 text-sm leading-relaxed hover:bg-[hsl(var(--muted)/0.5)] rounded-lg transition-colors cursor-pointer line-clamp-2"
            >
              {entry.content}
            </button>
          ))}
        </div>
      )}
    </DashboardSection>
  );
}
