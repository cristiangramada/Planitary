"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, Trash2, FolderInput, Check, ChevronRight } from "lucide-react";
import { cn } from "@/utils/cn";

/** One selectable destination in the "Move to list" submenu. `id: null` is Inbox. */
export interface MoveToListOption {
  id: string | null;
  name: string;
  /** Swatch hex, if the list has a color. */
  color?: string | null;
}

interface AgendaItemContextMenuProps {
  x: number;
  y: number;
  kind: "task" | "event";
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
  /** Task-only: when provided, shows a "Move to list" section listing Inbox + these lists. */
  lists?: MoveToListOption[];
  /** Task-only: the task's current list id (null = Inbox), used to show a checkmark. */
  currentListId?: string | null;
  /** Task-only: called with the chosen list id (null = Inbox). */
  onMoveToList?: (listId: string | null) => void;
}

export function AgendaItemContextMenu({
  x,
  y,
  kind,
  onEdit,
  onDelete,
  onClose,
  lists,
  currentListId = null,
  onMoveToList,
}: AgendaItemContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [movingOpen, setMovingOpen] = useState(false);

  const canMove = kind === "task" && !!lists && !!onMoveToList;

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
  const menuWidth = canMove ? 176 : kind === "event" ? 148 : 138;
  const left = Math.min(x, window.innerWidth - menuWidth - 8);
  const top = Math.min(y, window.innerHeight - (canMove && movingOpen ? 280 : 120));

  // Portal out of card stacking contexts (e.g. completed tasks use opacity,
  // which would otherwise trap this menu under the next sibling card).
  return createPortal(
    <div
      ref={ref}
      className="fixed z-50 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-xl overflow-hidden w-max"
      style={{ left, top, width: canMove ? menuWidth : undefined }}
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

          {canMove && (
            <div className="border-t border-[hsl(var(--border))]">
              <button
                type="button"
                role="menuitem"
                aria-expanded={movingOpen}
                onClick={() => setMovingOpen((v) => !v)}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-left whitespace-nowrap hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer"
              >
                <FolderInput className="w-4 h-4 text-[hsl(var(--muted-foreground))] shrink-0" />
                Move to list
                <ChevronRight
                  className={cn(
                    "w-3.5 h-3.5 ml-auto text-[hsl(var(--muted-foreground))] transition-transform shrink-0",
                    movingOpen && "rotate-90"
                  )}
                />
              </button>
              {movingOpen && (
                <div className="max-h-40 overflow-y-auto border-t border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)] py-1">
                  {lists!.map((list) => (
                    <button
                      key={list.id ?? "inbox"}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onMoveToList!(list.id);
                        onClose();
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-left whitespace-nowrap hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer"
                    >
                      {list.color && (
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: list.color }}
                        />
                      )}
                      <span className="truncate">{list.name}</span>
                      {list.id === currentListId && (
                        <Check className="w-3.5 h-3.5 ml-auto text-[hsl(var(--primary))] shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            role="menuitem"
            onClick={() => setConfirmingDelete(true)}
            className={cn(
              "flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-left whitespace-nowrap text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer",
              canMove && "border-t border-[hsl(var(--border))]"
            )}
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
