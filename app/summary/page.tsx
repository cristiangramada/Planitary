import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { BarChart2, CheckSquare, CalendarDays, BookOpen, TrendingUp } from "lucide-react";

export const metadata: Metadata = { title: "Summary" };

const weekStats = [
  { label: "Tasks completed", value: 0, icon: CheckSquare, color: "text-blue-500", bg: "bg-blue-500/10" },
  { label: "Events attended", value: 0, icon: CalendarDays, color: "text-purple-500", bg: "bg-purple-500/10" },
  { label: "Journal entries", value: 0, icon: BookOpen, color: "text-green-500", bg: "bg-green-500/10" },
  { label: "Productive days", value: 0, icon: TrendingUp, color: "text-orange-500", bg: "bg-orange-500/10" },
];

export default function SummaryPage() {
  return (
    <AppShell title="Summary">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h2 className="text-xl font-bold">Summary</h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
            A snapshot of your productivity — no AI, just your data.
          </p>
        </div>

        {/* Time period tabs */}
        <div className="flex gap-1 p-1 rounded-lg bg-[hsl(var(--muted))] w-fit">
          {["This week", "This month", "Last 90 days"].map((tab, i) => (
            <button
              key={tab}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                i === 0
                  ? "bg-[hsl(var(--background))] text-[hsl(var(--foreground))] shadow-sm"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {weekStats.map(({ label, value, icon: Icon, color, bg }) => (
            <div
              key={label}
              className="p-5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]"
            >
              <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg ${bg} ${color} mb-3`}>
                <Icon className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Activity breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-blue-500" />
              Task breakdown
            </h3>
            <div className="space-y-3">
              {[
                { label: "High priority", pct: 0 },
                { label: "Medium priority", pct: 0 },
                { label: "Low priority", pct: 0 },
              ].map(({ label, pct }) => (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[hsl(var(--muted-foreground))]">{label}</span>
                    <span className="font-medium">{pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[hsl(var(--muted))]">
                    <div
                      className="h-1.5 rounded-full bg-[hsl(var(--primary))]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-green-500" />
              Mood overview
            </h3>
            <div className="space-y-3">
              {[
                { label: "😄 Great", pct: 0 },
                { label: "🙂 Good", pct: 0 },
                { label: "😐 Okay", pct: 0 },
              ].map(({ label, pct }) => (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[hsl(var(--muted-foreground))]">{label}</span>
                    <span className="font-medium">{pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[hsl(var(--muted))]">
                    <div
                      className="h-1.5 rounded-full bg-green-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Placeholder chart area */}
        <section className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
          <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-[hsl(var(--primary))]" />
            Activity over time
          </h3>
          <div className="flex items-end justify-center gap-1 h-28">
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className="flex flex-col items-center gap-1 flex-1">
                <div
                  className="w-full rounded-t bg-[hsl(var(--muted))]"
                  style={{ height: "4px" }}
                />
                <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                  {["S", "M", "T", "W", "T", "F", "S"][i]}
                </span>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-[hsl(var(--muted-foreground))] mt-2">
            Activity will appear here once you start using the app.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
