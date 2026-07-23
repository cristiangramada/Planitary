import { type ReactNode } from "react";

// ---------------------------------------------------------------------------
// Safe highlighting for search result text.
//
// The `search_planitary` RPC may wrap FTS matches in `<mark>...</mark>` via
// ts_headline. We strip those and re-highlight the literal query substring
// instead — stemming otherwise marks the whole word (query "chill" → the
// entire "chilled"). Everything is rendered as React text nodes; no
// `dangerouslySetInnerHTML`.
// ---------------------------------------------------------------------------

const START = "<mark>";
const STOP = "</mark>";

/** Strips ts_headline `<mark>` wrappers so the client can re-highlight the literal query. */
export function stripHighlightMarks(text: string): string {
  return text.replaceAll(START, "").replaceAll(STOP, "");
}

/**
 * Best-effort, case-insensitive highlight of a raw query string inside plain
 * text. Only used for exact literal substring matches — safe by construction
 * since it only ever renders text nodes.
 */
export function highlightQuery(text: string, query: string): ReactNode {
  const trimmed = query.trim();
  if (!trimmed) return text;

  const lowerText = text.toLowerCase();
  const lowerQuery = trimmed.toLowerCase();
  const idx = lowerText.indexOf(lowerQuery);
  if (idx === -1) return text;

  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-transparent text-[hsl(var(--primary))] font-semibold rounded-none">
        {text.slice(idx, idx + trimmed.length)}
      </mark>
      {text.slice(idx + trimmed.length)}
    </>
  );
}
