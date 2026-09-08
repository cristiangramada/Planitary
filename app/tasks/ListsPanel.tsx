"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { Plus, Inbox as InboxIcon, X, Menu, MoreHorizontal } from "lucide-react";
import { cn } from "@/utils/cn";
import { ListContextMenu } from "./ListContextMenu";
import { ReorderDropLine } from "@/components/ui/ReorderDropLine";
import { usePointerReorder } from "@/hooks/usePointerReorder";
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

const ADD_POPOVER_WIDTH = 220;

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

  const listIds = useMemo(() => lists.map((l) => l.id), [lists]);
  const handleListDrop = useCallback(
    async ({ orderedIds }: { orderedIds: string[] }) => {
      await onReorderLists(orderedIds);
    },
    [onReorderLists]
  );
  // Pointer-based drag (avoids HTML5 DnD ghost + not-allowed cursor glitches).
  const reorder = usePointerReorder(listIds, handleListDrop);

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

  const activeScopeKey = scopeKey(scope);

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
          <div
            role="button"
            tabIndex={0}
            onClick={() => onSelectScope({ type: "inbox" })}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectScope({ type: "inbox" });
              }
            }}
            className={cn(
              "flex items-center rounded-lg transition-colors cursor-default text-[hsl(var(--foreground))]",
              activeScopeKey === "inbox"
                ? "bg-[hsl(var(--muted))]"
                : "hover:bg-[hsl(var(--muted)/0.6)]"
            )}
          >
            <span
              aria-hidden
              className="flex items-center justify-center pl-2 py-2.5 shrink-0 pointer-events-none"
            >
              <InboxIcon className="w-4 h-4" strokeWidth={2.25} />
            </span>
            <span className="flex flex-1 min-w-0 items-center pl-2 pr-2 py-2.5 text-sm text-left">
              <span className="truncate leading-snug">Inbox</span>
            </span>
            <div className="relative w-6 h-6 shrink-0 mr-1 flex items-center justify-center">
              {(counts[INBOX_COUNT_KEY] ?? 0) > 0 && (
                <span className="text-xs leading-none text-[hsl(var(--muted-foreground))] pointer-events-none">
                  {counts[INBOX_COUNT_KEY]}
                </span>
              )}
            </div>
          </div>
        </nav>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-5">
        {/* Lists */}
        <div className="flex flex-col min-h-0">
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
              "space-y-0.5",
              reorder.dragging && "select-none cursor-move [&_*]:!cursor-move"
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
              const isDragging = reorder.draggingId === list.id;

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
                  {reorder.showDropLineAt(index) && <ReorderDropLine />}
                  <div
                    ref={(el) => reorder.registerRow(list.id, el)}
                    onPointerDown={(e) => reorder.handlePointerDown(e, list.id)}
                    onClick={() => {
                      if (reorder.wasDragged()) return;
                      onSelectScope({ type: "list", id: list.id });
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setMenu({ x: e.clientX, y: e.clientY, list });
                    }}
                    className={cn(
                      "group flex items-center rounded-lg transition-colors text-[hsl(var(--foreground))]",
                      reorder.dragging ? "cursor-move" : "cursor-default",
                      isActive
                        ? "bg-[hsl(var(--muted))]"
                        : "hover:bg-[hsl(var(--muted)/0.6)]",
                      isDragging && "opacity-40"
                    )}
                  >
                    <span
                      aria-hidden
                      className="flex items-center justify-center pl-2 py-2.5 shrink-0 pointer-events-none"
                    >
                      <Menu className="w-[1.125rem] h-3.5 scale-x-125" strokeWidth={2.25} />
                    </span>
                    <span className="flex flex-1 min-w-0 items-center pl-2 pr-2 py-2.5 text-sm text-left">
                      <span className="truncate leading-snug">{list.name}</span>
                    </span>
                    <div className="relative w-6 h-6 shrink-0 mr-1 flex items-center justify-center">
                      {count > 0 && (
                        <span
                          className={cn(
                            "text-xs leading-none text-[hsl(var(--muted-foreground))] pointer-events-none",
                            menu?.list.id === list.id
                              ? "invisible"
                              : "group-hover:invisible"
                          )}
                        >
                          {count}
                        </span>
                      )}
                      <button
                        type="button"
                        data-no-drag
                        title="List actions"
                        aria-label={`More actions for ${list.name}`}
                        aria-haspopup="menu"
                        aria-expanded={menu?.list.id === list.id}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          setMenu({ x: rect.right, y: rect.bottom, list });
                        }}
                        className={cn(
                          "absolute inset-0 flex items-center justify-center p-1 rounded-md hover:bg-[hsl(var(--muted))] transition-opacity cursor-pointer",
                          menu?.list.id === list.id
                            ? "opacity-100"
                            : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                        )}
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {reorder.showDropLineAt(lists.length) && <ReorderDropLine />}
          </div>
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
