"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  CalendarDays,
  BookOpen,
  Search,
  User,
  Palette,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/utils/cn";
import { peekTasksScopeHref } from "@/lib/tasks-scope-preference";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Tasks", href: "/tasks", icon: CheckSquare },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
  { label: "Journal", href: "/journal", icon: BookOpen },
  { label: "Search", href: "/search", icon: Search },
];

function navLinkClass(active: boolean) {
  return cn(
    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer",
    active
      ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
      : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
  );
}

export function Sidebar({ userId: initialUserId }: { userId?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [detectedUserId, setDetectedUserId] = useState<string | null>(null);
  const userId = initialUserId ?? detectedUserId;
  const accountActive = pathname === "/account";
  const appearanceActive =
    pathname === "/account/appearance" || pathname.startsWith("/account/appearance/");

  // Resolve Tasks → last Inbox/List before paint so the link never lands on
  // bare /tasks (which would briefly select Inbox).
  const [savedTasksHref, setSavedTasksHref] = useState("/tasks");
  const tasksHref = userId ? savedTasksHref : "/tasks";
  useLayoutEffect(() => {
    if (!userId) return;
    /* eslint-disable react-hooks/set-state-in-effect -- hydrate last Tasks href from localStorage before paint */
    setSavedTasksHref(peekTasksScopeHref(userId));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [pathname, userId]);

  useEffect(() => {
    if (initialUserId) return;

    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => setDetectedUserId(data.user?.id ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setDetectedUserId(session?.user.id ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, [initialUserId]);

  return (
    <aside className="flex flex-col w-max h-full border-r border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-bg))] shrink-0">
      {/* Logo — sidebar width hugs this row; slightly more inset on the right */}
      <div className="flex items-center gap-2 pl-6 pr-9 py-5 border-b border-[hsl(var(--sidebar-border))] whitespace-nowrap">
        <Logo size={36} />
        <span className="text-lg font-semibold tracking-tight">Planitary</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ label, href, icon: Icon }) => {
          const resolvedHref = label === "Tasks" ? tasksHref : href;
          const active =
            pathname === href ||
            pathname.startsWith(href + "/") ||
            (label === "Tasks" && pathname.startsWith("/tasks"));
          return (
            <Link
              key={href}
              href={resolvedHref}
              className={navLinkClass(active)}
              onClick={
                label === "Tasks"
                  ? (e) => {
                      // Keep modified / non-primary clicks on the Link href.
                      if (
                        e.metaKey ||
                        e.ctrlKey ||
                        e.shiftKey ||
                        e.altKey ||
                        e.button !== 0
                      ) {
                        return;
                      }
                      const next = userId ? peekTasksScopeHref(userId) : "/tasks";
                      if (next === resolvedHref) return;
                      e.preventDefault();
                      setSavedTasksHref(next);
                      router.push(next);
                    }
                  : undefined
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer — appearance + account */}
      <div className="px-3 pb-4 border-t border-[hsl(var(--sidebar-border))] pt-4 space-y-0.5">
        <Link href="/account/appearance" className={navLinkClass(appearanceActive)}>
          <Palette className="w-4 h-4 shrink-0" />
          Appearance
        </Link>
        <Link href="/account" className={navLinkClass(accountActive)}>
          <User className="w-4 h-4 shrink-0" />
          Account
        </Link>
      </div>
    </aside>
  );
}
