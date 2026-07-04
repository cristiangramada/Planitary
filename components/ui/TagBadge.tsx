import { cn } from "@/utils/cn";
import type { Tag } from "@/types";

interface TagBadgeProps {
  tag: Pick<Tag, "name" | "color">;
  onRemove?: () => void;
  className?: string;
}

export function TagBadge({ tag, onRemove, className }: TagBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-medium rounded-full px-2 py-0.5 border",
        className
      )}
      style={
        tag.color
          ? {
              backgroundColor: tag.color + "22", // 13% opacity hex
              borderColor: tag.color + "55",     // 33% opacity hex
              color: tag.color,
            }
          : undefined
      }
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: tag.color ?? "hsl(var(--muted-foreground))" }}
      />
      {tag.name}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
          aria-label={`Remove tag ${tag.name}`}
        >
          ×
        </button>
      )}
    </span>
  );
}
