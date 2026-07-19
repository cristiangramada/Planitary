import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchStandupSource, validateStandupRange } from "@/lib/standup";
import { buildStandupPrompt, isValidStandupOutput } from "@/lib/ai/prompts/standup-prompt";
import { generateForFeature } from "@/lib/ai/provider";
import { OpenRouterProvider } from "@/lib/ai/openrouter-provider";
import { AIError, type AIErrorCode } from "@/lib/ai/errors";

export interface GenerateStandupRequest {
  startDate: string;
  endDate: string;
}

export interface GenerateStandupResponse {
  text: string;
  startDate: string;
  endDate: string;
  entryCount: number;
  usedFallback: boolean;
  truncated: boolean;
}

export interface GenerateStandupError {
  code: AIErrorCode;
  message: string;
}

const ERROR_STATUS: Record<AIErrorCode, number> = {
  NOT_CONFIGURED: 503,
  UNAUTHENTICATED: 401,
  INVALID_DATE_RANGE: 400,
  NO_SOURCE_ENTRIES: 200,
  RATE_LIMITED: 429,
  MODEL_UNAVAILABLE: 502,
  PROVIDER_TIMEOUT: 504,
  INVALID_PROVIDER_RESPONSE: 502,
  DATABASE_ERROR: 500,
  UNKNOWN: 500,
};

// User-safe messages only — never the raw provider/database error text.
const USER_MESSAGE: Record<AIErrorCode, string> = {
  NOT_CONFIGURED: "The AI provider isn't configured. Please contact the site administrator.",
  UNAUTHENTICATED: "Your session has expired. Please sign in again.",
  INVALID_DATE_RANGE: "Invalid date range.",
  NO_SOURCE_ENTRIES: "No journal entries were found for this date range.",
  RATE_LIMITED: "The AI provider is busy right now. Please try again shortly.",
  MODEL_UNAVAILABLE: "The AI provider is temporarily unavailable. Please try again shortly.",
  PROVIDER_TIMEOUT: "The AI provider took too long to respond. Please try again.",
  INVALID_PROVIDER_RESPONSE: "The AI provider returned an unexpected response. Please try again.",
  DATABASE_ERROR: "Something went wrong loading your journal entries.",
  UNKNOWN: "Something went wrong generating the standup. Please try again.",
};

export async function POST(request: Request) {
  const startedAt = Date.now();

  let body: Partial<GenerateStandupRequest>;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_DATE_RANGE", "Invalid request body.");
  }

  const startDate = typeof body.startDate === "string" ? body.startDate : "";
  const endDate = typeof body.endDate === "string" ? body.endDate : "";

  const range = validateStandupRange(startDate, endDate);
  if (!range.valid) {
    return errorResponse("INVALID_DATE_RANGE", range.error ?? "Invalid date range.");
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return errorResponse("UNAUTHENTICATED", USER_MESSAGE.UNAUTHENTICATED);
  }

  let source;
  try {
    // RLS scopes this to the authenticated user's own rows — no user_id is
    // ever accepted from the client.
    source = await fetchStandupSource(supabase, startDate, endDate);
  } catch {
    return errorResponse("DATABASE_ERROR", USER_MESSAGE.DATABASE_ERROR);
  }

  if (source.days.length === 0) {
    const response: GenerateStandupResponse = {
      text: "",
      startDate,
      endDate,
      entryCount: 0,
      usedFallback: false,
      truncated: false,
    };
    return NextResponse.json(response);
  }

  try {
    const prompt = buildStandupPrompt(source.days);
    const provider = new OpenRouterProvider(process.env.OPENROUTER_API_KEY ?? "");
    const result = await generateForFeature(provider, {
      feature: "standup",
      systemPrompt: prompt.system,
      userPrompt: prompt.user,
      isAcceptable: isValidStandupOutput,
    });

    logStandupRequest({
      status: 200,
      model: result.model,
      usedFallback: result.usedFallback,
      durationMs: Date.now() - startedAt,
    });

    const response: GenerateStandupResponse = {
      text: result.text,
      startDate,
      endDate,
      entryCount: source.entryCount,
      usedFallback: result.usedFallback,
      truncated: source.truncated,
    };
    return NextResponse.json(response);
  } catch (err) {
    const code = err instanceof AIError ? err.code : "UNKNOWN";
    logStandupRequest({
      status: ERROR_STATUS[code],
      usedFallback: false,
      durationMs: Date.now() - startedAt,
      code,
    });
    return errorResponse(code, USER_MESSAGE[code]);
  }
}

function errorResponse(code: AIErrorCode, message: string) {
  const body: GenerateStandupError = { code, message };
  return NextResponse.json(body, { status: ERROR_STATUS[code] });
}

/**
 * Safe, non-sensitive server-side logging only. Never logs API keys, full
 * prompts, journal content, AI responses, or auth tokens.
 */
function logStandupRequest(info: {
  status: number;
  model?: string;
  usedFallback: boolean;
  durationMs: number;
  code?: AIErrorCode;
}) {
  console.log("[ai/standup]", info);
}
