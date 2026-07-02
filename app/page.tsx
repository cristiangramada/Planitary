import Link from "next/link";
import { Globe, CheckSquare, CalendarDays, BookOpen } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Planitary — Your productivity universe",
};

const features = [
  {
    icon: CheckSquare,
    title: "Tasks",
    description: "Capture and organize everything on your mind with priority levels and due dates.",
  },
  {
    icon: CalendarDays,
    title: "Calendar",
    description: "Stay on top of your schedule with a clean, distraction-free event view.",
  },
  {
    icon: BookOpen,
    title: "Journal",
    description: "Reflect on your day with private journal entries and mood tracking.",
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-[hsl(var(--background))]">
      {/* Nav */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-[hsl(var(--border))]">
        <div className="flex items-center gap-2">
          <Globe className="w-6 h-6 text-[hsl(var(--primary))]" />
          <span className="text-lg font-semibold tracking-tight">Planitary</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="px-4 py-2 text-sm font-medium rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity"
          >
            Get started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex flex-col items-center justify-center flex-1 text-center px-6 py-24">
        <div className="flex items-center justify-center w-20 h-20 rounded-3xl bg-[hsl(var(--primary)/0.15)] mb-8">
          <Globe className="w-10 h-10 text-[hsl(var(--primary))]" />
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4 max-w-2xl">
          Your productivity universe
        </h1>
        <p className="text-lg text-[hsl(var(--muted-foreground))] max-w-lg mb-10">
          Manage tasks, schedule events, journal your thoughts, and find anything — all in one
          beautifully focused place.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/signup"
            className="px-6 py-3 text-sm font-semibold rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity"
          >
            Start for free
          </Link>
          <Link
            href="/login"
            className="px-6 py-3 text-sm font-semibold rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
          >
            Sign in
          </Link>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-20 max-w-3xl w-full">
          {features.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="flex flex-col items-center p-6 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-center gap-3"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[hsl(var(--muted))]">
                <Icon className="w-5 h-5 text-[hsl(var(--primary))]" />
              </div>
              <h3 className="font-semibold text-sm">{title}</h3>
              <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
                {description}
              </p>
            </div>
          ))}
        </div>
      </main>

      <footer className="text-center py-6 text-xs text-[hsl(var(--muted-foreground))] border-t border-[hsl(var(--border))]">
        &copy; {new Date().getFullYear()} Planitary. All rights reserved.
      </footer>
    </div>
  );
}
