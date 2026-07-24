"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, Copy, RotateCw, X, Check, ChevronDown } from "lucide-react";
import { MiniCalendarPicker } from "@/components/ui/MiniCalendarPicker";
import { cn } from "@/utils/cn";
import { localTodayStr } from "@/utils/date";
import { defaultStandupRange, validateStandupRange } from "@/lib/standup";
import {
  clearStandupSession,
  readStandupSession,
  writeStandupSession,
} from "@/lib/standup-session";
import type {
  GenerateStandupRequest,
  GenerateStandupResponse,
  GenerateStandupError,
} from "@/app/api/ai/standup/route";

// ─────────────────────────────────────────────────────────────────────────────
// Standup — generates a copy-ready weekly update from journal entries in a
// selected date range. All AI calls happen server-side via /api/ai/standup;
// this component only sends the date range and renders the (editable) result.
//
// Draft text + open/closed are kept in localStorage. Expanded is restored
// only after mount so server/client HTML stay in sync.
// ─────────────────────────────────────────────────────────────────────────────

type GenerationStatus = "idle" | "loading" | "success" | "empty" | "error";

interface StandupSectionProps {
  /** When true, forces the section open regardless of the saved localStorage state — used by the /journal?section=standup deep link from the Dashboard. */
  autoExpand?: boolean;
}

