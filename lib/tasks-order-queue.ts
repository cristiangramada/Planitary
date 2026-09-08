/**
 * Serializes Custom-order writes per container (a List, or Inbox).
 *
 * Two problems this solves, both reachable when a second drop happens while
 * the first is still in flight:
 *
 *   * Out-of-order commits. Each drop's plan is computed from the optimistic
 *     state the previous drop produced, so the writes only compose if they
 *     land in the order they were issued.
 *
 *   * Plans built on writes that never landed. Positions are written as a
 *     diff, so a later drop omits rows that already hold their target value
 *     locally. If an earlier write failed, those rows never actually reached
 *     the database, and the later write can't repair them — the container
 *     ends up holding values from two different plans.
 *
 * So a failure anywhere in a burst is remembered, and once the container's
 * queue drains the caller is asked to reconcile it against stored state.
 * Reconciling after the burst (rather than rolling back inside the failing
 * write) is what keeps a stale rollback from clobbering a newer drop.
 */

export interface OrderWriteQueue {
  /**
   * Queues a write behind any other writes touching `containerKeys`. Never
   * rejects: `onError` reports a failed write so the caller can undo whatever
   * the reconcile pass won't cover, and the returned promise resolves once
   * this write — and any reconciliation it triggers — has settled.
   *
   * A write that spans containers (moving a task between them, or deleting a
   * List into Inbox) passes every container it touches. It then waits for all
   * of their chains at once rather than acquiring them one at a time, so two
   * writes with overlapping — but not identical — containers can't hold half
   * of what the other is waiting for.
   */
  enqueue(
    containerKeys: string | string[],
    write: () => Promise<void>,
    onError?: (error: unknown) => void | Promise<void>
  ): Promise<void>;
}

interface ContainerQueue {
  chain: Promise<void>;
  /** Writes queued but not yet settled. Zero means the burst is over. */
  pending: number;
  /** Whether any write in the current burst failed. */
  failed: boolean;
}

/**
 * @param reconcile Re-reads a container's stored order and applies it to
 *   local state. Called at most once per burst, and only after a failure.
 */
export function createOrderWriteQueue(
  reconcile: (containerKey: string) => Promise<void>
): OrderWriteQueue {
  const queues = new Map<string, ContainerQueue>();

  function queueFor(containerKey: string): ContainerQueue {
    let queue = queues.get(containerKey);
    if (!queue) {
      queue = { chain: Promise.resolve(), pending: 0, failed: false };
      queues.set(containerKey, queue);
    }
    return queue;
  }

  function enqueue(
    containerKeys: string | string[],
    write: () => Promise<void>,
    onError?: (error: unknown) => void | Promise<void>
  ): Promise<void> {
    const keys = [
      ...new Set(typeof containerKeys === "string" ? [containerKeys] : containerKeys),
    ];
    const containers = keys.map(queueFor);

    for (const container of containers) container.pending += 1;

    const next = Promise.all(containers.map((c) => c.chain)).then(async () => {
      try {
        await write();
      } catch (error) {
        for (const container of containers) container.failed = true;
        try {
          await onError?.(error);
        } catch {
          // A failure to report must not strand the queue: `pending` would
          // never drain and the container could never reconcile again.
        }
      }

      for (const [index, container] of containers.entries()) {
        container.pending -= 1;
        if (container.pending > 0 || !container.failed) continue;

        container.failed = false;
        try {
          await reconcile(keys[index]);
        } catch {
          // Best-effort: the next page load reads stored order anyway, and the
          // failing write has already reported itself through onError.
        }
      }
    });

    for (const container of containers) container.chain = next;

    return next;
  }

  return { enqueue };
}
