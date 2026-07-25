import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { fetchAllTags } from "@/lib/tasks";
import { fetchDashboardData } from "@/lib/dashboard";
import { fetchDisplayName } from "@/lib/profile";
import { localTodayStr } from "@/utils/date";
import { DashboardClient } from "./DashboardClient";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * Server Component — fetches a best-effort "today" using the server clock
 * (UTC on Vercel), plus the initial bounded Dashboard queries. DashboardClient
 * uses the client's local date and refetches when that differs, matching the
 * pattern used by the Journal page.
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const initialDate = localTodayStr();
  const initialHour = new Date().getHours();

  const [dashboardData, allTags, displayName] = await Promise.all([
    fetchDashboardData(supabase, initialDate),
    fetchAllTags(supabase).catch(() => []),
    fetchDisplayName(supabase).catch(() => null),
  ]);

  return (
    <DashboardClient
      initialDate={initialDate}
      initialHour={initialHour}
      initialData={dashboardData}
      allTags={allTags}
      displayName={displayName}
    />
  );
}
