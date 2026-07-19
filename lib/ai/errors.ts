// ---------------------------------------------------------------------------
// Shared, reusable AI error codes. Every AI feature (Standup, future Search)
// throws/handles these instead of raw provider errors, so the boundary
// between "our app" and "the AI provider" stays clean and safe to expose.
// ---------------------------------------------------------------------------

export type AIErrorCode =
  | "NOT_CONFIGURED"
  | "UNAUTHENTICATED"
  | "INVALID_DATE_RANGE"
  | "NO_SOURCE_ENTRIES"
  | "RATE_LIMITED"
  | "MODEL_UNAVAILABLE"
  | "PROVIDER_TIMEOUT"
  | "INVALID_PROVIDER_RESPONSE"
  | "DATABASE_ERROR"
  | "UNKNOWN";

export class AIError extends Error {
  readonly code: AIErrorCode;

  constructor(code: AIErrorCode, message: string) {
    super(message);
    this.name = "AIError";
    this.code = code;
  }
}

/**
 * Provider-level failures that justify a single fallback-model attempt.
 * Everything else (bad input, missing config, database errors) should not
 * trigger a fallback call.
 */
export function isRetryableProviderError(code: AIErrorCode): boolean {
  return code === "MODEL_UNAVAILABLE" || code === "RATE_LIMITED" || code === "PROVIDER_TIMEOUT";
}
