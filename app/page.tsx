import Link from "next/link";
import type { Metadata } from "next";
import { Logo } from "@/components/ui/Logo";
import { MarketingNavbar } from "@/components/marketing/MarketingNavbar";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { ScrollDownArrow } from "@/components/marketing/ScrollDownArrow";
import { CelestialDecor } from "@/components/marketing/CelestialDecor";
import { AppWindowFrame } from "@/components/marketing/AppWindowFrame";
import { TasksAppPreview } from "@/components/marketing/TasksAppPreview";
import { CalendarAppPreview } from "@/components/marketing/CalendarAppPreview";
import { DashboardAppPreview } from "@/components/marketing/DashboardAppPreview";
import { JournalAppPreview } from "@/components/marketing/JournalAppPreview";
import { StandupAppPreview } from "@/components/marketing/StandupAppPreview";
import { SearchAppPreview } from "@/components/marketing/SearchAppPreview";
import { ThemeShowcase } from "@/components/marketing/ThemeShowcase";

export const metadata: Metadata = {
  title: "Planitary",
};

const PRIMARY_CTA =
  "px-5 py-2.5 text-sm font-semibold rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity cursor-pointer";
const SECONDARY_CTA =
  "px-5 py-2.5 text-sm font-semibold rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer";

/** The 01 — Plan it step covers two features, each with its own preview. */
const PLAN_IT_FEATURES = [
  {
    title: "Tasks",
    description: "Organize tasks into lists with priorities and due dates.",
    preview: <TasksAppPreview />,
  },
  {
    title: "Calendar",
    description: "See events and due tasks together in month, week, or day views.",
    preview: <CalendarAppPreview />,
  },
];

const OTHER_STEPS = [
  {
    number: "02",
    kicker: "DO IT",
    title: "Dashboard",
    description: "Keep today's work in focus without losing sight of what's coming next.",
    preview: <DashboardAppPreview />,
    reverse: true,
  },
  {
    number: "03",
    kicker: "REMEMBER IT",
    title: "Journal",
    description:
      "Keep a lightweight record of what you worked on, then turn your entries into a standup when you need one.",
    preview: <JournalAppPreview />,
    reverse: false,
  },
];

