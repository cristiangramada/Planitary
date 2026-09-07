"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/ui/Logo";

const NAV_LINK = "px-3 py-2 text-sm font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer";

function scrollToSection(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  e.preventDefault();
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
}

function scrollToTop(e: React.MouseEvent<HTMLAnchorElement>) {
  const scrollContainer = e.currentTarget.closest<HTMLElement>(".overflow-y-auto");
  if (!scrollContainer) return;
  e.preventDefault();
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  scrollContainer.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
}

export function MarketingNavbar() {
  const headerRef = useRef<HTMLElement>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const scrollContainer = headerRef.current?.closest<HTMLElement>(".overflow-y-auto");
    if (!scrollContainer) return;

    const updateDivider = () => setIsScrolled(scrollContainer.scrollTop > 0);
    updateDivider();
    scrollContainer.addEventListener("scroll", updateDivider, { passive: true });

    return () => scrollContainer.removeEventListener("scroll", updateDivider);
  }, []);

  return (
    <header
      ref={headerRef}
      className={`sticky top-0 z-40 border-b transition-[background-color,border-color,backdrop-filter] duration-200 ${
        isScrolled
          ? "border-white/10 bg-[#050718]/55 backdrop-blur-xl"
          : "border-transparent bg-transparent backdrop-blur-none"
      }`}
    >
      <div className="mx-auto flex w-full max-w-[90rem] items-center justify-between px-4 sm:px-6 py-3">
        <Link href="/" onClick={scrollToTop} aria-label="Planitary home" className="flex items-center">
          <Logo size={44} priority />
        </Link>

        <nav className="flex items-center gap-0.5 sm:gap-1">
          <a href="#features" onClick={(e) => scrollToSection(e, "features")} className={`hidden md:inline-flex ${NAV_LINK}`}>
            Features
          </a>
          <a href="#themes" onClick={(e) => scrollToSection(e, "themes")} className={`hidden md:inline-flex ${NAV_LINK}`}>
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
