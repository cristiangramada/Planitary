"use client";

import { useId, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DISPLAY_NAME_MAX_LENGTH, validateDisplayName, saveDisplayName } from "@/lib/profile";
import { AccountCard } from "./AccountCard";
import { inputClass, labelClass, primaryButtonClass, errorBannerClass, successBannerClass } from "./formStyles";

interface ProfileSectionProps {
  userId: string;
  email: string;
  initialDisplayName: string | null;
}

export function ProfileSection({ userId, email, initialDisplayName }: ProfileSectionProps) {
  const inputId = useId();
  const errorId = useId();
  const [name, setName] = useState(initialDisplayName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    setSuccess(false);
    const validationError = validateDisplayName(name);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const supabase = createClient();
      const saved = await saveDisplayName(supabase, userId, email, name);
      setName(saved ?? "");
      setSuccess(true);
    } catch {
      setError("Couldn't save your display name. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AccountCard title="Profile">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
        <div>
          <label htmlFor={inputId} className={labelClass}>
            Display name
          </label>
          <input
            id={inputId}
            type="text"
            autoComplete="name"
            maxLength={DISPLAY_NAME_MAX_LENGTH}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSuccess(false);
            }}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            className={inputClass}
            placeholder="Your name"
          />
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1.5">
            Used for personalized greetings in Planitary.
          </p>
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
            <span>Display name updated.</span>
          </div>
        )}

        <div>
          <button type="submit" disabled={saving} className={primaryButtonClass}>
            {saving ? "Saving…" : "Save name"}
          </button>
        </div>
      </form>
    </AccountCard>
  );
}
