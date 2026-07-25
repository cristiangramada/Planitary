import { AccountCard } from "./AccountCard";

interface EmailSectionProps {
  currentEmail: string;
}

/** Read-only email display — change-email UI is intentionally omitted for now. */
export function EmailSection({ currentEmail }: EmailSectionProps) {
  return (
    <AccountCard title="Email">
      <div className="text-sm">
        <span className="text-[hsl(var(--muted-foreground))]">Signed in as</span>
        <p className="font-medium mt-0.5 break-all">{currentEmail}</p>
      </div>
    </AccountCard>
  );
}
