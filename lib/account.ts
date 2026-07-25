/**
 * Validation for the Account page's Email and Password forms. Kept separate
 * from lib/profile.ts, which owns the display-name data + validation shared
 * with the Dashboard greeting.
 */

export const PASSWORD_MIN_LENGTH = 8;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateNewEmail(raw: string, currentEmail: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return "Enter a new email address.";
  if (!EMAIL_REGEX.test(trimmed)) return "Enter a valid email address.";
  if (trimmed.toLowerCase() === currentEmail.trim().toLowerCase()) {
    return "This is already your current email.";
  }
  return null;
}

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
