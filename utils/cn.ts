/**
 * Lightweight class name merger.
 * Joins truthy values and trims whitespace — no external dependency needed.
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ").trim();
}
