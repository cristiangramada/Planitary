"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/utils/cn";

interface DashboardSectionProps {
  icon: LucideIcon;
  iconClassName?: string;
  title: string;
  /** Optional "View all" style link shown at the top-right of the header. */
  viewAllHref?: string;
  viewAllLabel?: string;
  /** Section-level error message. Rendered in place of children when present. */
  error?: string | null;
  onRetry?: () => void;
  loading?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Shared card wrapper for every Dashboard section — consistent header, spacing,
 * and independent loading/error states so one section failing never breaks
 * the rest of the page.
 */
export function DashboardSection({
  icon: Icon,
  iconClassName,
  title,
  viewAllHref,
  viewAllLabel = "View all",
  error,
  onRetry,
  loading,
  className,
  children,
}: DashboardSectionProps) {
  const headingId = `dashboard-section-${title.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "flex flex-col rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4",
        className
      )}
    >
      <div className="flex items-center gap-2 mb-3 shrink-0">
        <Icon className={cn("w-4 h-4", iconClassName)} aria-hidden="true" />
        <h2 id={headingId} className="font-semibold text-sm">
          {title}
        </h2>
        {loading && (
          <span className="text-[11px] text-[hsl(var(--muted-foreground))]" aria-live="polite">
            Refreshing…
          </span>
        )}
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="ml-auto text-xs font-medium text-[hsl(var(--primary))] hover:underline cursor-pointer"
          >
            {viewAllLabel}
          </Link>
        )}
      </div>

      {error ? (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-500">
          <span>{error}</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="shrink-0 text-xs font-semibold underline cursor-pointer"
            >
              Retry
            </button>
          )}
        </div>
      ) : (
        children
      )}
    </section>
  );
}

/** Compact skeleton rows for a loading section. */
export function DashboardSkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-11 rounded-lg bg-[hsl(var(--muted))] animate-pulse"
        />
      ))}
    </div>
  );
}

/** Compact empty state for a Dashboard section (lighter than the full-page EmptyState). */
export function DashboardEmptyState({
  message,
  action,
}: {
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
      <p className="text-sm text-[hsl(var(--muted-foreground))]">{message}</p>
      {action}
    </div>
  );
}
