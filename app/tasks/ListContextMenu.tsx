"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, Trash2, Palette } from "lucide-react";
import { cn } from "@/utils/cn";
import { LIST_COLOR_KEYS, LIST_COLOR_SWATCH, type ListColorKey } from "@/lib/task-lists";

interface ListContextMenuProps {
  x: number;
  y: number;
  listName: string;
  currentColor: ListColorKey | null;
  onRename: () => void;
  onChangeColor: (color: ListColorKey | null) => void;
  onDelete: () => void;
  onClose: () => void;
}

/** Right-click / overflow-button menu for a custom List row. Modeled directly
 *  on AgendaItemContextMenu (same portal/outside-click/Escape/positioning
 *  conventions) so Lists feel consistent with the rest of the app. */
export function ListContextMenu({
  x,
  y,
  listName,
  currentColor,
  onRename,
  onChangeColor,
  onDelete,
  onClose,
}: ListContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const menuWidth = 168;
  const left = Math.min(x, window.innerWidth - menuWidth - 8);
  const top = Math.min(y, window.innerHeight - (colorOpen ? 210 : 160));

  return createPortal(
    <div
      ref={ref}
      className="fixed z-50 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-xl overflow-hidden"
      style={{ left, top, width: menuWidth }}
      role="menu"
    >
      {confirmingDelete ? (
        <div className="p-3">
          <p className="text-sm font-medium mb-1">Delete &ldquo;{listName}&rdquo;?</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3">
            Tasks in this list will be moved to Inbox.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="flex-1 py-1.5 text-xs font-medium rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onDelete();
                onClose();
              }}
              className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors cursor-pointer"
            >
              Delete list
            </button>
          </div>
        </div>
      ) : (
        <>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onRename();
              onClose();
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-left whitespace-nowrap hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer"
          >
            <Pencil className="w-4 h-4 text-[hsl(var(--muted-foreground))] shrink-0" />
            Rename
          </button>

          <div className="border-t border-[hsl(var(--border))]">
            <button
              type="button"
              role="menuitem"
              aria-expanded={colorOpen}
              onClick={() => setColorOpen((v) => !v)}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-left whitespace-nowrap hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer"
            >
              <Palette className="w-4 h-4 text-[hsl(var(--muted-foreground))] shrink-0" />
              Change color
            </button>
            {colorOpen && (
              <div className="flex flex-wrap gap-1.5 px-3 pb-3">
                <button
                  type="button"
                  title="No color"
                  aria-label="No color"
                  aria-pressed={currentColor === null}
                  onClick={() => {
                    onChangeColor(null);
                    onClose();
                  }}
                  className={cn(
                    "w-5 h-5 rounded-full shrink-0 border-2 border-dashed border-[hsl(var(--muted-foreground))] transition-transform cursor-pointer",
                    currentColor === null ? "scale-110" : "hover:scale-110 opacity-70 hover:opacity-100"
                  )}
                />
                {LIST_COLOR_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    title={key}
                    aria-label={`${key} color`}
                    aria-pressed={currentColor === key}
                    onClick={() => {
                      onChangeColor(key);
                      onClose();
                    }}
                    className={cn(
                      "w-5 h-5 rounded-full shrink-0 transition-transform cursor-pointer",
                      currentColor === key
                        ? "ring-2 ring-offset-2 ring-offset-[hsl(var(--background))] ring-[hsl(var(--foreground))] scale-110"
                        : "hover:scale-110 opacity-80 hover:opacity-100"
                    )}
                    style={{ backgroundColor: LIST_COLOR_SWATCH[key] }}
                  />
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={() => setConfirmingDelete(true)}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-left whitespace-nowrap text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer border-t border-[hsl(var(--border))]"
          >
            <Trash2 className="w-4 h-4 shrink-0" />
            Delete
          </button>
        </>
      )}
    </div>,
    document.body
  );
}
