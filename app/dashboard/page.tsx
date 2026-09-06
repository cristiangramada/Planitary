import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { fetchDashboardData } from "@/lib/dashboard";
import { fetchDisplayName } from "@/lib/profile";
import { localHour, localTodayStr } from "@/utils/date";
import { CLIENT_TIME_ZONE_COOKIE, parseClientTimeZone } from "@/lib/time-zone";
import { DashboardClient } from "./DashboardClient";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * Server Component — fetches the visitor's local "today" when their browser
 * has supplied its time zone cookie. New visitors fall back to UTC and the
 * client corrects that one initial render after hydration.
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const cookieStore = await cookies();
  const timeZone = parseClientTimeZone(cookieStore.get(CLIENT_TIME_ZONE_COOKIE)?.value);
  const initialDate = localTodayStr(timeZone);
  const initialHour = localHour(timeZone);

  const [dashboardData, displayName] = await Promise.all([
    fetchDashboardData(supabase, initialDate),
    fetchDisplayName(supabase).catch(() => null),
  ]);

  return (
    <DashboardClient
      initialDate={initialDate}
      initialHour={initialHour}
      initialData={dashboardData}
      displayName={displayName}
    />
  );
}
