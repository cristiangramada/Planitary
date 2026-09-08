/** Pure helpers behind the pointer-drag reorder used by Lists and Tasks. */

/**
 * Moves `fromId` so it lands at insertion index `insertAt` (0..n) in the
 * original array, then returns the new id order. Null when the move is a
 * no-op (the item is already in that slot).
 */
export function reorderIds(
  ids: string[],
  fromId: string,
  insertAt: number
): string[] | null {
  const from = ids.indexOf(fromId);
  if (from < 0) return null;
  const next = [...ids];
  next.splice(from, 1);
  const adjusted = insertAt > from ? insertAt - 1 : insertAt;
  if (adjusted === from) return null;
  next.splice(adjusted, 0, fromId);
  return next;
}

/** The bit of an event target the drag gate needs. */
export interface DragEventTarget {
  closest(selector: string): unknown;
}

/**
 * Whether a pointer-down may begin a drag. Only the primary button counts
 * (right-click still opens context menus), reordering has to be switched on
 * for this list, and presses inside a `data-no-drag` control — the completion
 * circle, the actions menu, an inline title input — are left alone.
 */
export function shouldStartPointerDrag(
  enabled: boolean,
  button: number,
  target: DragEventTarget | null
): boolean {
  if (!enabled) return false;
  if (button !== 0) return false;
  return !target?.closest("[data-no-drag]");
}
