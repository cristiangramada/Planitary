"use client";

import { AppShell } from "@/components/layout/AppShell";
import { AppearanceSection } from "./AppearanceSection";

interface AppearanceClientProps {
  productiveDayCount: number;
}

export function AppearanceClient({ productiveDayCount }: AppearanceClientProps) {
  return (
    <AppShell flushTop mainClassName="flex flex-col overflow-y-auto py-4 max-lg:py-6">
      <div className="mx-auto my-auto flex w-full max-w-4xl flex-col gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Appearance</h2>
        </div>

        <AppearanceSection productiveDayCount={productiveDayCount} />
      </div>
    </AppShell>
  );
}
