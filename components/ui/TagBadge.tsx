import { cn } from "@/utils/cn";
import type { Tag } from "@/types";

interface TagBadgeProps {
  tag: Pick<Tag, "name" | "color">;
  onRemove?: () => void;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  selected?: boolean;
  className?: string;
}

export function TagBadge({
  tag,
  onRemove,
  onClick,
  onContextMenu,
  selected,
  className,
}: TagBadgeProps) {
  const colorStyle = tag.color
    ? {
        backgroundColor: tag.color + "22", // 13% opacity hex
        borderColor: tag.color + (selected ? "aa" : "55"),
        color: tag.color,
      }
    : undefined;

  const content = (
    <>
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: tag.color ?? "hsl(var(--muted-foreground))" }}
      />
      {tag.name}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
          aria-label={`Remove tag ${tag.name}`}
        >
          ×
        </button>
      )}
    </>
  );

  const classes = cn(
    "inline-flex items-center gap-1 text-[11px] font-medium rounded-full px-2 py-0.5 border",
    (onClick || onContextMenu) && "cursor-pointer hover:opacity-90 transition-opacity",
    selected && "ring-2 ring-offset-1 ring-offset-[hsl(var(--background))] ring-[hsl(var(--foreground)/0.35)]",
    !tag.color && selected && "bg-[hsl(var(--muted))] border-[hsl(var(--foreground)/0.3)]",
    className
  );

  if (onClick || onContextMenu) {
    return (
      <button
        type="button"
        onClick={onClick}
        onContextMenu={onContextMenu}
        aria-pressed={selected}
        className={classes}
        style={colorStyle}
      >
        {content}
      </button>
    );
  }

  return (
    <span className={classes} style={colorStyle}>
      {content}
    </span>
  );
}
