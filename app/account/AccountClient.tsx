"use client";

import { AppShell } from "@/components/layout/AppShell";
import { ProfileSection } from "./ProfileSection";
import { EmailSection } from "./EmailSection";
import { PasswordSection } from "./PasswordSection";
import { AppearanceSection } from "./AppearanceSection";
import { SessionSection } from "./SessionSection";

interface AccountClientProps {
  userId: string;
  email: string;
  initialDisplayName: string | null;
}

export function AccountClient({ userId, email, initialDisplayName }: AccountClientProps) {
  return (
    <AppShell title="Account">
      <div className="h-full overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="max-w-2xl mx-auto flex flex-col gap-4 pb-8">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Account</h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
              Manage your profile and account security.
            </p>
          </div>

          <ProfileSection userId={userId} email={email} initialDisplayName={initialDisplayName} />
          <EmailSection currentEmail={email} />
          <PasswordSection />
          <AppearanceSection />
          <SessionSection />
        </div>
      </div>
    </AppShell>
  );
}
