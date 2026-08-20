import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { countProductiveDays } from "@/lib/productive-days";
import { AppearanceClient } from "../AppearanceClient";

export const metadata: Metadata = { title: "Appearance" };

export default async function AppearancePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const productiveDayCount = await countProductiveDays(supabase).catch(() => 0);

  return <AppearanceClient productiveDayCount={productiveDayCount} />;
}
