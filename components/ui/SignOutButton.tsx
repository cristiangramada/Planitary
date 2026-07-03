"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh(); // Invalidate server-side session caches
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={loading}
      className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] disabled:opacity-60 transition-colors"
    >
      <LogOut className="w-4 h-4 shrink-0" />
      {loading ? "Signing out…" : "Sign out"}
    </button>
  );
}
