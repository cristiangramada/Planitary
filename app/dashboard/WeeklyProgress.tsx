"use client";

import { TrendingUp, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import type { WeeklyProgress as WeeklyProgressData } from "@/lib/dashboard";
import { DashboardSection } from "./DashboardSection";

interface WeeklyProgressProps {
  data: WeeklyProgressData;
  error: string | null;
  loading: boolean;
  onRetry: () => void;
}

export function WeeklyProgress({ data, error, loading, onRetry }: WeeklyProgressProps) {
  const router = useRouter();
  const { tasksCompleted, tasksActiveDue, journalDays, eventsThisWeek, completionPercent } = data;

  return (
    <DashboardSection
      icon={TrendingUp}
      iconClassName="text-orange-500"
      title="Weekly progress"
      error={error}
      onRetry={onRetry}
      loading={loading}
    >
      <div className="mb-3">
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
            Completion
          </span>
          <span className="text-sm font-semibold">
            {completionPercent === null ? "No tasks scheduled this week" : `${completionPercent}%`}
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={completionPercent ?? 0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Weekly task completion"
          className="h-2 rounded-full bg-[hsl(var(--muted))] overflow-hidden"
        >
          <div
            className="h-full rounded-full bg-[hsl(var(--primary))] transition-all"
            style={{ width: `${completionPercent ?? 0}%` }}
          />
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-lg bg-[hsl(var(--muted)/0.5)] px-2.5 py-2">
          <dt className="text-[11px] text-[hsl(var(--muted-foreground))]">Completed</dt>
          <dd className="text-lg font-bold leading-none mt-0.5">{tasksCompleted}</dd>
        </div>
        <div className="rounded-lg bg-[hsl(var(--muted)/0.5)] px-2.5 py-2">
          <dt className="text-[11px] text-[hsl(var(--muted-foreground))]">Active</dt>
          <dd className="text-lg font-bold leading-none mt-0.5">{tasksActiveDue}</dd>
        </div>
        <div className="rounded-lg bg-[hsl(var(--muted)/0.5)] px-2.5 py-2">
          <dt className="text-[11px] text-[hsl(var(--muted-foreground))]">Journal days</dt>
          <dd className="text-lg font-bold leading-none mt-0.5">{journalDays}/7</dd>
        </div>
      </dl>

      <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3">
        {eventsThisWeek} calendar {eventsThisWeek === 1 ? "event" : "events"} this week
      </p>

      <button
        type="button"
        onClick={() => router.push("/journal?section=standup")}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-[hsl(var(--border))] text-xs font-medium text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))] transition-colors cursor-pointer"
      >
        <Sparkles className="w-3.5 h-3.5 shrink-0" />
        Weekly standup — generate from journal
      </button>
    </DashboardSection>
  );
}
