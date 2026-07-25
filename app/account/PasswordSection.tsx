"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PASSWORD_MIN_LENGTH, validatePasswordChange } from "@/lib/account";
import { AccountCard } from "./AccountCard";
import { inputClass, labelClass, primaryButtonClass, errorBannerClass, successBannerClass } from "./formStyles";

export function PasswordSection() {
  const router = useRouter();
  const currentId = useId();
  const nextId = useId();
  const confirmId = useId();
  const errorId = useId();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  function clearFields() {
    setCurrent("");
    setNext("");
    setConfirm("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setSuccess(false);
    const validationError = validatePasswordChange(current, next, confirm);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setLoading(true);
    const supabase = createClient();
    try {
      // Retrieve the authenticated email from the current session — never
      // trust a client-supplied value here.
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user?.email) {
        setError("Your session has expired. Please sign in again.");
        router.push("/login");
        return;
      }

      // Reauthenticate with the current password before allowing the change.
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: userData.user.email,
        password: current,
      });
      if (reauthError) {
        const lower = reauthError.message.toLowerCase();
        setError(
          lower.includes("rate limit") || lower.includes("too many")
            ? "Too many attempts. Please wait a moment and try again."
            : "Your current password is incorrect."
        );
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: next });
      if (updateError) {
        setError(mapPasswordError(updateError.message));
        return;
      }

      clearFields();
      setSuccess(true);
    } catch {
      setError("Something went wrong. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const type = showPassword ? "text" : "password";

  return (
    <AccountCard title="Password">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
        <div>
          <label htmlFor={currentId} className={labelClass}>
            Current password
          </label>
          <div className="relative">
            <input
              id={currentId}
              type={type}
              autoComplete="current-password"
              value={current}
              onChange={(e) => {
                setCurrent(e.target.value);
                setSuccess(false);
              }}
              aria-invalid={!!error}
              aria-describedby={error ? errorId : undefined}
              className={`${inputClass} pr-10`}
            />
            <ShowHideToggle show={showPassword} onToggle={() => setShowPassword((v) => !v)} />
          </div>
        </div>

        <div>
          <label htmlFor={nextId} className={labelClass}>
            New password
          </label>
          <div className="relative">
            <input
              id={nextId}
              type={type}
              autoComplete="new-password"
              value={next}
              onChange={(e) => {
                setNext(e.target.value);
                setSuccess(false);
              }}
              className={`${inputClass} pr-10`}
              placeholder={`Min. ${PASSWORD_MIN_LENGTH} characters`}
            />
            <ShowHideToggle show={showPassword} onToggle={() => setShowPassword((v) => !v)} />
          </div>
        </div>

        <div>
          <label htmlFor={confirmId} className={labelClass}>
            Confirm new password
          </label>
          <input
            id={confirmId}
            type={type}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              setSuccess(false);
            }}
            className={inputClass}
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
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            <span>Password updated successfully.</span>
          </div>
        )}

        <div>
          <button type="submit" disabled={loading} className={primaryButtonClass}>
            {loading ? "Updating…" : "Update password"}
          </button>
        </div>
      </form>
    </AccountCard>
  );
}

function ShowHideToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer"
      aria-label={show ? "Hide password" : "Show password"}
    >
      {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  );
}

// Maps Supabase Auth error text to a safe, concise user-facing message —
// never surfaces the raw provider string.
function mapPasswordError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("at least") || lower.includes("short") || lower.includes("weak")) {
    return "That password is too weak. Please choose a stronger password.";
  }
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (lower.includes("session") || lower.includes("expired") || lower.includes("jwt")) {
    return "Your session has expired. Please sign in again.";
  }
  if (lower.includes("same") || lower.includes("different")) {
    return "New password must be different from your current password.";
  }
  return "Couldn't update your password. Please try again.";
}
