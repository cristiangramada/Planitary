"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Inbox as InboxIcon, ListChecks, X } from "lucide-react";
import { cn } from "@/utils/cn";
import { ListContextMenu } from "./ListContextMenu";
import {
  LIST_COLOR_KEYS,
  LIST_COLOR_SWATCH,
  INBOX_COUNT_KEY,
  isListColorKey,
  type ListColorKey,
  type ListTaskCounts,
} from "@/lib/task-lists";
import type { TaskList } from "@/types";
import type { TasksScope } from "@/lib/tasks-url-state";

interface ListsPanelProps {
  scope: TasksScope;
  onSelectScope: (scope: TasksScope) => void;
  lists: TaskList[];
  counts: ListTaskCounts;
  onCreateList: (name: string, color: ListColorKey | null) => Promise<void>;
  onRenameList: (listId: string, name: string) => Promise<void>;
  onChangeListColor: (listId: string, color: ListColorKey | null) => Promise<void>;
  onDeleteList: (listId: string) => Promise<void>;
  /** Rendered on mobile as a close button for the slide-over. */
  onRequestClose?: () => void;
}

function scopeKey(scope: TasksScope): string {
  return scope.type === "list" ? `list:${scope.id}` : scope.type;
}

export function ListsPanel({
  scope,
  onSelectScope,
  lists,
  counts,
  onCreateList,
  onRenameList,
  onChangeListColor,
  onDeleteList,
  onRequestClose,
}: ListsPanelProps) {
  const [menu, setMenu] = useState<{ x: number; y: number; list: TaskList } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addColor, setAddColor] = useState<ListColorKey | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);
  const addFormRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus();
  }, [renamingId]);

  useEffect(() => {
    if (addOpen) addInputRef.current?.focus();
  }, [addOpen]);

  // Close the add-list popover on outside click.
  useEffect(() => {
    if (!addOpen) return;
    function onOutside(e: MouseEvent) {
      if (addFormRef.current && !addFormRef.current.contains(e.target as Node)) {
        setAddOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [addOpen]);

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
      await onCreateList(addName, addColor);
      setAddName("");
      setAddColor(null);
      setAddOpen(false);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Couldn't create the list.");
    } finally {
      setCreating(false);
    }
  }

  const activeScopeKey = scopeKey(scope);

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

      {/* Smart views */}
      <div className="mb-5">
        <p className="px-2 mb-1.5 text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
          Smart views
        </p>
        <nav className="space-y-0.5">
          <button
            type="button"
            onClick={() => onSelectScope({ type: "all" })}
            className={cn(
              "flex w-full items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-left transition-colors cursor-pointer",
              activeScopeKey === "all"
                ? "bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] font-medium"
                : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted)/0.6)] hover:text-[hsl(var(--foreground))]"
            )}
          >
            <ListChecks className="w-4 h-4 shrink-0" />
            All Tasks
          </button>
          <button
            type="button"
            onClick={() => onSelectScope({ type: "inbox" })}
            className={cn(
              "flex w-full items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-left transition-colors cursor-pointer",
              activeScopeKey === "inbox"
                ? "bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] font-medium"
                : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted)/0.6)] hover:text-[hsl(var(--foreground))]"
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
        <p className="px-2 mb-1.5 text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
          Lists
        </p>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-0.5">
          {lists.length === 0 && !addOpen && (
            <div className="px-2 py-3 text-xs text-[hsl(var(--muted-foreground))]">
              Create a list to organize related tasks.
            </div>
          )}

          {lists.map((list) => {
            const isActive = activeScopeKey === `list:${list.id}`;
            const swatch = list.color && isListColorKey(list.color) ? LIST_COLOR_SWATCH[list.color] : null;
            const count = counts[list.id] ?? 0;
            const isRenaming = renamingId === list.id;

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
              <div key={list.id} className="group relative flex items-center">
                <button
                  type="button"
                  onClick={() => onSelectScope({ type: "list", id: list.id })}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setMenu({ x: e.clientX, y: e.clientY, list });
                  }}
                  className={cn(
                    "flex flex-1 min-w-0 items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-left transition-colors cursor-pointer",
                    isActive
                      ? "bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] font-medium"
                      : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted)/0.6)] hover:text-[hsl(var(--foreground))]"
                  )}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: swatch ?? "hsl(var(--muted-foreground))" }}
                  />
                  <span className="truncate">{list.name}</span>
                  {count > 0 && (
                    <span className="ml-auto text-xs text-[hsl(var(--muted-foreground))] group-hover:hidden">
                      {count}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  aria-label={`More actions for ${list.name}`}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setMenu({ x: rect.right, y: rect.bottom, list });
                  }}
                  className="hidden group-hover:flex absolute right-1 items-center justify-center w-5 h-5 rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--border))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer"
                >
                  ⋮
                </button>
              </div>
            );
          })}
        </div>

        {addOpen && (
          <div
            ref={addFormRef}
            className="mt-2 p-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]"
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
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              <button
                type="button"
                title="No color"
                aria-label="No color"
                aria-pressed={addColor === null}
                onClick={() => setAddColor(null)}
                className={cn(
                  "w-5 h-5 rounded-full shrink-0 border-2 border-dashed border-[hsl(var(--muted-foreground))] transition-transform cursor-pointer",
                  addColor === null ? "scale-110" : "hover:scale-110 opacity-70 hover:opacity-100"
                )}
              />
              {LIST_COLOR_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  title={key}
                  aria-label={`${key} color`}
                  aria-pressed={addColor === key}
                  onClick={() => setAddColor(key)}
                  className={cn(
                    "w-5 h-5 rounded-full shrink-0 transition-transform cursor-pointer",
                    addColor === key
                      ? "ring-2 ring-offset-2 ring-offset-[hsl(var(--card))] ring-[hsl(var(--foreground))] scale-110"
                      : "hover:scale-110 opacity-80 hover:opacity-100"
                  )}
                  style={{ backgroundColor: LIST_COLOR_SWATCH[key] }}
                />
              ))}
            </div>
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
          </div>
        )}

        {!addOpen && (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 px-2 py-1.5 mt-0.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add list
          </button>
        )}
      </div>

      {menu && (
        <ListContextMenu
          x={menu.x}
          y={menu.y}
          listName={menu.list.name}
          currentColor={
            menu.list.color && isListColorKey(menu.list.color) ? menu.list.color : null
          }
          onRename={() => startRename(menu.list)}
          onChangeColor={(color) => void onChangeListColor(menu.list.id, color)}
          onDelete={() => void onDeleteList(menu.list.id)}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
