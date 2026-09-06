import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  TASKS_LAYOUT_DEFAULTS,
  clampListsWidth,
  clampTasksWidth,
  parseTasksLayoutPreferenceRaw,
  tasksLayoutCookieName,
  writeTasksLayoutPreference,
  readTasksLayoutPreference,
} from "../../lib/tasks-layout-preference";

const USER_ID = "user-abc";

describe("tasks layout preference", () => {
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

  it("clamps lists width to allowed range", () => {
    assert.equal(clampListsWidth(0), 160);
    assert.equal(clampListsWidth(999), 400);
    assert.equal(clampListsWidth(240.6), 241);
  });

  it("clamps tasks width to allowed range", () => {
    assert.equal(clampTasksWidth(100), 280);
    assert.equal(clampTasksWidth(900), 900);
    assert.equal(clampTasksWidth(5000), 1600);
    assert.equal(
      clampTasksWidth(TASKS_LAYOUT_DEFAULTS.tasksWidth),
      TASKS_LAYOUT_DEFAULTS.tasksWidth
    );
  });

  it("tasksLayoutCookieName avoids colons", () => {
    assert.equal(
      tasksLayoutCookieName(USER_ID),
      `planitary_tasks_layout_${USER_ID}`
    );
    assert.ok(!tasksLayoutCookieName(USER_ID).includes(":"));
  });

  it("parseTasksLayoutPreferenceRaw reads clamped widths", () => {
    assert.deepEqual(
      parseTasksLayoutPreferenceRaw(
        JSON.stringify({ listsWidth: 300, tasksWidth: 600 })
      ),
      { listsWidth: 300, tasksWidth: 600 }
    );
    assert.deepEqual(
      parseTasksLayoutPreferenceRaw(
        JSON.stringify({ listsWidth: 10, tasksWidth: 9999 })
      ),
      { listsWidth: 160, tasksWidth: 1600 }
    );
  });

  it("parseTasksLayoutPreferenceRaw rejects invalid payloads", () => {
    assert.equal(parseTasksLayoutPreferenceRaw(null), null);
    assert.equal(parseTasksLayoutPreferenceRaw("{"), null);
    assert.equal(
      parseTasksLayoutPreferenceRaw(JSON.stringify({ listsWidth: "x" })),
      null
    );
  });

  it("writeTasksLayoutPreference mirrors into cookie", () => {
    writeTasksLayoutPreference(USER_ID, { listsWidth: 280, tasksWidth: 520 });
    assert.deepEqual(readTasksLayoutPreference(USER_ID), {
      listsWidth: 280,
      tasksWidth: 520,
    });
    assert.match(
      document.cookie,
      new RegExp(`planitary_tasks_layout_${USER_ID}=`)
    );
  });
});
