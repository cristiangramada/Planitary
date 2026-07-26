"use client";

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { Plus, Inbox as InboxIcon, X, Menu } from "lucide-react";
import { cn } from "@/utils/cn";
import { ListContextMenu } from "./ListContextMenu";
import { INBOX_COUNT_KEY, type ListTaskCounts } from "@/lib/task-lists";
import type { TaskList } from "@/types";
import type { TasksScope } from "@/lib/tasks-url-state";

interface ListsPanelProps {
  scope: TasksScope;
  onSelectScope: (scope: TasksScope) => void;
  lists: TaskList[];
  counts: ListTaskCounts;
  onCreateList: (name: string) => Promise<void>;
  onRenameList: (listId: string, name: string) => Promise<void>;
  onDeleteList: (listId: string) => Promise<void>;
  onReorderLists: (orderedIds: string[]) => Promise<void>;
  /** Rendered on mobile as a close button for the slide-over. */
  onRequestClose?: () => void;
}

function scopeKey(scope: TasksScope): string {
  return scope.type === "list" ? `list:${scope.id}` : scope.type;
}

/** Moves `fromId` so it lands at insertion index `insertAt` (0..n) in the
 *  original array, then returns the new id order. */
function reorderIds(ids: string[], fromId: string, insertAt: number): string[] | null {
  const from = ids.indexOf(fromId);
  if (from < 0) return null;
  const next = [...ids];
  next.splice(from, 1);
  const adjusted = insertAt > from ? insertAt - 1 : insertAt;
  if (adjusted === from) return null;
  next.splice(adjusted, 0, fromId);
  return next;
}

const ADD_POPOVER_WIDTH = 220;
const DRAG_THRESHOLD_PX = 5;

interface PendingDrag {
  listId: string;
  pointerId: number;
  startY: number;
  active: boolean;
}

