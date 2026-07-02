import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { CheckSquare, CalendarDays, BookOpen, TrendingUp } from "lucide-react";

export const metadata: Metadata = { title: "Dashboard" };

const stats = [
  { label: "Tasks due today", value: "0", icon: CheckSquare, color: "text-blue-500" },
  { label: "Events this week", value: "0", icon: CalendarDays, color: "text-purple-500" },
  { label: "Journal streak", value: "0 days", icon: BookOpen, color: "text-green-500" },
  { label: "Completed this week", value: "0", icon: TrendingUp, color: "text-orange-500" },
];

export default function DashboardPage() {
  return (
    <AppShell title="Dashboard">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Greeting */}
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Good day 👋</h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Here&apos;s what&apos;s happening today.
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map(({ label, value, icon: Icon, color }) => (
            <div
              key={label}
              className="p-5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]"
            >
              <div className={`mb-3 ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming tasks */}
          <section className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
            <h3 className="font-semibold text-sm mb-4">Upcoming Tasks</h3>
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CheckSquare className="w-8 h-8 text-[hsl(var(--muted-foreground))] mb-2" />
              <p className="text-sm text-[hsl(var(--muted-foreground))]">No tasks yet</p>
            </div>
          </section>

          {/* Upcoming events */}
          <section className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
            <h3 className="font-semibold text-sm mb-4">Upcoming Events</h3>
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CalendarDays className="w-8 h-8 text-[hsl(var(--muted-foreground))] mb-2" />
              <p className="text-sm text-[hsl(var(--muted-foreground))]">No events scheduled</p>
            </div>
          </section>
        </div>

        {/* Recent journal */}
        <section className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
          <h3 className="font-semibold text-sm mb-4">Recent Journal Entry</h3>
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <BookOpen className="w-8 h-8 text-[hsl(var(--muted-foreground))] mb-2" />
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              No journal entries yet. Start writing today.
            </p>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
