import type { AIFeature, AIProviderConfig } from "./types";
import { AIError } from "./errors";

// ---------------------------------------------------------------------------
// Central, server-only AI configuration. Changing a model or a generation
// parameter for a feature never requires touching the provider, the prompt
// builder, or any React component — only this file.
// ---------------------------------------------------------------------------

interface FeatureGenerationSettings {
  temperature: number;
  topP: number;
  maxTokens: number;
  timeoutMs: number;
}

const AI_FEATURE_SETTINGS: Record<AIFeature, FeatureGenerationSettings> = {
  standup: {
    temperature: 0.2,
    topP: 0.9,
    maxTokens: 500,
    timeoutMs: 20_000,
  },
  // Reserved for the future AI-assisted Search feature. Kept isolated so
  // Search can use different models/parameters (or a different provider
  // entirely) without any changes to the Standup feature.
  "search-query": {
    temperature: 0.2,
    topP: 0.9,
    maxTokens: 200,
    timeoutMs: 15_000,
  },
  "search-rerank": {
    temperature: 0,
    topP: 1,
    maxTokens: 300,
    timeoutMs: 15_000,
  },
};

// OpenRouter's free-model router — used only as an automatic last-resort
// fallback after configured models fail. Not allowed in env vars because it
// picks a different underlying model per request (inconsistent tone/format).
export const OPENROUTER_FREE_ROUTER = "openrouter/free";

const DISALLOWED_MODEL_IDS = new Set([OPENROUTER_FREE_ROUTER]);

/**
 * Resolves the fully-configured provider settings for a feature from
 * server-only environment variables. Throws a typed `AIError` (never a raw
 * provider/env error) when the AI provider isn't usable.
 */
export function getFeatureConfig(feature: AIFeature): AIProviderConfig {
  const settings = AI_FEATURE_SETTINGS[feature];
  const apiKey = process.env.OPENROUTER_API_KEY;
  const primaryModel = process.env.OPENROUTER_MODEL;
  const fallbackModel = process.env.OPENROUTER_FALLBACK_MODEL;

  if (!apiKey || !primaryModel || !fallbackModel) {
    throw new AIError(
      "NOT_CONFIGURED",
      `AI generation for "${feature}" is not configured. Set OPENROUTER_API_KEY, OPENROUTER_MODEL, and OPENROUTER_FALLBACK_MODEL.`
    );
  }
  if (DISALLOWED_MODEL_IDS.has(primaryModel) || DISALLOWED_MODEL_IDS.has(fallbackModel)) {
    throw new AIError(
      "NOT_CONFIGURED",
      'Set explicit OPENROUTER_MODEL / OPENROUTER_FALLBACK_MODEL values. "openrouter/free" is used automatically as a last-resort fallback — do not set it in env vars.'
    );
  }

  return {
    apiKey,
    primaryModel,
    fallbackModel,
    temperature: settings.temperature,
    topP: settings.topP,
    maxTokens: settings.maxTokens,
    timeoutMs: settings.timeoutMs,
  };
}

/** Non-throwing check, useful for feature-availability UI/diagnostics. */
export function isAIConfigured(feature: AIFeature): boolean {
  try {
    getFeatureConfig(feature);
    return true;
  } catch {
    return false;
  }
}
