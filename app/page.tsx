import Link from "next/link";
import { CheckSquare, CalendarDays, BookOpen } from "lucide-react";
import type { Metadata } from "next";
import { Logo } from "@/components/ui/Logo";

export const metadata: Metadata = {
  title: "Planitary",
};

const features = [
  {
    icon: CheckSquare,
    title: "Tasks",
    description: "Organize work in lists with priorities, due dates, subtasks, and recurring tasks.",
  },
  {
    icon: CalendarDays,
    title: "Calendar",
    description: "See events and due tasks together in month, week, or day views.",
  },
  {
    icon: BookOpen,
    title: "Journal",
    description: "Write daily entries, review completed tasks, and draft weekly standup summaries.",
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col h-full overflow-hidden bg-[hsl(var(--background))]">
      {/* Nav */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-[hsl(var(--border))] shrink-0">
        <Logo size={48} priority />
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="px-4 py-2 text-sm font-medium rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity cursor-pointer"
          >
            Get started
          </Link>
        </div>
      </header>

      {/*
        Same proportions as production on roomy screens; modest clamp on short
        heights so MacBooks fit without inventing large empty gaps between sections.
      */}
      <main className="flex flex-1 min-h-0 flex-col items-center justify-center text-center px-6 py-[clamp(1.5rem,6vh,6rem)]">
        <Logo
          size={120}
          className="size-[clamp(5rem,14vh,7.5rem)] mb-[clamp(1.25rem,2.5vh,2rem)]"
          priority
        />
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4 max-w-2xl [@media(max-height:800px)]:text-4xl">
          Your productivity universe
        </h1>
        <p className="text-lg text-[hsl(var(--muted-foreground))] max-w-lg mb-10 [@media(max-height:800px)]:mb-6 [@media(max-height:800px)]:text-base">
          Manage tasks, schedule events, journal your thoughts, and find anything — all in one
          beautifully focused place.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/signup"
            className="px-6 py-3 text-sm font-semibold rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity cursor-pointer"
          >
            Start for free
          </Link>
          <Link
            href="/login"
            className="px-6 py-3 text-sm font-semibold rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer"
          >
            Sign in
          </Link>
        </div>

        {/* Feature cards — production mt-20 on tall screens, slightly tighter when short */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-[clamp(5.5rem,6vh,6rem)] max-w-3xl w-full">
          {features.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="flex flex-col items-center p-6 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-center gap-3 [@media(max-height:800px)]:p-5"
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
    </div>
  );
}
