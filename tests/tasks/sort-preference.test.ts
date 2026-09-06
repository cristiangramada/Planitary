import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  parseTasksSortPreferenceRaw,
  tasksSortCookieName,
  writeTasksSortPreference,
  readTasksSortPreference,
} from "../../lib/tasks-sort-preference";

const USER_ID = "user-abc";

describe("tasks sort preference", () => {
  const originalLocalStorage = globalThis.localStorage;
  const originalDocument = globalThis.document;
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
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: originalDocument,
    });
  });

  it("tasksSortCookieName avoids colons", () => {
    assert.equal(tasksSortCookieName(USER_ID), `planitary_tasks_sort_${USER_ID}`);
    assert.ok(!tasksSortCookieName(USER_ID).includes(":"));
  });

  it("parseTasksSortPreferenceRaw accepts known keys", () => {
    assert.equal(parseTasksSortPreferenceRaw("due_date"), "due_date");
    assert.equal(parseTasksSortPreferenceRaw("priority"), "priority");
    assert.equal(parseTasksSortPreferenceRaw("created_oldest"), "created_oldest");
  });

  it("parseTasksSortPreferenceRaw rejects invalid values", () => {
    assert.equal(parseTasksSortPreferenceRaw(null), null);
    assert.equal(parseTasksSortPreferenceRaw(""), null);
    assert.equal(parseTasksSortPreferenceRaw("bogus"), null);
  });

  it("writeTasksSortPreference mirrors into cookie", () => {
    writeTasksSortPreference(USER_ID, "due_date");
    assert.equal(readTasksSortPreference(USER_ID), "due_date");
    assert.match(
      document.cookie,
      new RegExp(`planitary_tasks_sort_${USER_ID}=due_date`)
    );
  });
});
