import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { SearchInput } from "./SearchInput";

export const metadata: Metadata = { title: "Search" };

export default function SearchPage() {
  return (
    <AppShell title="Search">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h2 className="text-xl font-bold">Search</h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
            Find tasks, events, and journal entries instantly.
          </p>
        </div>

        <SearchInput />
      </div>
    </AppShell>
  );
}
