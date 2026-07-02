import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { CalendarDays, Plus, ChevronLeft, ChevronRight } from "lucide-react";

export const metadata: Metadata = { title: "Calendar" };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getCalendarDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(d);
  return grid;
}

export default function CalendarPage() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const days = getCalendarDays(year, month);

  return (
    <AppShell title="Calendar">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold">Calendar</h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
              Plan and view your upcoming events.
            </p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity">
            <Plus className="w-4 h-4" />
            New event
          </button>
        </div>

        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-6">
            <button className="p-1.5 rounded-md hover:bg-[hsl(var(--muted))] transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h3 className="font-semibold">
              {MONTHS[month]} {year}
            </h3>
            <button className="p-1.5 rounded-md hover:bg-[hsl(var(--muted))] transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day labels */}
          <div className="grid grid-cols-7 mb-2">
            {DAYS.map((d) => (
              <div
                key={d}
                className="text-center text-xs font-medium text-[hsl(var(--muted-foreground))] py-1"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-px bg-[hsl(var(--border))] rounded-lg overflow-hidden">
            {days.map((day, i) => (
              <div
                key={i}
                className={`aspect-square flex flex-col items-center justify-start p-1 bg-[hsl(var(--card))] ${
                  day ? "hover:bg-[hsl(var(--muted))] cursor-pointer transition-colors" : ""
                }`}
              >
                {day && (
                  <span
                    className={`text-sm w-7 h-7 flex items-center justify-center rounded-full ${
                      day === today
                        ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-semibold"
                        : "text-[hsl(var(--foreground))]"
                    }`}
                  >
                    {day}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Events for today */}
        <div className="mt-6 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          <EmptyState
            icon={CalendarDays}
            title="No events scheduled"
            description="Add your first event to start planning your time."
            action={
              <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity">
                <Plus className="w-4 h-4" />
                Add an event
              </button>
            }
          />
        </div>
      </div>
    </AppShell>
  );
}
