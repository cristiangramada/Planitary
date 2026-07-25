import type { AuthError } from "@supabase/supabase-js";

/**
 * Validation for the Account page's Password form. Kept separate from
 * lib/profile.ts, which owns the display-name data + validation shared with
 * the Dashboard greeting.
 */

export const PASSWORD_MIN_LENGTH = 8;

/** Minimal shape we need from a Supabase AuthError — easy to construct in tests. */
type AuthErrorLike = Pick<AuthError, "message"> & { code?: AuthError["code"] };

export function validatePasswordChange(
  current: string,
  next: string,
  confirm: string
): string | null {
  if (!current) return "Enter your current password.";
  if (!next) return "Enter a new password.";
  if (next.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (next !== confirm) return "New passwords do not match.";
  if (next === current) return "New password must be different from your current password.";
  return null;
}

/**
 * Maps a reauthentication (`signInWithPassword`) failure during the password
 * change flow. Prefers `error.code` over message text — "invalid_credentials"
 * unambiguously means the current password was wrong, whereas message text
 * like "Invalid login credentials" could theoretically overlap with other
 * failures.
 */
export function mapReauthError(error: AuthErrorLike): string {
  switch (error.code) {
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Too many attempts. Please wait a moment and try again.";
    case "invalid_credentials":
      return "Your current password is incorrect.";
  }
  const lower = error.message.toLowerCase();
  if (lower.includes("rate limit") || lower.includes("too many") || lower.includes("security purposes")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  return "Your current password is incorrect.";
}

/**
 * Maps a Supabase Auth password-update error to a safe, concise user-facing
 * message — never surfaces the raw provider string. Prefers `error.code`
 * over message text, since message-based guessing is fragile and different
 * failures can share overlapping words.
 */
export function mapPasswordError(error: AuthErrorLike): string {
  switch (error.code) {
    case "weak_password":
      return "That password is too weak. Please choose a stronger password.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Too many attempts. Please wait a moment and try again.";
    case "session_expired":
    case "session_not_found":
    case "bad_jwt":
    case "refresh_token_not_found":
    case "refresh_token_already_used":
      return "Your session has expired. Please sign in again.";
    case "same_password":
      return "New password must be different from your current password.";
  }
  const lower = error.message.toLowerCase();
  if (lower.includes("at least") || lower.includes("short") || lower.includes("weak")) {
    return "That password is too weak. Please choose a stronger password.";
  }
  if (lower.includes("rate limit") || lower.includes("too many") || lower.includes("security purposes")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (lower.includes("session") || lower.includes("expired") || lower.includes("jwt") || lower.includes("claim")) {
    return "Your session has expired. Please sign in again.";
  }
  if (lower.includes("same") || lower.includes("different")) {
    return "New password must be different from your current password.";
  }
  return "Couldn't update your password. Please try again.";
}
