import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { BarChart2, CheckSquare, CalendarDays, BookOpen, TrendingUp } from "lucide-react";

export const metadata: Metadata = { title: "Summary" };

const weekStats = [
  { label: "Tasks completed",  value: 0, icon: CheckSquare,  color: "text-blue-500",   bg: "bg-blue-500/10" },
  { label: "Events attended",  value: 0, icon: CalendarDays, color: "text-purple-500", bg: "bg-purple-500/10" },
  { label: "Journal entries",  value: 0, icon: BookOpen,     color: "text-emerald-500",bg: "bg-emerald-500/10" },
  { label: "Productive days",  value: 0, icon: TrendingUp,   color: "text-orange-500", bg: "bg-orange-500/10" },
];

const PERIOD_TABS = ["This week", "This month", "Last 90 days"];

export default function SummaryPage() {
  return (
    <AppShell title="Summary">
      <div className="h-full flex flex-col gap-4">

        {/* ── Top row: title + period tabs + stats ── */}
        <div className="shrink-0 flex flex-col gap-3">
          {/* Title + tabs on same row */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Summary</h2>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
                A snapshot of your productivity — no AI, just your data.
              </p>
            </div>
            <div className="flex gap-1 p-1 rounded-lg bg-[hsl(var(--muted))]">
              {PERIOD_TABS.map((tab, i) => (
                <button
                  key={tab}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    i === 0
                      ? "bg-[hsl(var(--background))] text-[hsl(var(--foreground))] shadow-sm cursor-default"
                      : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] cursor-pointer"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {weekStats.map(({ label, value, icon: Icon, color, bg }) => (
              <div
                key={label}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]"
              >
                <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${bg} ${color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xl font-bold leading-none">{value}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 truncate">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Bottom: three panels filling remaining height ── */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">

          {/* Task breakdown */}
          <section className="flex flex-col rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 min-h-0 overflow-hidden">
            <h3 className="font-semibold text-sm mb-4 shrink-0 flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-blue-500" />
              Task breakdown
            </h3>
            <div className="flex-1 flex flex-col justify-center space-y-4">
              {[
                { label: "High priority",   pct: 0, color: "bg-red-500" },
                { label: "Medium priority", pct: 0, color: "bg-amber-500" },
                { label: "Low priority",    pct: 0, color: "bg-sky-500" },
              ].map(({ label, pct, color }) => (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[hsl(var(--muted-foreground))]">{label}</span>
                    <span className="font-medium">{pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[hsl(var(--muted))]">
                    <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Mood overview */}
          <section className="flex flex-col rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 min-h-0 overflow-hidden">
            <h3 className="font-semibold text-sm mb-4 shrink-0 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-500" />
              Mood overview
            </h3>
            <div className="flex-1 flex flex-col justify-center space-y-4">
              {[
                { label: "😄 Great", pct: 0, color: "bg-emerald-500" },
                { label: "🙂 Good",  pct: 0, color: "bg-blue-500" },
                { label: "😐 Okay",  pct: 0, color: "bg-amber-500" },
              ].map(({ label, pct, color }) => (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[hsl(var(--muted-foreground))]">{label}</span>
                    <span className="font-medium">{pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[hsl(var(--muted))]">
                    <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Activity over time */}
          <section className="flex flex-col rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 min-h-0 overflow-hidden">
            <h3 className="font-semibold text-sm mb-4 shrink-0 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-[hsl(var(--primary))]" />
              Activity over time
            </h3>
            <div className="flex-1 flex flex-col justify-end">
              <div className="flex items-end gap-1 h-28">
                {Array.from({ length: 7 }, (_, i) => (
                  <div key={i} className="flex flex-col items-center gap-1 flex-1">
                    <div className="w-full rounded-t bg-[hsl(var(--muted))]" style={{ height: "4px" }} />
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                      {["S", "M", "T", "W", "T", "F", "S"][i]}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-center text-xs text-[hsl(var(--muted-foreground))] mt-3">
                Activity will appear here once you start using the app.
              </p>
            </div>
          </section>

        </div>
      </div>
    </AppShell>
  );
}
