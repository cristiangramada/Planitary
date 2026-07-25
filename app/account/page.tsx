import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchDisplayName } from "@/lib/profile";
import { AccountClient } from "./AccountClient";

export const metadata: Metadata = { title: "Account" };

/**
 * Server Component — verifies the session (proxy.ts also protects this route)
 * and loads the current email + display name before handing off to the
 * interactive Account form sections.
 */
export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const displayName = await fetchDisplayName(supabase).catch(() => null);

  return (
    <AccountClient
      userId={user.id}
      email={user.email ?? ""}
      initialDisplayName={displayName}
    />
  );
}
