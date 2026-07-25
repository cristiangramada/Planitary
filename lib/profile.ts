import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shared profile data helper — used by the Dashboard greeting and the Account
 * page so display-name loading/saving logic never diverges between them.
 */

export const DISPLAY_NAME_MAX_LENGTH = 50;

/** Trims and collapses a whitespace-only value to `null` (no personalization). */
export function normalizeDisplayName(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function validateDisplayName(raw: string): string | null {
  if (raw.trim().length > DISPLAY_NAME_MAX_LENGTH) {
    return `Display name must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer.`;
  }
  return null;
}

export async function fetchDisplayName(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase.from("profiles").select("display_name").maybeSingle();
  return normalizeDisplayName(data?.display_name ?? "");
}

/**
 * Saves the display name for the authenticated user. Upserts on `id` so a
 * missing profile row (there shouldn't be one — see the signup trigger) is
 * safely recreated rather than failing the save.
 */
export async function saveDisplayName(
  supabase: SupabaseClient,
  userId: string,
  email: string,
  raw: string
): Promise<string | null> {
  const value = normalizeDisplayName(raw);
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: userId, email, display_name: value }, { onConflict: "id" });
  if (error) throw error;
  return value;
}
