import Link from "next/link";
import { CheckSquare, CalendarDays, BookOpen } from "lucide-react";
import type { Metadata } from "next";
import { Logo } from "@/components/ui/Logo";

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
    <div className="flex flex-col h-full overflow-hidden bg-[hsl(var(--background))]">
      {/* Nav */}
      <header className="flex items-center justify-between px-6 sm:px-8 py-5 border-b border-[hsl(var(--border))] shrink-0 [@media(max-height:850px)]:py-3">
        <Logo
          size={48}
          className="[@media(max-height:850px)]:size-9"
          priority
        />
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

      {/* Hero — shrinks on short viewports so everything fits with no scroll */}
      <main className="flex flex-col items-center justify-center flex-1 min-h-0 text-center px-6 py-12 sm:py-16 lg:py-24 [@media(max-height:850px)]:py-4">
        <Logo
          size={120}
          className="mb-8 [@media(max-height:850px)]:mb-3 [@media(max-height:850px)]:size-16"
          priority
        />
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4 max-w-2xl [@media(max-height:850px)]:text-3xl [@media(max-height:850px)]:mb-2">
          Your productivity universe
        </h1>
        <p className="text-lg text-[hsl(var(--muted-foreground))] max-w-lg mb-10 [@media(max-height:850px)]:text-sm [@media(max-height:850px)]:mb-4">
          Manage tasks, schedule events, journal your thoughts, and find anything — all in one
          beautifully focused place.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 shrink-0">
          <Link
            href="/signup"
            className="px-6 py-3 text-sm font-semibold rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity cursor-pointer [@media(max-height:850px)]:py-2"
          >
            Start for free
          </Link>
          <Link
            href="/login"
            className="px-6 py-3 text-sm font-semibold rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer [@media(max-height:850px)]:py-2"
          >
            Sign in
          </Link>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-20 max-w-3xl w-full [@media(max-height:850px)]:mt-6 [@media(max-height:850px)]:gap-3">
          {features.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="flex flex-col items-center p-6 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-center gap-3 [@media(max-height:850px)]:p-3 [@media(max-height:850px)]:gap-2"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[hsl(var(--muted))] shrink-0 [@media(max-height:850px)]:w-8 [@media(max-height:850px)]:h-8">
                <Icon className="w-5 h-5 text-[hsl(var(--primary))] [@media(max-height:850px)]:w-4 [@media(max-height:850px)]:h-4" />
              </div>
              <h3 className="font-semibold text-sm">{title}</h3>
              <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed [@media(max-height:850px)]:line-clamp-2">
                {description}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
