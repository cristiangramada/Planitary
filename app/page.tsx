import Link from "next/link";
import type { Metadata } from "next";
import { MarketingNavbar } from "@/components/marketing/MarketingNavbar";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { CelestialDecor } from "@/components/marketing/CelestialDecor";
import { AppWindowFrame } from "@/components/marketing/AppWindowFrame";
import { TasksAppPreview } from "@/components/marketing/TasksAppPreview";
import { DashboardAppPreview } from "@/components/marketing/DashboardAppPreview";
import { JournalAppPreview } from "@/components/marketing/JournalAppPreview";
import { StandupAppPreview } from "@/components/marketing/StandupAppPreview";
import { ThemeShowcase } from "@/components/marketing/ThemeShowcase";

export const metadata: Metadata = {
  title: "Planitary",
};

const PRIMARY_CTA =
  "px-5 py-2.5 text-sm font-semibold rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity cursor-pointer";
const SECONDARY_CTA =
  "px-5 py-2.5 text-sm font-semibold rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer";

const STEPS = [
  {
    number: "01",
    kicker: "PLAN IT",
    title: "Tasks & Calendar",
    description:
      "Organize tasks into lists, schedule what matters, and see your work alongside your calendar.",
    preview: <TasksAppPreview />,
    reverse: false,
  },
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
    <div className="h-full overflow-y-auto bg-[hsl(var(--background))] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <MarketingNavbar />

      {/* Hero */}
      <section className="relative px-4 sm:px-6 pt-16 sm:pt-24 pb-16 sm:pb-20">
        <CelestialDecor />

        <div className="relative mx-auto max-w-2xl text-center">
          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight">Planitary</h1>
          <p className="mt-3 text-lg sm:text-2xl font-medium text-[hsl(var(--muted-foreground))]">
            Your productivity universe.
          </p>
          <p className="mt-5 text-base sm:text-lg text-[hsl(var(--muted-foreground))] max-w-lg mx-auto">
            Plan your work, track your days, and keep everything in one place.
          </p>
          <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/signup" className={PRIMARY_CTA}>
              Get started
            </Link>
            <Link href="/login" className={SECONDARY_CTA}>
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* Product walkthrough */}
      <section id="features" className="px-4 sm:px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-center mb-14 sm:mb-20">
            Plan it. Do it. Remember it.
          </h2>

          <div className="space-y-16 sm:space-y-24">
            {STEPS.map((step) => (
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

          <p className="text-center text-sm text-[hsl(var(--muted-foreground))] mt-8">
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
