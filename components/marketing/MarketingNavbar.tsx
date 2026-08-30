import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

const NAV_LINK = "px-3 py-2 text-sm font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer";

export function MarketingNavbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 py-3.5">
        <Link href="/" className="flex items-center gap-2">
          <Logo size={32} priority />
          <span className="hidden sm:inline text-[15px] font-semibold tracking-tight">Planitary</span>
        </Link>

        <nav className="flex items-center gap-0.5 sm:gap-1">
          <a href="#features" className={`hidden md:inline-flex ${NAV_LINK}`}>
            Features
          </a>
          <a href="#themes" className={`hidden md:inline-flex ${NAV_LINK}`}>
            Themes
          </a>
          <Link href="/login" className={NAV_LINK}>
            Sign in
          </Link>
          <Link
            href="/signup"
            className="ml-1 px-3.5 sm:px-4 py-2 text-sm font-medium rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity cursor-pointer"
          >
            Get started
          </Link>
        </nav>
      </div>
    </header>
  );
}
