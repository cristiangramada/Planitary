import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createOrderWriteQueue } from "@/lib/tasks-order-queue";

const INBOX = "inbox";
const LIST = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: unknown) => void;
}

function deferred(): Deferred {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Lets queued microtasks drain so ordering assertions see settled state. */
async function flush(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

describe("order write queue", () => {
  it("runs a container's writes in the order they were enqueued", async () => {
    const log: string[] = [];
    const queue = createOrderWriteQueue(async () => {});

    const first = deferred();
    const second = deferred();

    const a = queue.enqueue(INBOX, async () => {
      log.push("a:start");
      await first.promise;
      log.push("a:end");
    });
    const b = queue.enqueue(INBOX, async () => {
      log.push("b:start");
      await second.promise;
      log.push("b:end");
    });

    await flush();
    // The second write must not have begun while the first is in flight.
    assert.deepEqual(log, ["a:start"]);

    first.resolve();
    await flush();
    assert.deepEqual(log, ["a:start", "a:end", "b:start"]);

    second.resolve();
    await Promise.all([a, b]);
    assert.deepEqual(log, ["a:start", "a:end", "b:start", "b:end"]);
  });

  it("does not reconcile when every write succeeds", async () => {
    const reconciled: string[] = [];
    const queue = createOrderWriteQueue(async (key) => {
      reconciled.push(key);
    });

    await queue.enqueue(INBOX, async () => {});
    await queue.enqueue(INBOX, async () => {});

    assert.deepEqual(reconciled, []);
  });

  it("reconciles once after a lone failure", async () => {
    const reconciled: string[] = [];
    const errors: unknown[] = [];
    const queue = createOrderWriteQueue(async (key) => {
      reconciled.push(key);
    });

    await queue.enqueue(
      INBOX,
      async () => {
        throw new Error("write failed");
      },
      (error) => {
        errors.push(error);
      }
    );

    assert.deepEqual(reconciled, [INBOX]);
    assert.equal(errors.length, 1);
    assert.equal((errors[0] as Error).message, "write failed");
  });

  it("reconciles once at the end of a burst, not per failure", async () => {
    const reconciled: string[] = [];
    const queue = createOrderWriteQueue(async (key) => {
      reconciled.push(key);
    });

    const gate = deferred();
    const a = queue.enqueue(INBOX, async () => {
      await gate.promise;
      throw new Error("first failed");
    });
    const b = queue.enqueue(INBOX, async () => {
      throw new Error("second failed");
    });

    gate.resolve();
    await Promise.all([a, b]);

    assert.deepEqual(reconciled, [INBOX]);
  });

  it("still reconciles when a later write succeeds after an earlier failure", async () => {
    // The case a rollback can't fix: the successful write only carried a diff,
    // so rows the failed write owned were never persisted by either.
    const reconciled: string[] = [];
    const queue = createOrderWriteQueue(async (key) => {
      reconciled.push(key);
    });

    const gate = deferred();
    const a = queue.enqueue(INBOX, async () => {
      await gate.promise;
      throw new Error("first failed");
    });
    const b = queue.enqueue(INBOX, async () => {});

    gate.resolve();
    await Promise.all([a, b]);

    assert.deepEqual(reconciled, [INBOX]);
  });

  it("keeps running later writes after one fails", async () => {
    const log: string[] = [];
    const queue = createOrderWriteQueue(async () => {
      log.push("reconcile");
    });

    const a = queue.enqueue(INBOX, async () => {
      log.push("a");
      throw new Error("boom");
    });
    const b = queue.enqueue(INBOX, async () => {
      log.push("b");
    });

    await Promise.all([a, b]);
    assert.deepEqual(log, ["a", "b", "reconcile"]);
  });

  it("never rejects, so a failed write can't surface as an unhandled rejection", async () => {
    const queue = createOrderWriteQueue(async () => {});
    await assert.doesNotReject(
      queue.enqueue(INBOX, async () => {
        throw new Error("boom");
      })
    );
  });

  it("swallows a failed reconcile", async () => {
    const queue = createOrderWriteQueue(async () => {
      throw new Error("reload failed");
    });
    await assert.doesNotReject(
      queue.enqueue(INBOX, async () => {
        throw new Error("boom");
      })
    );
  });

  it("keeps containers independent", async () => {
    const reconciled: string[] = [];
    const log: string[] = [];
    const queue = createOrderWriteQueue(async (key) => {
      reconciled.push(key);
    });

    const blocked = deferred();
    const inbox = queue.enqueue(INBOX, async () => {
      await blocked.promise;
      log.push("inbox");
      throw new Error("boom");
    });
    const list = queue.enqueue(LIST, async () => {
      log.push("list");
    });

    await flush();
    // A stalled Inbox write must not hold up a different container.
    assert.deepEqual(log, ["list"]);

    blocked.resolve();
    await Promise.all([inbox, list]);

    assert.deepEqual(log, ["list", "inbox"]);
    assert.deepEqual(reconciled, [INBOX]);
  });

  it("starts a fresh burst after reconciling", async () => {
    const reconciled: string[] = [];
    const queue = createOrderWriteQueue(async (key) => {
      reconciled.push(key);
    });

    await queue.enqueue(INBOX, async () => {
      throw new Error("boom");
    });
    assert.deepEqual(reconciled, [INBOX]);

    // A later, clean burst must not inherit the earlier failure.
    await queue.enqueue(INBOX, async () => {});
    assert.deepEqual(reconciled, [INBOX]);
  });
});

describe("order write queue, writes spanning containers", () => {
  it("waits for every container it names", async () => {
    const log: string[] = [];
    const queue = createOrderWriteQueue(async () => {});

    const gate = deferred();
    const blocking = queue.enqueue(LIST, async () => {
      await gate.promise;
      log.push("drag in list");
    });
    const move = queue.enqueue([INBOX, LIST], async () => {
      log.push("move");
    });

    await flush();
    assert.deepEqual(log, []);

    gate.resolve();
    await Promise.all([blocking, move]);
    assert.deepEqual(log, ["drag in list", "move"]);
  });

  it("holds later writes on any container it named", async () => {
    const log: string[] = [];
    const queue = createOrderWriteQueue(async () => {});

    const gate = deferred();
    const move = queue.enqueue([INBOX, LIST], async () => {
      await gate.promise;
      log.push("move");
    });
    const drag = queue.enqueue(INBOX, async () => {
      log.push("drag in inbox");
    });

    await flush();
    assert.deepEqual(log, []);

    gate.resolve();
    await Promise.all([move, drag]);
    assert.deepEqual(log, ["move", "drag in inbox"]);
  });

  it("serializes repeated moves of one task through their shared container", async () => {
    // A second move's source is always the first move's destination, so
    // naming both ends is what keeps the database's last writer agreeing
    // with the optimistic UI.
    const log: string[] = [];
    const queue = createOrderWriteQueue(async () => {});

    const gate = deferred();
    const toList = queue.enqueue([INBOX, LIST], async () => {
      await gate.promise;
      log.push("inbox -> list");
    });
    const toOther = queue.enqueue([LIST, OTHER], async () => {
      log.push("list -> other");
    });

    await flush();
    assert.deepEqual(log, []);

    gate.resolve();
    await Promise.all([toList, toOther]);
    assert.deepEqual(log, ["inbox -> list", "list -> other"]);
  });

  it("still runs writes on containers it did not name", async () => {
    const log: string[] = [];
    const queue = createOrderWriteQueue(async () => {});

    const gate = deferred();
    const move = queue.enqueue([INBOX, LIST], async () => {
      await gate.promise;
      log.push("move");
    });
    const elsewhere = queue.enqueue(OTHER, async () => {
      log.push("drag elsewhere");
    });

    await flush();
    assert.deepEqual(log, ["drag elsewhere"]);

    gate.resolve();
    await Promise.all([move, elsewhere]);
    assert.deepEqual(log, ["drag elsewhere", "move"]);
  });

  it("reconciles every container a failed write touched", async () => {
    const reconciled: string[] = [];
    const queue = createOrderWriteQueue(async (key) => {
      reconciled.push(key);
    });

    await queue.enqueue([INBOX, LIST], async () => {
      throw new Error("boom");
    });

    assert.deepEqual(reconciled.slice().sort(), [INBOX, LIST].sort());
  });

  it("finishes onError before reconciling", async () => {
    // The move path re-reads the task's container in onError; reconciling
    // first would apply positions around a membership it hasn't corrected.
    const log: string[] = [];
    const queue = createOrderWriteQueue(async () => {
      log.push("reconcile");
    });

    await queue.enqueue(
      INBOX,
      async () => {
        throw new Error("boom");
      },
      async () => {
        await Promise.resolve();
        log.push("onError");
      }
    );

    assert.deepEqual(log, ["onError", "reconcile"]);
  });

  it("counts a repeated container once", async () => {
    // Moving between filtered views of one container would otherwise leave
    // `pending` above zero forever, and reconciliation would never fire.
    const reconciled: string[] = [];
    const queue = createOrderWriteQueue(async (key) => {
      reconciled.push(key);
    });

    await queue.enqueue([INBOX, INBOX], async () => {
      throw new Error("boom");
    });

    assert.deepEqual(reconciled, [INBOX]);
  });
});