export function StandupSection({ autoExpand = false }: StandupSectionProps) {
  const todayStr = localTodayStr();
  const defaults = defaultStandupRange(todayStr);

  const [startDate, setStartDate] = useState<string>(defaults.startDate);
  const [endDate, setEndDate] = useState<string>(defaults.endDate);
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [hasGeneratedOnce, setHasGeneratedOnce] = useState(false);
  const [ready, setReady] = useState(false);
  // Always start collapsed on first paint (matches SSR); restore after mount.
  const [expanded, setExpanded] = useState(false);

  const activeRequest = useRef<AbortController | null>(null);
  const copyFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userToggledExpand = useRef(false);

  // Restore draft after mount so server/client first paint stay identical.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- hydrate draft from localStorage after mount */
    const saved = readStandupSession();
    if (saved) {
      setStartDate(saved.startDate);
      setEndDate(saved.endDate);
      setOutput(saved.output);
      setStatus(saved.status);
      setStatusMessage(saved.statusMessage);
      setHasGeneratedOnce(saved.hasGeneratedOnce);
      // Don't overwrite a click that happened before this effect ran.
      if (!userToggledExpand.current) {
        setExpanded(saved.expanded);
      }
    }
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Deep-link override: always wins over the restored/saved expand state.
  useEffect(() => {
    if (!autoExpand) return;
    /* eslint-disable react-hooks/set-state-in-effect -- open the section in response to a /journal?section=standup deep link */
    userToggledExpand.current = true;
    setExpanded(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [autoExpand]);

  useEffect(() => {
    return () => {
      activeRequest.current?.abort();
      if (copyFeedbackTimer.current) clearTimeout(copyFeedbackTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!ready || status === "loading") return;
    writeStandupSession({
      startDate,
      endDate,
      output,
      status,
      statusMessage,
      hasGeneratedOnce,
      expanded,
    });
  }, [ready, startDate, endDate, output, status, statusMessage, hasGeneratedOnce, expanded]);

  const range = validateStandupRange(startDate, endDate);

  // Changing the date range invalidates any previously generated text —
  // never let the user copy a summary that no longer matches the selected range.
  function handleStartDateChange(value: string | null) {
    if (!value) return;
    setStartDate(value);
    // Keep the range valid if start moves past the current end.
    if (value > endDate) setEndDate(value);
    clearResultIfPresent();
  }
  function handleEndDateChange(value: string | null) {
    if (!value) return;
    setEndDate(value);
    clearResultIfPresent();
  }
  function clearResultIfPresent() {
    // Cancel any in-flight request for the previous range so a slow response
    // can never land after the user has already moved on to a new range.
    activeRequest.current?.abort();
    if (output || status !== "idle") {
      setOutput("");
      setStatus("idle");
      setStatusMessage(null);
      setHasGeneratedOnce(false);
    }
  }

  const generate = useCallback(async () => {
    if (status === "loading") return; // only one active generation at a time
    const currentRange = validateStandupRange(startDate, endDate);
    if (!currentRange.valid) {
      setStatus("error");
      setStatusMessage(currentRange.error);
      return;
    }

    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;

    setStatus("loading");
    setStatusMessage(null);

    try {
      const requestBody: GenerateStandupRequest = { startDate, endDate };
      const res = await fetch("/api/ai/standup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as GenerateStandupError | null;
        setStatus("error");
        setStatusMessage(err?.message ?? "Something went wrong generating the standup.");
        return;
      }

      const data = (await res.json()) as GenerateStandupResponse;

      if (data.entryCount === 0) {
        setStatus("empty");
        setStatusMessage("No journal entries were found for this date range.");
        setOutput("");
        return;
      }

      setOutput(data.text);
      setHasGeneratedOnce(true);
      setStatus("success");
      setStatusMessage(
        data.truncated
          ? "Some journal content was omitted because the selected range was too large."
          : null
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setStatus("error");
      setStatusMessage("Couldn't reach the server. Please check your connection and try again.");
    }
  }, [startDate, endDate, status]);

  async function handleCopy() {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopyFeedback(true);
      if (copyFeedbackTimer.current) clearTimeout(copyFeedbackTimer.current);
      copyFeedbackTimer.current = setTimeout(() => setCopyFeedback(false), 2000);
    } catch {
      setStatus("error");
      setStatusMessage("Couldn't copy to clipboard. Please copy the text manually.");
    }
  }

  function handleClear() {
    clearStandupSession();
    setOutput("");
    setStatus("idle");
    setStatusMessage(null);
    setHasGeneratedOnce(false);
  }

  const isLoading = status === "loading";
  const canGenerate = range.valid && !isLoading;
  const showOutput = Boolean(output || isLoading);
  const fillRemaining = expanded && showOutput;

  return (
    <section
      id="standup-section"
      aria-labelledby="standup-heading"
      className={cn(
        "mt-6 pt-5 border-t border-[hsl(var(--border))]",
        fillRemaining ? "flex-1 min-h-0 flex flex-col" : "shrink-0"
      )}
    >
      <button
        type="button"
        onClick={() => {
          userToggledExpand.current = true;
          setExpanded((v) => !v);
        }}
        aria-expanded={expanded}
        aria-controls="standup-panel"
        className="w-full flex items-center gap-2 text-left rounded-lg px-3 py-2 hover:bg-[hsl(var(--muted)/0.5)] transition-colors cursor-pointer shrink-0"
      >
        <Sparkles className="w-4 h-4 text-[hsl(var(--primary))] shrink-0" />
        <span
          id="standup-heading"
          className="text-sm font-semibold text-[hsl(var(--foreground))]"
        >
          Standup
        </span>
        <ChevronDown
          className={cn(
            "ml-auto w-4 h-4 text-[hsl(var(--muted-foreground))] shrink-0 transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>

      {expanded && (
        <div
          id="standup-panel"
          className={cn("mt-3", fillRemaining && "flex-1 min-h-0 flex flex-col")}
        >
          {/* ── Date range controls ── */}
          <div className="flex flex-wrap items-end gap-3 mb-2 shrink-0">
            <div className="w-40">
              <label
                htmlFor="standup-start-date"
                className="block text-[11px] font-medium text-[hsl(var(--muted-foreground))] mb-1"
              >
                Start date
              </label>
              <MiniCalendarPicker value={startDate} onChange={handleStartDateChange} />
              {/* Accessible id target for the label; the picker renders its own button. */}
              <span id="standup-start-date" className="sr-only" />
            </div>
            <div className="w-40">
              <label
                htmlFor="standup-end-date"
                className="block text-[11px] font-medium text-[hsl(var(--muted-foreground))] mb-1"
              >
                End date
              </label>
              <MiniCalendarPicker
                value={endDate}
                onChange={handleEndDateChange}
                minDate={startDate}
              />
              <span id="standup-end-date" className="sr-only" />
            </div>

            <button
              type="button"
              onClick={generate}
              disabled={!canGenerate}
              className={cn(
                "h-[38px] px-4 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2",
                canGenerate
                  ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 cursor-pointer"
                  : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] cursor-not-allowed"
              )}
            >
              {isLoading && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
              {isLoading ? "Generating..." : hasGeneratedOnce ? "Regenerate" : "Generate standup"}
            </button>

            {hasGeneratedOnce && !isLoading && (
              <button
                type="button"
                onClick={handleClear}
                className="h-[38px] px-3 rounded-lg text-sm font-medium border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                Clear
              </button>
            )}
          </div>

          {/* ── Validation / status messages ── */}
          <div aria-live="polite" className="min-h-[1.25rem] shrink-0">
            {!range.valid && (
              <p className="text-xs text-red-500 mb-2">{range.error}</p>
            )}
            {range.valid && status === "error" && (
              <p className="text-xs text-red-500 mb-2">{statusMessage}</p>
            )}
            {range.valid && status === "empty" && (
              <p className="text-xs text-[hsl(var(--muted-foreground))] mb-2">{statusMessage}</p>
            )}
            {range.valid && status === "success" && statusMessage && (
              <p className="text-xs text-amber-500 mb-2">{statusMessage}</p>
            )}
          </div>

          {/* ── Editable output ── */}
          {showOutput && (
            <div className="relative flex-1 min-h-[12rem] flex flex-col">
              <label htmlFor="standup-output" className="sr-only">
                Generated standup update (editable)
              </label>
              <textarea
                id="standup-output"
                value={output}
                onChange={(e) => setOutput(e.target.value)}
                disabled={isLoading}
                placeholder={isLoading ? "Generating your standup update..." : undefined}
                className="w-full flex-1 min-h-[12rem] overflow-y-auto pl-3.5 pr-20 pt-3 pb-3 text-sm leading-relaxed rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] focus:outline-none transition disabled:opacity-60 resize-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              />
              <button
                type="button"
                onClick={handleCopy}
                disabled={!output}
                aria-label={copyFeedback ? "Copied to clipboard" : "Copy standup to clipboard"}
                className={cn(
                  "absolute top-2 right-2 h-7 px-2.5 rounded-md text-xs font-semibold border transition-colors flex items-center gap-1.5",
                  output
                    ? "border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] cursor-pointer"
                    : "border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))] opacity-50 cursor-not-allowed"
                )}
              >
                {copyFeedback ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copyFeedback ? "Copied" : "Copy"}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
