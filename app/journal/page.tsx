import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { BookOpen, Plus } from "lucide-react";

export const metadata: Metadata = { title: "Journal" };

const MOODS = [
  { label: "Great",    emoji: "😄" },
  { label: "Good",     emoji: "🙂" },
  { label: "Okay",     emoji: "😐" },
  { label: "Bad",      emoji: "😔" },
  { label: "Terrible", emoji: "😞" },
];

export default function JournalPage() {
  return (
    <AppShell title="Journal">
      <div className="h-full flex flex-col max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-4 shrink-0">
          <div>
            <h2 className="text-xl font-bold">Journal</h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
              Capture your thoughts, reflections, and daily moments.
            </p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity cursor-pointer shrink-0">
            <Plus className="w-4 h-4" />
            New entry
          </button>
        </div>

        {/* Mood filter */}
        <div className="flex gap-2 mb-4 flex-wrap shrink-0">
          <button className="px-3 py-1.5 text-xs font-medium rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] cursor-pointer">
            All moods
          </button>
          {MOODS.map(({ label, emoji }) => (
            <button
              key={label}
              className="px-3 py-1.5 text-xs font-medium rounded-full border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer"
            >
              {emoji} {label}
            </button>
          ))}
        </div>

        {/* Entries list — fills remaining height */}
        <div className="flex-1 min-h-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] h-full">
            <EmptyState
              icon={BookOpen}
              title="No journal entries yet"
              description="Start writing to capture your thoughts, moods, and daily reflections."
              action={
                <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity cursor-pointer">
                  <Plus className="w-4 h-4" />
                  Write your first entry
                </button>
              }
            />
          </div>
        </div>

      </div>
    </AppShell>
  );
}
