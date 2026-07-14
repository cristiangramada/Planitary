import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { SearchInput } from "./SearchInput";

export const metadata: Metadata = { title: "Search" };

export default function SearchPage() {
  return (
    <AppShell title="Search">
      <div className="h-full flex flex-col max-w-3xl mx-auto">
        <div className="mb-5 shrink-0">
          <h2 className="text-xl font-bold">Search</h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
            Find tasks, events, and journal entries instantly.
          </p>
        </div>
        <div className="flex-1 min-h-0">
          <SearchInput />
        </div>
      </div>
    </AppShell>
  );
}
