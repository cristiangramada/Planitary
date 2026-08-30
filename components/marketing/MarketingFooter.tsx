import { Logo } from "@/components/ui/Logo";

export function MarketingFooter() {
  return (
    <footer className="border-t border-[hsl(var(--border))]">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 sm:px-6 py-8 text-center sm:flex-row sm:justify-between sm:text-left">
        <div className="flex items-center gap-2">
          <Logo size={20} />
          <span className="text-sm font-medium">Planitary</span>
        </div>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">© 2026 Planitary</p>
      </div>
    </footer>
  );
}
