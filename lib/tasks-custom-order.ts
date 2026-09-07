/**
 * Manual ("Custom") task ordering.
 *
 * A task lives in exactly one container — a List, or Inbox when `list_id` is
 * null — so a single nullable `custom_position` per task describes the user's
 * manual order everywhere that task can appear. Null means "never placed by
 * hand": those tasks sort after every positioned task, in creation order, so
 * an untouched container reads oldest-first and brand-new tasks land at the
 * bottom without any backfill.
 *
 * The Tasks page renders one container at a time, filtered by status tab, so
 * a drop inside a filtered subset is mapped back onto the container's full
 * order before positions are written — the tasks hidden by the current tab
 * keep their relative places.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { reorderIds } from "@/utils/reorder";

/** The fields Custom ordering reads. Keeps these helpers usable (and
 *  testable) without a full TaskWithDetails and its joined rows. */
export interface CustomOrderable {
  id: string;
  created_at: string;
  custom_position: number | null;
}

/**
 * Orders two tasks within a container. Unpositioned tasks come last, and
 * created_at then id break every remaining tie, so the result is a total
 * order that never shuffles between renders or requests.
 */
export function compareCustomOrder(a: CustomOrderable, b: CustomOrderable): number {
  const ap = a.custom_position;
  const bp = b.custom_position;
  if (ap !== null && bp !== null) {
    if (ap !== bp) return ap - bp;
  } else if (ap !== null) {
    return -1;
  } else if (bp !== null) {
    return 1;
  }
  const byCreated = a.created_at.localeCompare(b.created_at);
  if (byCreated !== 0) return byCreated;
  return a.id.localeCompare(b.id);
}

/** Sorts a container's tasks into Custom order. */
export function sortByCustomOrder<T extends CustomOrderable>(tasks: T[]): T[] {
  return [...tasks].sort(compareCustomOrder);
}

/**
 * Translates a drop inside the currently visible subset into the container's
 * full order. `containerIds` and `visibleIds` must both already be in Custom
 * order, and `visibleIds` must be a subset of `containerIds`. Returns null
 * when the drop leaves the visible order unchanged.
 */
export function reorderWithinContainer(
  containerIds: string[],
  visibleIds: string[],
  draggedId: string,
  insertAt: number
): string[] | null {
  // A drop that doesn't move the task among its visible neighbours is a no-op,
  // even when hidden tasks sit between them.
  if (!reorderIds(visibleIds, draggedId, insertAt)) return null;

  const anchorId =
    insertAt < visibleIds.length
      ? visibleIds[insertAt]
      : visibleIds[visibleIds.length - 1];
  if (anchorId === undefined) return null;

  const anchorIndex = containerIds.indexOf(anchorId);
  if (anchorIndex < 0) return null;

  return reorderIds(
    containerIds,
    draggedId,
    insertAt < visibleIds.length ? anchorIndex : anchorIndex + 1
  );
}

export interface CustomPositionUpdate {
  id: string;
  custom_position: number;
}

/**
 * Contiguous 0..n-1 positions for a container's new order, narrowed to the
 * rows whose stored value actually differs. A short drag therefore rewrites a
 * handful of rows instead of the whole container, and the first drag in a
 * never-reordered container backfills it in one pass.
 */
export function buildCustomPositionUpdates(
  orderedIds: string[],
  currentPositions: ReadonlyMap<string, number | null>
): CustomPositionUpdate[] {
  const updates: CustomPositionUpdate[] = [];
  orderedIds.forEach((id, position) => {
    if (currentPositions.get(id) !== position) {
      updates.push({ id, custom_position: position });
    }
  });
  return updates;
}

/** Writes new Custom positions. RLS scopes every row to the signed-in user. */
export async function persistCustomOrder(
  supabase: SupabaseClient,
  updates: CustomPositionUpdate[]
): Promise<void> {
  if (updates.length === 0) return;
  const results = await Promise.all(
    updates.map((u) =>
      supabase.from("tasks").update({ custom_position: u.custom_position }).eq("id", u.id)
    )
  );
  if (results.some((r) => r.error)) throw new Error("Couldn't save the task order.");
}
