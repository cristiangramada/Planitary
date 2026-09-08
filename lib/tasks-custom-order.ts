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
 *
 * "Unpositioned sorts last" only places *new* tasks correctly, since a new
 * task is always the newest row. A task arriving from another container
 * brings an older created_at with it, so it needs a real position — see
 * `buildAppendToContainerUpdates`.
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

/**
 * Positions for tasks arriving in a container — a move between Lists, or the
 * tasks a deleted List leaves behind in Inbox. The destination keeps its
 * current manual order and the arrivals go on the end, in their own relative
 * order.
 *
 * The destination's unpositioned tasks are materialised in the same pass.
 * That is what makes "at the bottom" expressible at all: while those tasks
 * are still resolved by age, an arrival older than them would sort above
 * them no matter what position it were given.
 */
export function buildAppendToContainerUpdates(
  destinationTasks: CustomOrderable[],
  arriving: CustomOrderable[]
): CustomPositionUpdate[] {
  const orderedIds = [
    ...sortByCustomOrder(destinationTasks).map((t) => t.id),
    ...sortByCustomOrder(arriving).map((t) => t.id),
  ];
  return buildCustomPositionUpdates(
    orderedIds,
    new Map([...destinationTasks, ...arriving].map((t) => [t.id, t.custom_position]))
  );
}

/**
 * Writes new Custom positions in a single statement, so an overlapping drag
 * or a mid-batch failure can't leave a container half-reordered. RLS plus the
 * function's own auth.uid() predicate scope every row to the signed-in user.
 *
 * `listId` is the container the plan was computed for — null for Inbox. Rows
 * that have since left it are skipped, so a plan built from a stale view
 * can't write a task a position belonging to a container it isn't in.
 */
export async function persistCustomOrder(
  supabase: SupabaseClient,
  updates: CustomPositionUpdate[],
  listId: string | null
): Promise<void> {
  if (updates.length === 0) return;
  const { error } = await supabase.rpc("set_task_custom_positions", {
    p_task_ids: updates.map((u) => u.id),
    p_positions: updates.map((u) => u.custom_position),
    p_list_id: listId,
  });
  if (error) throw new Error("Couldn't save the task order.");
}

/**
 * Deletes a List and re-orders the tasks it leaves behind in Inbox as one
 * transaction. Two round trips would let the delete commit while the ordering
 * write fails, leaving Inbox with two independently numbered groups.
 */
export async function deleteTaskListWithOrder(
  supabase: SupabaseClient,
  listId: string,
  updates: CustomPositionUpdate[]
): Promise<void> {
  const { error } = await supabase.rpc("delete_task_list_with_order", {
    p_list_id: listId,
    p_task_ids: updates.map((u) => u.id),
    p_positions: updates.map((u) => u.custom_position),
  });
  if (error) throw new Error("Couldn't delete the list.");
}

/**
 * Re-reads one container's stored order. Serves two callers: converging on
 * server state after a failed order write, and building an append plan from
 * what the database actually holds rather than from a local snapshot an
 * earlier queued write may already have invalidated.
 */
export async function fetchContainerOrder(
  supabase: SupabaseClient,
  listId: string | null
): Promise<CustomOrderable[]> {
  const select = supabase.from("tasks").select("id, created_at, custom_position");
  const { data, error } = await (listId === null
    ? select.is("list_id", null)
    : select.eq("list_id", listId));
  if (error) throw new Error("Couldn't reload the task order.");
  return (data as CustomOrderable[]) ?? [];
}

export interface TaskPlacement {
  list_id: string | null;
  custom_position: number | null;
}

/**
 * Re-reads which container a task ended up in. A move that commits and then
 * fails on the way back would otherwise be undone locally but not in the
 * database, and re-reading positions alone can't detect that — the row is no
 * longer in the container the client thinks it left. Null means the task is
 * gone.
 */
export async function fetchTaskPlacement(
  supabase: SupabaseClient,
  taskId: string
): Promise<TaskPlacement | null> {
  const { data, error } = await supabase
    .from("tasks")
    .select("list_id, custom_position")
    .eq("id", taskId)
    .maybeSingle();
  if (error) throw new Error("Couldn't reload the task.");
  return (data as TaskPlacement | null) ?? null;
}
