/** Insertion indicator shown between rows while pointer-dragging to reorder.
 *  Shared by the Lists panel and the Tasks list so both read the same. */
export function ReorderDropLine() {
  return (
    <div
      className="mx-2 h-0.5 rounded-full bg-[hsl(var(--primary))] shrink-0"
      aria-hidden
    />
  );
}
