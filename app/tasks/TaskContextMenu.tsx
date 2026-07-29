"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, Trash2, FolderInput, Check, ChevronRight } from "lucide-react";
import { cn } from "@/utils/cn";
import type { Priority, TaskWithDetails } from "@/types";
import {
  TaskDatePicker,
  type DatePickerValue,
  type RepeatOption,
} from "./TaskDatePicker";
import { PriorityFlag, PRIORITY_OPTIONS } from "./priority-ui";
import type { MoveToListOption } from "@/app/calendar/AgendaItemContextMenu";

const MENU_WIDTH = 200;

function fitMenuPos(
  ax: number,
  ay: number,
  align: "start" | "end",
  height: number,
  anchorTop?: number
): { left: number; top: number } {
  const pad = 8;
  const gap = 4;
  let left = align === "end" ? ax - MENU_WIDTH : ax;
  left = Math.max(pad, Math.min(left, window.innerWidth - MENU_WIDTH - pad));
  let top = ay + gap;
  if (top + height > window.innerHeight - pad) {
    const flipFrom = anchorTop ?? ay;
    const above = flipFrom - height - gap;
    top = above >= pad ? above : Math.max(pad, window.innerHeight - height - pad);
  }
  return { left, top };
}

interface TaskContextMenuProps {
  x: number;
  y: number;
  /** `end` aligns the menu's right edge to `x` (e.g. under a ⋯ button). */
  align?: "start" | "end";
  /** Top of the trigger; used when flipping the menu above near the viewport bottom. */
  anchorTop?: number;
  task: TaskWithDetails;
  lists?: MoveToListOption[];
  onClose: () => void;
  onDelete: () => void;
  onSetPriority: (priority: Priority) => Promise<void>;
  onSetDue: (date: string | null, time: string | null) => Promise<void>;
  onMoveToList?: (listId: string | null) => void;
}

export function TaskContextMenu({
  x,
  y,
  align = "start",
  anchorTop,
  task,
  lists,
  onClose,
  onDelete,
  onSetPriority,
  onSetDue,
  onMoveToList,
}: TaskContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const dueBtnRef = useRef<HTMLButtonElement>(null);

  const [movingOpen, setMovingOpen] = useState(false);
  const [dueOpen, setDueOpen] = useState(false);
  const [dueAnchor, setDueAnchor] = useState<{ x: number; y: number } | null>(null);
  const [repeat, setRepeat] = useState<RepeatOption>("never");
  /** Local highlight so the flag row updates without closing the menu. */
  const [currentPriority, setCurrentPriority] = useState<Priority>(task.priority);
  const [pos, setPos] = useState(() => fitMenuPos(x, y, align, 280, anchorTop));

  const canMove = !!lists && !!onMoveToList;

  useEffect(() => {
    setCurrentPriority(task.priority);
  }, [task.priority]);

  useLayoutEffect(() => {
    const h = menuRef.current?.offsetHeight ?? 280;
    setPos(fitMenuPos(x, y, align, h, anchorTop));
  }, [x, y, align, anchorTop, movingOpen]);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      // Date picker portals its own panel; ignore clicks inside its dialog.
      const dueDialog = document.querySelector('[aria-label="Date and time picker"]');
      if (dueDialog?.contains(target)) return;
      // Time/repeat dropdowns portal outside the date picker panel.
      if ((e.target as Element | null)?.closest?.("[data-picker-select-list]")) return;
      onClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (dueOpen) {
          setDueOpen(false);
          setDueAnchor(null);
          return;
        }
        onClose();
      }
    }
    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose, dueOpen]);

  async function selectPriority(priority: Priority) {
    if (priority === currentPriority) return;
    const prev = currentPriority;
    setCurrentPriority(priority);
    try {
      await onSetPriority(priority);
    } catch {
      setCurrentPriority(prev);
    }
  }

  function openDue() {
    if (dueOpen) {
      setDueOpen(false);
      setDueAnchor(null);
      return;
    }
    const btn = dueBtnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setDueAnchor({ x: rect.right, y: rect.bottom });
    setDueOpen(true);
  }

  async function handleDueConfirm(value: DatePickerValue) {
    setRepeat(value.repeat);
    await onSetDue(
      value.date,
      value.date && value.time ? value.time : null
    );
    setDueOpen(false);
    setDueAnchor(null);
  }

  return (
    <>
      {createPortal(
        <div
          ref={menuRef}
          className="fixed z-50 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-xl overflow-hidden"
          style={{ left: pos.left, top: pos.top, width: MENU_WIDTH }}
          role="menu"
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <div className="px-3 pt-2.5 pb-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-1.5">
              Priority
            </p>
            <div className="flex items-center justify-between gap-1" role="group" aria-label="Priority">
              {PRIORITY_OPTIONS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  role="menuitem"
                  title={p.label}
                  aria-label={p.label}
                  aria-pressed={currentPriority === p.value}
                  onClick={() => void selectPriority(p.value)}
                  className={cn(
                    "flex-1 flex items-center justify-center p-2 rounded-lg transition-colors cursor-pointer",
                    currentPriority === p.value
                      ? "bg-[hsl(var(--muted))]"
                      : "hover:bg-[hsl(var(--muted))]"
                  )}
                >
                  <PriorityFlag priority={p.value} className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>

          <button
            ref={dueBtnRef}
            type="button"
            role="menuitem"
            aria-expanded={dueOpen}
            onClick={openDue}
            className={cn(
              "flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-left whitespace-nowrap border-t border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer",
              dueOpen && "bg-[hsl(var(--muted))]"
            )}
          >
            <CalendarDays className="w-4 h-4 text-[hsl(var(--muted-foreground))] shrink-0" />
            Due Date
          </button>

          {canMove && (
            <div className="border-t border-[hsl(var(--border))]">
              <button
                type="button"
                role="menuitem"
                aria-expanded={movingOpen}
                onClick={() => setMovingOpen((v) => !v)}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-left whitespace-nowrap hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer"
              >
                <FolderInput className="w-4 h-4 text-[hsl(var(--muted-foreground))] shrink-0" />
                Move to list
                <ChevronRight
                  className={cn(
                    "w-3.5 h-3.5 ml-auto text-[hsl(var(--muted-foreground))] transition-transform shrink-0",
                    movingOpen && "rotate-90"
                  )}
                />
              </button>
              {movingOpen && (
                <div className="max-h-40 overflow-y-auto border-t border-[hsl(var(--border))]">
                  {lists!.map((list) => (
                    <button
                      key={list.id ?? "inbox"}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onMoveToList!(list.id);
                        onClose();
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-left whitespace-nowrap hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer"
                    >
                      {list.color && (
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: list.color }}
                        />
                      )}
                      <span className="truncate">{list.name}</span>
                      {list.id === task.list_id && (
                        <Check className="w-3.5 h-3.5 ml-auto text-[hsl(var(--primary))] shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onDelete();
              onClose();
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-left whitespace-nowrap text-red-500 border-t border-[hsl(var(--border))] hover:bg-red-500/10 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4 shrink-0" />
            Delete Task
          </button>
        </div>,
        document.body
      )}

      {dueOpen && dueAnchor && (
        <TaskDatePicker
          initialDate={task.due_date}
          initialTime={task.due_time ? task.due_time.slice(0, 5) : null}
          initialRepeat={repeat}
          anchor={dueAnchor}
          anchorAlign="end"
          ignoreCloseRef={dueBtnRef}
          onConfirm={(v) => void handleDueConfirm(v)}
          onClose={() => {
            setDueOpen(false);
            setDueAnchor(null);
          }}
        />
      )}
    </>
  );
}
