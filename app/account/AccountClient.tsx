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
  productiveDayCount: number;
}

export function AccountClient({
  userId,
  email,
  initialDisplayName,
  productiveDayCount,
}: AccountClientProps) {
  return (
    <AppShell>
      <div className="h-full overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="max-w-4xl mx-auto flex flex-col gap-4 pb-8">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Account</h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
              Manage your profile and account security.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_20rem] gap-4 items-start">
            <div className="flex flex-col gap-4">
              <EmailSection currentEmail={email} />
              <PasswordSection />
              <SessionSection />
            </div>
            <div className="flex flex-col gap-4">
              <ProfileSection userId={userId} email={email} initialDisplayName={initialDisplayName} />
            </div>
          </div>

          <AppearanceSection productiveDayCount={productiveDayCount} />
        </div>
      </div>
    </AppShell>
  );
}