export function ListsPanel({
  scope,
  onSelectScope,
  lists,
  counts,
  onCreateList,
  onRenameList,
  onDeleteList,
  onReorderLists,
  onRequestClose,
}: ListsPanelProps) {
  const [menu, setMenu] = useState<{ x: number; y: number; list: TaskList } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addPos, setAddPos] = useState<{ x: number; y: number } | null>(null);
  const [addName, setAddName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);
  const addFormRef = useRef<HTMLDivElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  /** Insertion index among current lists (0 = before first, n = after last). */
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const pendingDragRef = useRef<PendingDrag | null>(null);
  const didDragRef = useRef(false);
  const rowElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const listsRef = useRef(lists);
  listsRef.current = lists;
  const dropIndexRef = useRef(dropIndex);
  dropIndexRef.current = dropIndex;

  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus();
  }, [renamingId]);

  useEffect(() => {
    if (addOpen) addInputRef.current?.focus();
  }, [addOpen]);

  // Close the add-list popover on outside click or Escape.
  useEffect(() => {
    if (!addOpen) return;
    function onOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (addFormRef.current?.contains(target)) return;
      if (addButtonRef.current?.contains(target)) return;
      setAddOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAddOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      window.removeEventListener("keydown", onKey);
    };
  }, [addOpen]);

  // Pointer-based drag (avoids HTML5 DnD ghost + not-allowed cursor glitches).
  useEffect(() => {
    function dropIndexFromY(clientY: number): number {
      const current = listsRef.current;
      for (let i = 0; i < current.length; i++) {
        const el = rowElsRef.current.get(current[i].id);
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
        setDraggingId(pending.listId);
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
      const listId = pending.listId;
      const insertAt = dropIndexRef.current;
      pendingDragRef.current = null;
      document.documentElement.style.removeProperty("cursor");
      document.body.style.removeProperty("cursor");

      setDraggingId(null);
      setDropIndex(null);

      if (!wasActive || insertAt === null) {
        window.setTimeout(() => {
          didDragRef.current = false;
        }, 0);
        return;
      }

      const ordered = reorderIds(
        listsRef.current.map((l) => l.id),
        listId,
        insertAt
      );
      window.setTimeout(() => {
        didDragRef.current = false;
      }, 0);
      if (!ordered) return;
      try {
        await onReorderLists(ordered);
      } catch {
        // Parent surfaces errors; local order reverts via its handler.
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
  }, [onReorderLists]);

  function openAddPopover(e: ReactMouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const left = Math.min(rect.left, window.innerWidth - ADD_POPOVER_WIDTH - 8);
    const top = Math.min(rect.bottom + 4, window.innerHeight - 160);
    setAddPos({ x: Math.max(8, left), y: Math.max(8, top) });
    setAddError(null);
    setAddOpen(true);
  }

  function startRename(list: TaskList) {
    setRenamingId(list.id);
    setRenameValue(list.name);
    setRenameError(null);
  }

  async function commitRename(list: TaskList) {
    if (renaming) return;
    const value = renameValue.trim();
    if (value === list.name) {
      setRenamingId(null);
      return;
    }
    setRenaming(true);
    setRenameError(null);
    try {
      await onRenameList(list.id, value);
      setRenamingId(null);
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : "Couldn't rename the list.");
    } finally {
      setRenaming(false);
    }
  }

  async function submitCreate() {
    if (creating) return;
    setCreating(true);
    setAddError(null);
    try {
      await onCreateList(addName);
      setAddName("");
      setAddOpen(false);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Couldn't create the list.");
    } finally {
      setCreating(false);
    }
  }

  function handleRowPointerDown(e: ReactPointerEvent, listId: string) {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
    didDragRef.current = false;
    pendingDragRef.current = {
      listId,
      pointerId: e.pointerId,
      startY: e.clientY,
      active: false,
    };
  }

  const activeScopeKey = scopeKey(scope);
  const draggingFromIndex = draggingId
    ? lists.findIndex((l) => l.id === draggingId)
    : -1;

  /** Hide the indicator when it would mean "leave this list where it already is". */
  function showDropLineAt(at: number): boolean {
    if (dropIndex !== at || draggingFromIndex < 0) return false;
    return at !== draggingFromIndex && at !== draggingFromIndex + 1;
  }

  const dropLine = (
    <div
      className="mx-2 h-0.5 rounded-full bg-[hsl(var(--primary))] shrink-0"
      aria-hidden
    />
  );

  const addPopover =
    addOpen &&
    addPos &&
    createPortal(
      <div
        ref={addFormRef}
        className="fixed z-50 p-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-xl"
        style={{ left: addPos.x, top: addPos.y, width: ADD_POPOVER_WIDTH }}
      >
        <label htmlFor="new-list-name" className="sr-only">
          List name
        </label>
        <input
          id="new-list-name"
          ref={addInputRef}
          value={addName}
          onChange={(e) => setAddName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submitCreate();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setAddOpen(false);
            }
          }}
          maxLength={50}
          placeholder="List name"
          disabled={creating}
          className="w-full px-2.5 py-1.5 text-sm rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none disabled:opacity-60"
        />
        {addError && <p className="text-xs text-red-500 mt-2">{addError}</p>}
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            onClick={() => setAddOpen(false)}
            className="flex-1 py-1.5 text-xs font-medium rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={creating || addName.trim().length === 0}
            onClick={() => void submitCreate()}
            className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity cursor-pointer"
          >
            {creating ? "Adding…" : "Add list"}
          </button>
        </div>
      </div>,
      document.body
    );

  return (
    <div className="flex flex-col h-full">
      {onRequestClose && (
        <div className="flex items-center justify-between px-1 pb-3 lg:hidden">
          <h2 className="text-sm font-semibold">Tasks navigation</h2>
          <button
            type="button"
            onClick={onRequestClose}
            aria-label="Close lists panel"
            className="p-1.5 rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="mb-5">
        <nav className="space-y-0.5">
          <button
            type="button"
            onClick={() => onSelectScope({ type: "inbox" })}
            className={cn(
              "flex w-full items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-left transition-colors cursor-pointer text-[hsl(var(--foreground))]",
              activeScopeKey === "inbox"
                ? "bg-[hsl(var(--muted))] font-medium"
                : "hover:bg-[hsl(var(--muted)/0.6)]"
            )}
          >
            <InboxIcon className="w-4 h-4 shrink-0" />
            Inbox
            {(counts[INBOX_COUNT_KEY] ?? 0) > 0 && (
              <span className="ml-auto text-xs text-[hsl(var(--muted-foreground))]">
                {counts[INBOX_COUNT_KEY]}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Lists */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="group flex items-center mb-1.5">
          <p className="flex-1 min-w-0 px-2 text-xs font-medium text-[hsl(var(--muted-foreground))]">
            Lists
          </p>
          <div className="w-6 h-6 shrink-0 mr-1 flex items-center justify-center">
            <button
              ref={addButtonRef}
              type="button"
              aria-label="Add list"
              aria-expanded={addOpen}
              onClick={openAddPopover}
              className={cn(
                "flex items-center justify-center w-6 h-6 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer",
                addOpen
                  ? "opacity-100 text-[hsl(var(--foreground))]"
                  : "opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
              )}
            >
              <Plus className="w-4 h-4" strokeWidth={2.25} />
            </button>
          </div>
        </div>

        <div
          className={cn(
            "flex-1 min-h-0 overflow-y-auto space-y-0.5",
            draggingId && "select-none cursor-move [&_*]:!cursor-move"
          )}
        >
          {lists.length === 0 && !addOpen && (
            <div className="px-2 py-3 text-xs text-[hsl(var(--muted-foreground))]">
              Create a list to organize related tasks.
            </div>
          )}

          {lists.map((list, index) => {
            const isActive = activeScopeKey === `list:${list.id}`;
            const count = counts[list.id] ?? 0;
            const isRenaming = renamingId === list.id;
            const isDragging = draggingId === list.id;

            if (isRenaming) {
              return (
                <div key={list.id} className="px-2 py-0.5">
                  <input
                    ref={renameInputRef}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void commitRename(list);
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        setRenamingId(null);
                        setRenameError(null);
                      }
                    }}
                    onBlur={() => void commitRename(list)}
                    aria-label={`Rename list ${list.name}`}
                    maxLength={50}
                    disabled={renaming}
                    className="w-full px-2 py-1 text-sm rounded-md border border-[hsl(var(--primary))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] focus:outline-none disabled:opacity-60"
                  />
                  {renameError && (
                    <p className="text-xs text-red-500 mt-1 px-0.5">{renameError}</p>
                  )}
                </div>
              );
            }

            return (
              <div key={list.id}>
                {showDropLineAt(index) && dropLine}
                <div
                  ref={(el) => {
                    if (el) rowElsRef.current.set(list.id, el);
                    else rowElsRef.current.delete(list.id);
                  }}
                  onPointerDown={(e) => handleRowPointerDown(e, list.id)}
                  onClick={() => {
                    if (didDragRef.current) return;
                    onSelectScope({ type: "list", id: list.id });
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setMenu({ x: e.clientX, y: e.clientY, list });
                  }}
                  className={cn(
                    "group flex items-center rounded-lg transition-colors",
                    draggingId ? "cursor-move" : "cursor-pointer",
                    isActive
                      ? "bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]"
                      : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted)/0.6)] hover:text-[hsl(var(--foreground))]",
                    isDragging && "opacity-40"
                  )}
                >
                  <span
                    aria-hidden
                    className="flex items-center justify-center pl-2 py-2.5 text-[hsl(var(--muted-foreground))] shrink-0 pointer-events-none"
                  >
                    <Menu className="w-[1.125rem] h-3.5 scale-x-125" strokeWidth={2.25} />
                  </span>
                  <span
                    className={cn(
                      "flex flex-1 min-w-0 items-center pl-2 pr-2 py-2.5 text-sm text-left",
                      isActive && "font-medium"
                    )}
                  >
                    <span className="truncate leading-none">{list.name}</span>
                  </span>
                  <div className="relative w-6 h-6 shrink-0 mr-1 flex items-center justify-center">
                    {count > 0 && (
                      <span className="text-xs leading-none text-[hsl(var(--muted-foreground))] group-hover:invisible pointer-events-none">
                        {count}
                      </span>
                    )}
                    <button
                      type="button"
                      data-no-drag
                      aria-label={`More actions for ${list.name}`}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        setMenu({ x: rect.right, y: rect.bottom, list });
                      }}
                      className="hidden group-hover:flex absolute inset-0 items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer"
                    >
                      ⋮
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {showDropLineAt(lists.length) && dropLine}
        </div>
      </div>

      {addPopover}

      {menu && (
        <ListContextMenu
          x={menu.x}
          y={menu.y}
          listName={menu.list.name}
          onRename={() => startRename(menu.list)}
          onDelete={() => void onDeleteList(menu.list.id)}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
