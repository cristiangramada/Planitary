"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, Trash2 } from "lucide-react";

interface AgendaItemContextMenuProps {
  x: number;
  y: number;
  kind: "task" | "event";
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function AgendaItemContextMenu({
  x,
  y,
  kind,
  onEdit,
  onDelete,
  onClose,
}: AgendaItemContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
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

  const noun = kind === "task" ? "task" : "event";
  // Sized to the wider "Delete …" label so Edit matches that width with even side padding
  const menuWidth = kind === "event" ? 148 : 138;
  const left = Math.min(x, window.innerWidth - menuWidth - 8);
  const top = Math.min(y, window.innerHeight - 120);

  // Portal out of card stacking contexts (e.g. completed tasks use opacity,
  // which would otherwise trap this menu under the next sibling card).
  return createPortal(
    <div
      ref={ref}
      className="fixed z-50 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-xl overflow-hidden w-max"
      style={{ left, top }}
      role="menu"
    >
      {confirmingDelete ? (
        <div className="p-3 min-w-[138px]">
          <p className="text-sm font-medium mb-3">Delete this {noun}?</p>
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
              Delete
            </button>
          </div>
        </div>
      ) : (
        <>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onEdit();
              onClose();
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-left whitespace-nowrap hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer"
          >
            <Pencil className="w-4 h-4 text-[hsl(var(--muted-foreground))] shrink-0" />
            Edit {noun}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => setConfirmingDelete(true)}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-left whitespace-nowrap text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4 shrink-0" />
            Delete {noun}
          </button>
        </>
      )}
    </div>,
    document.body
  );
}
