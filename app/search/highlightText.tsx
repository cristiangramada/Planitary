import { Fragment, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// Safe highlighting for search result text.
//
// The `search_planitary` RPC uses PostgreSQL's `ts_headline()` to wrap
// matched terms in journal/task-notes/event-details excerpts with a fixed,
// controlled marker: `<mark>...</mark>`. We never treat that as HTML —
// `renderMarkedText` just splits the plain-text string on the literal marker
// substrings and renders each segment as a React text node (via <mark>/
// <Fragment>), so React escapes everything automatically. This is safe even
// if the underlying content itself contains angle brackets, since nothing is
// ever parsed as markup — no `dangerouslySetInnerHTML` is used anywhere.
// ---------------------------------------------------------------------------

const START = "<mark>";
const STOP = "</mark>";

export function renderMarkedText(text: string): ReactNode {
  if (!text.includes(START)) return text;

  const parts: ReactNode[] = [];
  let rest = text;
  let key = 0;

  while (rest.length > 0) {
    const startIdx = rest.indexOf(START);
    if (startIdx === -1) {
      parts.push(<Fragment key={key++}>{rest}</Fragment>);
      break;
    }
    if (startIdx > 0) {
      parts.push(<Fragment key={key++}>{rest.slice(0, startIdx)}</Fragment>);
    }
    const afterStart = rest.slice(startIdx + START.length);
    const stopIdx = afterStart.indexOf(STOP);
    if (stopIdx === -1) {
      // Unterminated marker (shouldn't happen) — render the remainder as plain text.
      parts.push(<Fragment key={key++}>{afterStart}</Fragment>);
      break;
    }
    parts.push(<mark key={key++} className="bg-transparent text-[hsl(var(--primary))] font-semibold rounded-none">{afterStart.slice(0, stopIdx)}</mark>);
    rest = afterStart.slice(stopIdx + STOP.length);
  }

  return parts;
}

/**
 * Best-effort, case-insensitive highlight of a raw query string inside plain
 * (non-server-highlighted) text such as a task/event title. Only used for
 * exact literal substring matches — safe by construction since it only ever
 * renders text nodes.
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
