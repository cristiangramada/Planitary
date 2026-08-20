import { cn } from "@/utils/cn";

interface AccountCardProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

/** Shared card wrapper for each Account section — matches DashboardSection's styling. */
export function AccountCard({ title, description, children, className }: AccountCardProps) {
  const headingId = title
    ? `account-section-${title.toLowerCase().replace(/\s+/g, "-")}`
    : "account-section-description";

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 flex flex-col gap-4",
        className
      )}
    >
      {(title || description) && (
        <div>
          {title ? (
            <h2 id={headingId} className="font-semibold text-sm">
              {title}
            </h2>
          ) : (
            description && (
              <p id={headingId} className="text-xs text-[hsl(var(--muted-foreground))]">
                {description}
              </p>
            )
          )}
          {title && description && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{description}</p>
          )}
        </div>
      )}
      {children}
    </section>
  );
}
