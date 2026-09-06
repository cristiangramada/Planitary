"use client";

import { AppShell } from "./AppShell";

type PageLoadingVariant = "tasks" | "calendar" | "journal" | "search";

function Placeholder({ className }: { className: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-lg bg-[hsl(var(--muted))] ${className}`}
    />
  );
}

/** Keeps the app shell visible while a route's client search-param boundary loads. */
export function PageLoadingShell({ variant }: { variant: PageLoadingVariant }) {
  const flushTop = variant === "tasks" || variant === "calendar";

  return (
    <AppShell flushTop={flushTop}>
      <div className="h-full w-full" role="status" aria-label="Loading page">
        {variant === "tasks" && (
          <div className="flex h-full gap-4 pt-4">
            <div className="hidden w-56 shrink-0 space-y-3 lg:block">
              <Placeholder className="h-10 w-full" />
              <Placeholder className="h-10 w-full" />
              <Placeholder className="h-10 w-4/5" />
            </div>
            <div className="min-w-0 flex-1 space-y-4">
              <Placeholder className="h-10 w-full" />
              <Placeholder className="h-28 w-full" />
              <Placeholder className="h-28 w-full" />
            </div>
          </div>
        )}

        {variant === "calendar" && (
          <div className="h-full space-y-5 pt-4">
            <div className="flex items-center justify-between">
              <Placeholder className="h-9 w-36" />
              <Placeholder className="h-9 w-52" />
            </div>
            <Placeholder className="h-[min(70vh,42rem)] w-full" />
          </div>
        )}

        {variant === "journal" && (
          <div className="mx-auto max-w-4xl space-y-5">
            <Placeholder className="h-9 w-48" />
            <Placeholder className="h-28 w-full" />
            <Placeholder className="h-20 w-full" />
            <Placeholder className="h-20 w-full" />
          </div>
        )}

        {variant === "search" && (
          <div className="mx-auto max-w-3xl space-y-5">
            <Placeholder className="h-12 w-full" />
            <div className="flex gap-2">
              <Placeholder className="h-8 w-16" />
              <Placeholder className="h-8 w-20" />
              <Placeholder className="h-8 w-24" />
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
