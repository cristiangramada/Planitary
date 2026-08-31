import type { AIFeature, FeatureGenerationResult, GenerateTextInput, GenerateTextResult } from "./types";
import { getFeatureConfig, OPENROUTER_FREE_ROUTER } from "./config";
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
  /** When set, unacceptable output triggers the next model in the chain. */
  isAcceptable?: (text: string) => boolean;
}

/** Primary → configured fallback → OpenRouter free router (last resort). */
function buildModelChain(primaryModel: string, fallbackModel: string): string[] {
  const chain = [primaryModel];
  if (fallbackModel !== primaryModel) {
    chain.push(fallbackModel);
  }
  if (chain[chain.length - 1] !== OPENROUTER_FREE_ROUTER) {
    chain.push(OPENROUTER_FREE_ROUTER);
  }
  return chain;
}

/**
 * Shared generation policy, reused by every AI feature. Resolves the
 * feature's configured model + parameters, then tries each model in the chain
 * at most once. Moves to the next model only for a retryable provider-level
 * failure (unavailable, rate limited, timeout) or an unacceptable response.
 * Configuration errors and non-retryable failures are never retried.
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

  const models = buildModelChain(config.primaryModel, config.fallbackModel);

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const isFallback = i > 0;

    try {
      const result = await provider.generateText({ ...base, model });
      if (!options.isAcceptable || options.isAcceptable(result.text)) {
        return { text: result.text, model: result.model, usedFallback: isFallback };
      }
      if (i === models.length - 1) {
        throw new AIError("INVALID_PROVIDER_RESPONSE", "Response failed validation.");
      }
    } catch (err) {
      if (!(err instanceof AIError) || !isRetryableProviderError(err.code)) {
        throw err;
      }
      if (i === models.length - 1) {
        throw err;
      }
    }
  }

  throw new AIError("UNKNOWN", "Model chain exhausted without a result.");
}