export default function HomePage() {
  return (
    <div className="h-full overflow-y-auto scroll-smooth bg-[hsl(var(--background))] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <MarketingNavbar />

      {/* Hero */}
      <section className="relative flex min-h-[calc(100vh-4rem)] flex-col justify-center px-4 sm:px-6 py-16 sm:py-20">
        <CelestialDecor />

        <div className="relative mx-auto max-w-2xl text-center">
          <Logo size={192} priority className="mx-auto mb-4 sm:mb-5" />
          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight">Planitary</h1>
          <p className="mt-8 sm:mt-10 text-lg sm:text-2xl font-medium text-[hsl(var(--muted-foreground))]">
            Your productivity universe.
          </p>
          <p className="mt-5 text-base sm:text-lg text-[hsl(var(--muted-foreground))] mx-auto text-pretty sm:whitespace-nowrap">
            Plan your work, track your days, and keep everything in one place.
          </p>
          <div className="mt-10 sm:mt-12 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/signup" className={PRIMARY_CTA}>
              Get started
            </Link>
            <Link href="/login" className={SECONDARY_CTA}>
              Sign in
            </Link>
          </div>
        </div>

        <ScrollDownArrow />
      </section>

      {/* Product walkthrough */}
      <section id="features" className="px-4 sm:px-6 pt-10 sm:pt-14 pb-20 sm:pb-28">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-center mb-14 sm:mb-20">
            Plan it. Do it. Remember it.
          </h2>

          <div className="space-y-16 sm:space-y-24">
            {/* 01 — Plan it: Tasks, then Calendar */}
            <div>
              <p className="text-xs font-semibold tracking-widest text-[hsl(var(--primary))] mb-3">
                01 — PLAN IT
              </p>
              <h3 className="text-xl sm:text-2xl font-semibold tracking-tight mb-8 sm:mb-10">
                Tasks &amp; Calendar
              </h3>

              <div className="space-y-10 sm:space-y-14">
                {PLAN_IT_FEATURES.map((feature) => (
                  <div key={feature.title} className="grid items-center gap-8 sm:grid-cols-2 sm:gap-12">
                    <div>
                      <h4 className="text-base sm:text-lg font-semibold tracking-tight mb-2">
                        {feature.title}
                      </h4>
                      <p className="text-[hsl(var(--muted-foreground))] leading-relaxed max-w-md">
                        {feature.description}
                      </p>
                    </div>
                    <AppWindowFrame glow={false}>{feature.preview}</AppWindowFrame>
                  </div>
                ))}
              </div>
            </div>

            {OTHER_STEPS.map((step) => (
              <div key={step.number} className="grid items-center gap-8 sm:grid-cols-2 sm:gap-12">
                <div className={step.reverse ? "sm:order-2" : undefined}>
                  <p className="text-xs font-semibold tracking-widest text-[hsl(var(--primary))] mb-3">
                    {step.number} — {step.kicker}
                  </p>
                  <h3 className="text-xl sm:text-2xl font-semibold tracking-tight mb-3">{step.title}</h3>
                  <p className="text-[hsl(var(--muted-foreground))] leading-relaxed max-w-md">
                    {step.description}
                  </p>
                </div>
                <div className={step.reverse ? "sm:order-1" : undefined}>
                  <AppWindowFrame glow={false}>{step.preview}</AppWindowFrame>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Standup */}
      <section className="px-4 sm:px-6 py-16 sm:py-20 border-t border-[hsl(var(--border))]">
        <div className="mx-auto max-w-4xl grid items-center gap-8 sm:grid-cols-2 sm:gap-12">
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight mb-3">
              Turn entries into a standup.
            </h2>
            <p className="text-[hsl(var(--muted-foreground))] leading-relaxed max-w-md">
              Pick a date range and Planitary drafts a copy-ready update from what you already
              wrote in your journal.
            </p>
          </div>
          <AppWindowFrame glow={false}>
            <StandupAppPreview />
          </AppWindowFrame>
        </div>
      </section>

      {/* Search */}
      <section className="px-4 sm:px-6 py-16 sm:py-20 border-t border-[hsl(var(--border))]">
        <div className="mx-auto max-w-4xl grid items-center gap-8 sm:grid-cols-2 sm:gap-12">
          <div className="sm:order-2">
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight mb-3">
              Find anything, instantly.
            </h2>
            <p className="text-[hsl(var(--muted-foreground))] leading-relaxed max-w-md">
              Search across tasks, calendar events, and journal entries at once, then jump
              straight to what you found.
            </p>
          </div>
          <div className="min-w-0 sm:order-1">
            <AppWindowFrame glow={false}>
              <SearchAppPreview />
            </AppWindowFrame>
          </div>
        </div>
      </section>

      {/* Themes */}
      <section id="themes" className="px-4 sm:px-6 py-20 sm:py-28 border-t border-[hsl(var(--border))]">
        <div className="mx-auto max-w-5xl">
          <div className="text-center max-w-lg mx-auto mb-10 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-3">
              Make Planitary yours.
            </h2>
            <p className="text-[hsl(var(--muted-foreground))]">
              Unlock themes as you build productive days.
            </p>
          </div>

          <ThemeShowcase />

          <p className="text-center text-sm text-[hsl(var(--muted-foreground))] mt-8 text-pretty sm:whitespace-nowrap">
            Complete tasks on different days to unlock new themes.
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 sm:px-6 py-20 sm:py-24 border-t border-[hsl(var(--border))]">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-3">
            Build momentum, one day at a time.
          </h2>
          <p className="text-[hsl(var(--muted-foreground))] mb-7">
            Start planning your days with Planitary.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/signup" className={PRIMARY_CTA}>
              Get started
            </Link>
            <Link href="/login" className={SECONDARY_CTA}>
              Sign in
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
