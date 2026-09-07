"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { reorderIds, shouldStartPointerDrag } from "@/utils/reorder";

const DRAG_THRESHOLD_PX = 5;

export interface PointerReorderDrop {
  /** The dragged item. */
  draggedId: string;
  /** Insertion index among the pre-drag ids (0 = before first, n = after last). */
  insertAt: number;
  /** The pre-drag ids rearranged, for callers that only need the final order. */
  orderedIds: string[];
}

export interface PointerReorder {
  /** The item currently being dragged, or null when idle. */
  draggingId: string | null;
  /** True while any item in this group is being dragged. */
  dragging: boolean;
  /** Registers a row element for midpoint hit-testing. */
  registerRow: (itemId: string, el: HTMLElement | null) => void;
  /** Attach to each row's `onPointerDown`. */
  handlePointerDown: (e: ReactPointerEvent, itemId: string) => void;
  /** Whether the insertion line belongs immediately above item index `at`. */
  showDropLineAt: (at: number) => boolean;
  /** True for the click that immediately follows a drag, so it can be ignored. */
  wasDragged: () => boolean;
}

interface PendingDrag {
  itemId: string;
  pointerId: number;
  startY: number;
  active: boolean;
}

/**
 * Pointer-based vertical reorder for a stack of rows, shared by the Lists
 * panel and by Tasks under the Custom sort so both feel identical: a 5px
 * threshold before a press counts as a drag, a `move` cursor forced onto the
 * whole document while dragging, and an insertion index derived from row
 * midpoints. Deliberately not HTML5 drag-and-drop, which brings a ghost image
 * and `not-allowed` cursor glitches.
 *
 * Rows opt sub-elements out of dragging by marking them `data-no-drag`.
 */
export function usePointerReorder(
  itemIds: string[],
  onDrop: (drop: PointerReorderDrop) => void | Promise<void>,
  enabled = true
): PointerReorder {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  /** Insertion index among current items (0 = before first, n = after last). */
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const pendingDragRef = useRef<PendingDrag | null>(null);
  const didDragRef = useRef(false);
  const rowElsRef = useRef<Map<string, HTMLElement>>(new Map());
  const itemIdsRef = useRef(itemIds);
  const dropIndexRef = useRef(dropIndex);
  const onDropRef = useRef(onDrop);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    itemIdsRef.current = itemIds;
  }, [itemIds]);

  useEffect(() => {
    dropIndexRef.current = dropIndex;
  }, [dropIndex]);

  useEffect(() => {
    onDropRef.current = onDrop;
  }, [onDrop]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    function dropIndexFromY(clientY: number): number {
      const current = itemIdsRef.current;
      for (let i = 0; i < current.length; i++) {
        const el = rowElsRef.current.get(current[i]);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (clientY < rect.top + rect.height / 2) return i;
      }
      return current.length;
    }

    function onPointerMove(e: PointerEvent) {
      const pending = pendingDragRef.current;
      if (!pending || e.pointerId !== pending.pointerId) return;

      if (!pending.active) {
        if (Math.abs(e.clientY - pending.startY) < DRAG_THRESHOLD_PX) return;
        pending.active = true;
        didDragRef.current = true;
        setDraggingId(pending.itemId);
        document.documentElement.style.setProperty("cursor", "move", "important");
        document.body.style.setProperty("cursor", "move", "important");
      }

      e.preventDefault();
      setDropIndex(dropIndexFromY(e.clientY));
    }

    async function finishDrag(e: PointerEvent) {
      const pending = pendingDragRef.current;
      if (!pending || e.pointerId !== pending.pointerId) return;

      const wasActive = pending.active;
      const itemId = pending.itemId;
      const insertAt = dropIndexRef.current;
      pendingDragRef.current = null;
      document.documentElement.style.removeProperty("cursor");
      document.body.style.removeProperty("cursor");

      setDraggingId(null);
      setDropIndex(null);

      // Cleared a tick later so the click that closes this drag still sees it.
      const clearDidDrag = () => {
        window.setTimeout(() => {
          didDragRef.current = false;
        }, 0);
      };

      if (!wasActive || insertAt === null) {
        clearDidDrag();
        return;
      }

      const orderedIds = reorderIds(itemIdsRef.current, itemId, insertAt);
      clearDidDrag();
      if (!orderedIds) return;
      try {
        await onDropRef.current({ draggedId: itemId, insertAt, orderedIds });
      } catch {
        // Callers surface their own errors and revert their own state.
      }
    }

    function onPointerUp(e: PointerEvent) {
      void finishDrag(e);
    }

    function onPointerCancel(e: PointerEvent) {
      void finishDrag(e);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      document.documentElement.style.removeProperty("cursor");
      document.body.style.removeProperty("cursor");
    };
  }, []);

  const registerRow = useCallback((itemId: string, el: HTMLElement | null) => {
    if (el) rowElsRef.current.set(itemId, el);
    else rowElsRef.current.delete(itemId);
  }, []);

  const handlePointerDown = useCallback((e: ReactPointerEvent, itemId: string) => {
    if (!shouldStartPointerDrag(enabledRef.current, e.button, e.target as HTMLElement)) {
      return;
    }
    didDragRef.current = false;
    pendingDragRef.current = {
      itemId,
      pointerId: e.pointerId,
      startY: e.clientY,
      active: false,
    };
  }, []);

  const wasDragged = useCallback(() => didDragRef.current, []);

  const draggingFromIndex = draggingId ? itemIds.indexOf(draggingId) : -1;

  /** Hides the indicator when it would mean "leave this item where it is". */
  const showDropLineAt = useCallback(
    (at: number) => {
      if (dropIndex !== at || draggingFromIndex < 0) return false;
      return at !== draggingFromIndex && at !== draggingFromIndex + 1;
    },
    [dropIndex, draggingFromIndex]
  );

  return {
    draggingId,
    dragging: draggingId !== null,
    registerRow,
    handlePointerDown,
    showDropLineAt,
    wasDragged,
  };
}
