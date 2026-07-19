import type { AIFeature, FeatureGenerationResult, GenerateTextInput, GenerateTextResult } from "./types";
import { getFeatureConfig } from "./config";
import { AIError, isRetryableProviderError } from "./errors";

/**
 * Generic AI provider contract. Implementations (e.g. OpenRouter) must stay
 * feature-agnostic — no Journal/Standup/Search-specific logic belongs here.
 */
export interface AIProvider {
  generateText(input: GenerateTextInput): Promise<GenerateTextResult>;
}

interface GenerateForFeatureOptions {
  feature: AIFeature;
  systemPrompt: string;
  userPrompt: string;
  /** When set, unacceptable primary output triggers one fallback attempt. */
  isAcceptable?: (text: string) => boolean;
}

/**
 * Shared primary-then-fallback generation policy, reused by every AI
 * feature. Resolves the feature's configured model + parameters, attempts
 * the primary model once, and — only for a retryable provider-level failure
 * (unavailable model, rate limit, timeout) or an unacceptable primary
 * response — attempts the fallback model exactly once. Configuration errors
 * and non-retryable failures are never retried.
 */
export async function generateForFeature(
  provider: AIProvider,
  options: GenerateForFeatureOptions
): Promise<FeatureGenerationResult> {
  const config = getFeatureConfig(options.feature);
  const base = {
    systemPrompt: options.systemPrompt,
    userPrompt: options.userPrompt,
    temperature: config.temperature,
    topP: config.topP,
    maxTokens: config.maxTokens,
    timeoutMs: config.timeoutMs,
  };

  try {
    const primary = await provider.generateText({ ...base, model: config.primaryModel });
    if (!options.isAcceptable || options.isAcceptable(primary.text)) {
      return { text: primary.text, model: primary.model, usedFallback: false };
    }
  } catch (err) {
    if (!(err instanceof AIError) || !isRetryableProviderError(err.code)) {
      throw err;
    }
  }

  const fallback = await provider.generateText({ ...base, model: config.fallbackModel });
  if (options.isAcceptable && !options.isAcceptable(fallback.text)) {
    throw new AIError("INVALID_PROVIDER_RESPONSE", "Fallback response failed validation.");
  }
  return { text: fallback.text, model: fallback.model, usedFallback: true };
}
