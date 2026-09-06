import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  parseTasksScope,
  buildTasksScopeParams,
  isPersistableTasksScope,
} from "@/lib/tasks-url-state";

const OWNED_ID = "11111111-1111-1111-1111-111111111111";
const FOREIGN_ID = "22222222-2222-2222-2222-222222222222";

describe("parseTasksScope", () => {
  test("defaults to Inbox with no params", () => {
    const scope = parseTasksScope(new URLSearchParams(""), new Set([OWNED_ID]));
    assert.deepEqual(scope, { type: "inbox" });
  });

  test("?view=inbox selects Inbox", () => {
    const scope = parseTasksScope(new URLSearchParams("view=inbox"), new Set());
    assert.deepEqual(scope, { type: "inbox" });
  });

  test("an unrecognized ?view value falls back to Inbox", () => {
    const scope = parseTasksScope(new URLSearchParams("view=today"), new Set());
    assert.deepEqual(scope, { type: "inbox" });
  });

  test("?list=<owned uuid> selects that List", () => {
    const scope = parseTasksScope(new URLSearchParams(`list=${OWNED_ID}`), new Set([OWNED_ID]));
    assert.deepEqual(scope, { type: "list", id: OWNED_ID });
  });

  test("a List id not owned by the user falls back to Inbox (no cross-user leak)", () => {
    const scope = parseTasksScope(new URLSearchParams(`list=${FOREIGN_ID}`), new Set([OWNED_ID]));
    assert.deepEqual(scope, { type: "inbox" });
  });

  test("a deleted List id (no longer owned) falls back to Inbox", () => {
    const scope = parseTasksScope(new URLSearchParams(`list=${OWNED_ID}`), new Set());
    assert.deepEqual(scope, { type: "inbox" });
  });

  test("a malformed (non-uuid) list id falls back to Inbox rather than throwing", () => {
    const scope = parseTasksScope(new URLSearchParams("list=not-a-uuid"), new Set([OWNED_ID]));
    assert.deepEqual(scope, { type: "inbox" });
  });

  test("'list' takes precedence over 'view' when both are present", () => {
    const scope = parseTasksScope(
      new URLSearchParams(`list=${OWNED_ID}&view=inbox`),
      new Set([OWNED_ID])
    );
    assert.deepEqual(scope, { type: "list", id: OWNED_ID });
  });
});

describe("buildTasksScopeParams", () => {
  test("'inbox' produces view=inbox", () => {
    const params = buildTasksScopeParams({ type: "inbox" });
    assert.equal(params.toString(), "view=inbox");
  });

  test("a List scope produces list=<id>", () => {
    const params = buildTasksScopeParams({ type: "list", id: OWNED_ID });
    assert.equal(params.toString(), `list=${OWNED_ID}`);
  });

  test("round-trips through parseTasksScope", () => {
    const scope = { type: "list", id: OWNED_ID } as const;
    const params = buildTasksScopeParams(scope);
    const parsed = parseTasksScope(params, new Set([OWNED_ID]));
    assert.deepEqual(parsed, scope);
  });
});

describe("isPersistableTasksScope", () => {
  test("allows an explicit Inbox URL", () => {
    assert.equal(
      isPersistableTasksScope(new URLSearchParams("view=inbox"), new Set()),
      true
    );
  });

  test("allows an owned List URL", () => {
    assert.equal(
      isPersistableTasksScope(
        new URLSearchParams(`list=${OWNED_ID}`),
        new Set([OWNED_ID])
      ),
      true
    );
  });

  test("rejects a foreign List URL so it cannot replace the saved preference", () => {
    assert.equal(
      isPersistableTasksScope(
        new URLSearchParams(`list=${FOREIGN_ID}`),
        new Set([OWNED_ID])
      ),
      false
    );
  });

  test("rejects an unrecognized view", () => {
    assert.equal(
      isPersistableTasksScope(new URLSearchParams("view=today"), new Set()),
      false
    );
  });
});
