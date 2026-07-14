import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { CheckSquare, CalendarDays, BookOpen, TrendingUp } from "lucide-react";

export const metadata: Metadata = { title: "Dashboard" };

const stats = [
  { label: "Tasks due today",     value: "0",      icon: CheckSquare,  color: "text-blue-500",   bg: "bg-blue-500/10" },
  { label: "Events this week",    value: "0",      icon: CalendarDays, color: "text-purple-500", bg: "bg-purple-500/10" },
  { label: "Journal streak",      value: "0 days", icon: BookOpen,     color: "text-emerald-500",bg: "bg-emerald-500/10" },
  { label: "Completed this week", value: "0",      icon: TrendingUp,   color: "text-orange-500", bg: "bg-orange-500/10" },
];

export default function DashboardPage() {
  return (
    <AppShell title="Dashboard">
      <div className="h-full flex flex-col gap-5">

        {/* ── Greeting ── */}
        <div className="shrink-0">
          <h2 className="text-xl font-bold tracking-tight">Good day 👋</h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
            Here&apos;s what&apos;s happening today.
          </p>
        </div>

        {/* ── Stats strip ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
          {stats.map(({ label, value, icon: Icon, color, bg }) => (
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

        {/* ── Main panels (fill remaining height) ── */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">

          {/* Upcoming Tasks */}
          <section className="flex flex-col rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 min-h-0 overflow-hidden">
            <div className="flex items-center gap-2 mb-4 shrink-0">
              <CheckSquare className="w-4 h-4 text-blue-500" />
              <h3 className="font-semibold text-sm">Upcoming Tasks</h3>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <CheckSquare className="w-8 h-8 text-[hsl(var(--muted-foreground))] opacity-40 mb-2" />
              <p className="text-sm text-[hsl(var(--muted-foreground))]">No tasks yet</p>
            </div>
          </section>

          {/* Upcoming Events */}
          <section className="flex flex-col rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 min-h-0 overflow-hidden">
            <div className="flex items-center gap-2 mb-4 shrink-0">
              <CalendarDays className="w-4 h-4 text-purple-500" />
              <h3 className="font-semibold text-sm">Upcoming Events</h3>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <CalendarDays className="w-8 h-8 text-[hsl(var(--muted-foreground))] opacity-40 mb-2" />
              <p className="text-sm text-[hsl(var(--muted-foreground))]">No events scheduled</p>
            </div>
          </section>

        </div>
      </div>
    </AppShell>
  );
}
