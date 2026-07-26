import { cn } from "@/utils/cn";
import type { Priority } from "@/types";

const CONFIG: Record<Exclude<Priority, "none">, { label: string; classes: string }> = {
  high:   { label: "High",   classes: "bg-red-500/15 text-red-500" },
  medium: { label: "Medium", classes: "bg-amber-500/15 text-amber-500" },
  low:    { label: "Low",    classes: "bg-green-500/15 text-green-600 dark:text-green-500" },
};

interface PriorityBadgeProps {
  priority: Priority;
  className?: string;
}

/** Renders nothing for "none" — no priority is not worth a badge. */
export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  if (priority === "none") return null;
  const { label, classes } = CONFIG[priority];
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center text-[11px] font-semibold rounded-full px-2 h-5 leading-none",
        classes,
        className
      )}
    >
      {label}
    </span>
  );
}
