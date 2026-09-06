import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  parseTasksScopePreferenceRaw,
  tasksScopeToHref,
  tasksScopeCookieName,
  peekTasksScopeHref,
  writeTasksScopePreference,
} from "../../lib/tasks-scope-preference";

const OWNED_ID = "11111111-1111-1111-1111-111111111111";
const USER_ID = "user-abc";

describe("tasks scope preference", () => {
  const originalLocalStorage = globalThis.localStorage;
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
        removeItem: (k: string) => {
          store.delete(k);
        },
        clear: () => store.clear(),
        key: (i: number) => [...store.keys()][i] ?? null,
        get length() {
          return store.size;
        },
      },
    });
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { cookie: "" },
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: originalLocalStorage,
    });
  });

  test("parseTasksScopePreferenceRaw reads inbox", () => {
    assert.deepEqual(
      parseTasksScopePreferenceRaw(JSON.stringify({ type: "inbox" })),
      { type: "inbox" }
    );
  });

  test("parseTasksScopePreferenceRaw reads list when owned", () => {
    assert.deepEqual(
      parseTasksScopePreferenceRaw(JSON.stringify({ type: "list", id: OWNED_ID }), new Set([OWNED_ID])),
      { type: "list", id: OWNED_ID }
    );
  });

  test("parseTasksScopePreferenceRaw rejects unowned list when set given", () => {
    assert.equal(
      parseTasksScopePreferenceRaw(
        JSON.stringify({ type: "list", id: OWNED_ID }),
        new Set()
      ),
      null
    );
  });

  test("tasksScopeToHref builds query", () => {
    assert.equal(tasksScopeToHref({ type: "inbox" }), "/tasks?view=inbox");
    assert.equal(
      tasksScopeToHref({ type: "list", id: OWNED_ID }),
      `/tasks?list=${OWNED_ID}`
    );
  });

  test("tasksScopeCookieName avoids colons", () => {
    assert.equal(tasksScopeCookieName(USER_ID), `planitary_tasks_scope_${USER_ID}`);
    assert.ok(!tasksScopeCookieName(USER_ID).includes(":"));
  });

  test("writeTasksScopePreference updates last href for sidebar", () => {
    writeTasksScopePreference(USER_ID, { type: "list", id: OWNED_ID });
    assert.equal(peekTasksScopeHref(USER_ID), `/tasks?list=${OWNED_ID}`);
  });

  test("peekTasksScopeHref migrates the current user's scope key", () => {
    store.set(
      `planitary:tasks-scope:${USER_ID}`,
      JSON.stringify({ type: "list", id: OWNED_ID })
    );
    assert.equal(peekTasksScopeHref(USER_ID), `/tasks?list=${OWNED_ID}`);
  });

  test("peekTasksScopeHref never reads another user's last list", () => {
    writeTasksScopePreference("user-a", { type: "list", id: OWNED_ID });

    assert.equal(peekTasksScopeHref("user-b"), "/tasks");
  });
});
