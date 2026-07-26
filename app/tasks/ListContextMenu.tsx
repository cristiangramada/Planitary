"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, Trash2 } from "lucide-react";

interface ListContextMenuProps {
  x: number;
  y: number;
  listName: string;
  onRename: () => void;
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
  onRename,
  onDelete,
  onClose,
}: ListContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

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
  const top = Math.min(y, window.innerHeight - 120);

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
