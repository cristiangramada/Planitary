import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

interface AppWindowFrameProps {
  children: ReactNode;
  className?: string;
  /** Subtle indigo glow behind the window. Disabled for smaller inline previews. */
  glow?: boolean;
}

/**
 * Restrained "app window" chrome used to frame real Planitary UI previews
 * across the marketing page — thin border, modest radius, soft shadow.
 * The product UI inside provides the visual interest, not the frame.
 */
export function AppWindowFrame({ children, className, glow = true }: AppWindowFrameProps) {
  return (
    <div className={cn("relative", className)}>
      {glow && (
        <div
          aria-hidden="true"
          className="absolute -inset-x-6 -inset-y-6 -z-10 rounded-[2.5rem] bg-[hsl(var(--primary)/0.14)] blur-[70px]"
        />
      )}
      <div className="relative overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.55)]">
        {children}
      </div>
    </div>
  );
}
