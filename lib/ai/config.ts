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

// `openrouter/free` auto-routes to a different underlying model on every
// request, which defeats consistent formatting/tone. It is never allowed.
const DISALLOWED_MODEL_IDS = new Set(["openrouter/free"]);

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
      'The auto-routed "openrouter/free" model is not allowed. Configure explicit OPENROUTER_MODEL / OPENROUTER_FALLBACK_MODEL values.'
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
