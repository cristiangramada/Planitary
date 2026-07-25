import { SignOutButton } from "@/components/ui/SignOutButton";
import { AccountCard } from "./AccountCard";

export function SessionSection() {
  return (
    <AccountCard title="Session">
      <p className="text-sm text-[hsl(var(--muted-foreground))]">
        Sign out of Planitary on this device.
      </p>
      <div>
        <SignOutButton />
      </div>
    </AccountCard>
  );
}
