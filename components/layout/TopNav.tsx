"use client";

import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Menu } from "lucide-react";

interface TopNavProps {
  title: string;
  onMenuClick?: () => void;
}

export function TopNav({ title, onMenuClick }: TopNavProps) {
  return (
    <header className="flex items-center justify-between h-14 px-6 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))] shrink-0">
      <div className="flex items-center gap-3">
        {/* Mobile menu button — visible below lg */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-1.5 rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-base font-semibold">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />
      </div>
    </header>
  );
}
