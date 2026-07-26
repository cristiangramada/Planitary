"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { Plus, Trash2, Tag as TagIcon } from "lucide-react";
import { cn } from "@/utils/cn";
import { TagBadge } from "@/components/ui/TagBadge";
import type { Tag } from "@/types";
import type { TagFormItem } from "@/lib/tasks";
import { PLANET_TAG_COLORS } from "@/lib/tasks";

// ---------------------------------------------------------------------------
// Tag picker sub-component
// ---------------------------------------------------------------------------

export interface TagPickerProps {
  allTags: Tag[];
  selected: TagFormItem[];
  onChange: (tags: TagFormItem[]) => void;
  onDeleteTag?: (tagId: string) => Promise<void>;
}

function tagKey(tag: TagFormItem): string {
  return tag.id ?? `session:${tag.name.toLowerCase()}`;
}

export function TagPicker({ allTags, selected, onChange, onDeleteTag }: TagPickerProps) {
  const [input, setInput] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [newTagColor, setNewTagColor] = useState<string>(PLANET_TAG_COLORS[2].color);
  /** Tags created this session (not yet in allTags until the task is saved). */
  const [sessionTags, setSessionTags] = useState<TagFormItem[]>([]);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [confirmPos, setConfirmPos] = useState<{ top: number; left: number } | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputWrapRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  const deleteBtnRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const knownTags = useMemo(() => {
    const byName = new Map<string, TagFormItem>();
    for (const t of allTags) {
      byName.set(t.name.toLowerCase(), { id: t.id, name: t.name, color: t.color });
    }
    for (const t of sessionTags) {
      const key = t.name.toLowerCase();
      if (!byName.has(key)) byName.set(key, t);
    }
    return Array.from(byName.values());
  }, [allTags, sessionTags]);

  const trimmedInput = input.trim();
  const canCreate =
    trimmedInput.length > 0 &&
    !knownTags.some((t) => t.name.toLowerCase() === trimmedInput.toLowerCase());

  const filtered = knownTags.filter((t) =>
    t.name.toLowerCase().includes(input.toLowerCase())
  );
  const confirmingTag = confirmingDeleteId
    ? knownTags.find((t) => tagKey(t) === confirmingDeleteId) ?? null
    : null;

  const closeConfirm = useCallback(() => {
    setConfirmingDeleteId(null);
    setConfirmPos(null);
  }, []);

  const updateDropdownPos = useCallback(() => {
    if (!inputWrapRef.current) return;
    const r = inputWrapRef.current.getBoundingClientRect();
    setDropdownPos({ top: r.bottom + 4, left: r.left, width: r.width });
  }, []);

  const openDropdown = useCallback(() => {
    updateDropdownPos();
    setShowDropdown(true);
  }, [updateDropdownPos]);

  const closeDropdown = useCallback(() => {
    setShowDropdown(false);
    setDropdownPos(null);
  }, []);

  const openConfirm = useCallback((key: string, btn: HTMLButtonElement) => {
    const r = btn.getBoundingClientRect();
    const width = 224;
    const height = 110;
    let top = r.bottom + 8;
    if (top + height > window.innerHeight - 8) {
      top = Math.max(8, r.top - height - 8);
    }
    let left = r.right - width;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    setConfirmPos({ top, left });
    setConfirmingDeleteId(key);
  }, []);

  const addTag = useCallback(
    (tag: TagFormItem) => {
      if (!selected.some((s) => (s.id && s.id === tag.id) || s.name === tag.name)) {
        onChange([...selected, tag]);
      }
      setInput("");
      closeDropdown();
      setNewTagColor(PLANET_TAG_COLORS[2].color);
      closeConfirm();
    },
    [selected, onChange, closeConfirm, closeDropdown]
  );

  const createNewTag = useCallback(() => {
    if (!canCreate) return;
    const tag: TagFormItem = { name: trimmedInput, color: newTagColor };
    setSessionTags((prev) =>
      prev.some((t) => t.name.toLowerCase() === tag.name.toLowerCase())
        ? prev
        : [...prev, tag]
    );
    addTag(tag);
  }, [canCreate, trimmedInput, newTagColor, addTag]);

  const removeTag = useCallback(
    (name: string) => onChange(selected.filter((t) => t.name !== name)),
    [selected, onChange]
  );

  const confirmDeleteTag = useCallback(
    async (tag: TagFormItem) => {
      const key = tagKey(tag);
      if (deletingId) return;
      setDeletingId(key);
      try {
        if (tag.id) {
          if (!onDeleteTag) return;
          await onDeleteTag(tag.id);
        }
        onChange(
          selected.filter((t) =>
            tag.id
              ? t.id !== tag.id
              : t.name.toLowerCase() !== tag.name.toLowerCase()
          )
        );
        setSessionTags((prev) =>
          prev.filter((t) => t.name.toLowerCase() !== tag.name.toLowerCase())
        );
        closeConfirm();
      } finally {
        setDeletingId(null);
      }
    },
    [onDeleteTag, deletingId, selected, onChange, closeConfirm]
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && trimmedInput) {
      e.preventDefault();
      const existing = knownTags.find(
        (t) => t.name.toLowerCase() === trimmedInput.toLowerCase()
      );
      if (existing) {
        addTag({ id: existing.id, name: existing.name, color: existing.color });
      } else {
        createNewTag();
      }
    }
    if (e.key === "Escape") {
      if (confirmingDeleteId) {
        closeConfirm();
      } else {
        closeDropdown();
      }
    }
  }

  // Close dropdown on outside click (ignore while delete confirm is open)
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (confirmingDeleteId) return;
      if (wrapRef.current?.contains(e.target as Node)) return;
      if (dropdownRef.current?.contains(e.target as Node)) return;
      closeDropdown();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [confirmingDeleteId, closeDropdown]);

  // Keep dropdown anchored while open; close if layout scrolls away awkwardly
  useEffect(() => {
    if (!showDropdown) return;
    function onScroll(e: Event) {
      if (dropdownRef.current?.contains(e.target as Node)) return;
      updateDropdownPos();
    }
    function onResize() {
      updateDropdownPos();
    }
    window.addEventListener("scroll", onScroll, { capture: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", onResize);
    };
  }, [showDropdown, updateDropdownPos]);

  // Re-anchor when selected tags change (badges above the input shift its position)
  useEffect(() => {
    if (!showDropdown) return;
    const id = requestAnimationFrame(() => updateDropdownPos());
    return () => cancelAnimationFrame(id);
  }, [selected, showDropdown, updateDropdownPos]);
  // Close confirm on outside click, Escape, or scroll
  useEffect(() => {
    if (!confirmingDeleteId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeConfirm();
      }
    }
    function onOutside(e: MouseEvent) {
      if (confirmRef.current?.contains(e.target as Node)) return;
      const btn = confirmingDeleteId
        ? deleteBtnRefs.current.get(confirmingDeleteId)
        : null;
      if (btn?.contains(e.target as Node)) return;
      closeConfirm();
    }
    function onScroll(e: Event) {
      if (confirmRef.current?.contains(e.target as Node)) return;
      closeConfirm();
    }
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("mousedown", onOutside);
    window.addEventListener("scroll", onScroll, { capture: true });
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("mousedown", onOutside);
      window.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, [confirmingDeleteId, closeConfirm]);

  return (
    <div className="space-y-2" ref={wrapRef}>
      {/* Selected tags */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((tag) => (
            <TagBadge
              key={tag.name}
              tag={tag}
              onRemove={() => removeTag(tag.name)}
            />
          ))}
        </div>
      )}

      {/* Input + dropdown */}
      <div className="relative">
        <div
          ref={inputWrapRef}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] focus-within:ring-2 focus-within:ring-[hsl(var(--primary))] transition"
        >
          <TagIcon className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              openDropdown();
              closeConfirm();
            }}
            onFocus={() => openDropdown()}
            onClick={() => openDropdown()}
            onKeyDown={handleKeyDown}
            placeholder="Type in a tag"
            className="flex-1 text-xs bg-transparent outline-none text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
          />
        </div>

        {showDropdown &&
          dropdownPos &&
          (filtered.length > 0 || canCreate) &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              ref={dropdownRef}
              style={{
                position: "fixed",
                top: dropdownPos.top,
                left: dropdownPos.left,
                width: dropdownPos.width,
                zIndex: 9998,
              }}
              className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-lg overflow-hidden"
            >
              {filtered.map((tag) => {
                const key = tagKey(tag);
                return (
                  <div
                    key={key}
                    className="relative flex items-center gap-1 px-1 hover:bg-[hsl(var(--muted))] transition-colors"
                  >
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        addTag({ id: tag.id, name: tag.name, color: tag.color });
                      }}
                      className="flex items-center gap-2 flex-1 min-w-0 px-2 py-1.5 text-xs text-left cursor-pointer"
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{
                          backgroundColor:
                            tag.color ?? "hsl(var(--muted-foreground))",
                        }}
                      />
                      <span className="truncate">{tag.name}</span>
                    </button>
                    <button
                      ref={(el) => {
                        if (el) deleteBtnRefs.current.set(key, el);
                        else deleteBtnRefs.current.delete(key);
                      }}
                      type="button"
                      disabled={deletingId === key}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (confirmingDeleteId === key) {
                          closeConfirm();
                        } else {
                          openConfirm(key, e.currentTarget);
                        }
                      }}
                      className={cn(
                        "shrink-0 p-1.5 rounded-md transition-colors cursor-pointer disabled:opacity-50",
                        confirmingDeleteId === key
                          ? "bg-red-500/10 text-red-500"
                          : "text-[hsl(var(--muted-foreground))] hover:text-red-500 hover:bg-red-500/10"
                      )}
                      aria-label={`Delete tag ${tag.name}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
              {canCreate && (
                <div className={cn("pt-1.5 pb-1 px-3", filtered.length > 0 && "mt-0")}>
                  <div className="flex items-center justify-between gap-1">
                    {PLANET_TAG_COLORS.map(({ planet, color }) => (
                      <button
                        key={planet}
                        type="button"
                        title={planet}
                        aria-label={`${planet} color`}
                        aria-pressed={newTagColor === color}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setNewTagColor(color);
                        }}
                        className={cn(
                          "w-5 h-5 rounded-full shrink-0 transition-transform cursor-pointer",
                          newTagColor === color
                            ? "ring-2 ring-offset-2 ring-offset-[hsl(var(--card))] ring-[hsl(var(--foreground))] scale-110"
                            : "hover:scale-110 opacity-80 hover:opacity-100"
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      createNewTag();
                    }}
                    className="flex items-center gap-2 w-full mt-3 py-1 text-xs text-[hsl(var(--primary))] hover:opacity-80 transition-opacity text-left cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    Create &ldquo;{trimmedInput}&rdquo;
                  </button>
                </div>
              )}
            </div>,
            document.body
          )}
      </div>

      {confirmingTag &&
        confirmPos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={confirmRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-tag-title"
            style={{
              position: "fixed",
              top: confirmPos.top,
              left: confirmPos.left,
              zIndex: 9999,
            }}
            className="w-56 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-xl p-3"
          >
            <p id="delete-tag-title" className="text-sm font-medium mb-1">
              Delete tag &ldquo;{confirmingTag.name}&rdquo;?
            </p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3">
              {confirmingTag.id
                ? "It will be removed from all tasks."
                : "It hasn’t been saved yet and will be discarded."}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  closeConfirm();
                }}
                className="flex-1 py-1.5 text-xs font-medium rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingId === tagKey(confirmingTag)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  void confirmDeleteTag(confirmingTag);
                }}
                className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-60 transition-colors cursor-pointer"
              >
                {deletingId === tagKey(confirmingTag) ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

