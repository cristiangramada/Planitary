"use client";

import { useId, useState } from "react";
import { AlertCircle, MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { validateNewEmail } from "@/lib/account";
import { AccountCard } from "./AccountCard";
import { inputClass, labelClass, primaryButtonClass, errorBannerClass, successBannerClass } from "./formStyles";

interface EmailSectionProps {
  currentEmail: string;
}

export function EmailSection({ currentEmail }: EmailSectionProps) {
  const inputId = useId();
  const errorId = useId();
  const [newEmail, setNewEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const clientError = newEmail.trim() ? validateNewEmail(newEmail, currentEmail) : null;
  const disabled = loading || newEmail.trim().length === 0 || !!clientError;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setSuccess(false);
    const validationError = validateNewEmail(newEmail, currentEmail);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (authError) {
        setError(mapEmailError(authError.message));
        return;
      }
      setSuccess(true);
    } catch {
      setError("Something went wrong. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AccountCard title="Email">
      <div className="text-sm">
        <span className="text-[hsl(var(--muted-foreground))]">Current email</span>
        <p className="font-medium mt-0.5 break-all">{currentEmail}</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
        <div>
          <label htmlFor={inputId} className={labelClass}>
            New email
          </label>
          <input
            id={inputId}
            type="email"
            autoComplete="email"
            value={newEmail}
            onChange={(e) => {
              setNewEmail(e.target.value);
              setSuccess(false);
              setError(null);
            }}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            className={inputClass}
            placeholder="you@example.com"
          />
        </div>

        {error && (
          <div id={errorId} role="alert" className={errorBannerClass}>
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div role="status" className={successBannerClass}>
            <MailCheck className="w-4 h-4 mt-0.5 shrink-0" />
            <span>Check your email to confirm the change.</span>
          </div>
        )}

        <div>
          <button type="submit" disabled={disabled} className={primaryButtonClass}>
            {loading ? "Updating…" : "Update email"}
          </button>
        </div>
      </form>
    </AccountCard>
  );
}

// Maps Supabase Auth error text to a safe, concise user-facing message —
// never surfaces the raw provider string.
function mapEmailError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("already") || lower.includes("registered") || lower.includes("exists")) {
    return "That email couldn't be used. Please try a different address.";
  }
  if (lower.includes("valid email") || lower.includes("invalid")) {
    return "Please enter a valid email address.";
  }
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (lower.includes("session") || lower.includes("expired") || lower.includes("jwt")) {
    return "Your session has expired. Please sign in again.";
  }
  return "Couldn't update your email. Please try again.";
}
