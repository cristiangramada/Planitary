interface AccountCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

/** Shared card wrapper for each Account section — matches DashboardSection's styling. */
export function AccountCard({ title, description, children }: AccountCardProps) {
  const headingId = `account-section-${title.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 flex flex-col gap-4"
    >
      <div>
        <h2 id={headingId} className="font-semibold text-sm">
          {title}
        </h2>
        {description && (
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}
