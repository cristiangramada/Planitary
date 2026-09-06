"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { cn } from "@/utils/cn";

interface AppShellProps {
  children: React.ReactNode;
  /** Authenticated user, used to scope sidebar browser preferences. */
  userId?: string;
  /** Renders in the top bar, vertically aligned with the sidebar logo. */
  topBar?: ReactNode;
  /** Skip the desktop top spacer so page content sits higher. */
  flushTop?: boolean;
  /** Extra classes on the main content area. */
  mainClassName?: string;
}

export function AppShell({
  children,
  userId,
  topBar,
  flushTop = false,
  mainClassName,
}: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-30 transition-transform duration-200 lg:relative lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <Sidebar userId={userId} />
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <div
          className={cn(
            "shrink-0 flex items-center gap-3 px-4 sm:px-6",
            // Match sidebar logo row (py-5 + 36px logo = 76px) so the greeting
            // lines up with "Planitary"
            topBar ? "h-[76px]" : "h-14",
            flushTop && !topBar && "lg:hidden"
          )}
        >
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 -ml-1.5 rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          {topBar}
        </div>
        <main
          className={cn(
            "flex-1 overflow-hidden px-4 sm:px-6 min-w-0",
            mainClassName ?? (topBar ? "pt-[19px] pb-6" : "pt-6 pb-6")
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
