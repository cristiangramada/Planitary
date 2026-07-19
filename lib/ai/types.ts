// ---------------------------------------------------------------------------
// Feature-agnostic AI types, shared by every Planitary AI feature
// (Standup today; Search intent/expansion/reranking later).
// ---------------------------------------------------------------------------

/** Identifies which Planitary feature is requesting a generation. */
export type AIFeature = "standup" | "search-query" | "search-rerank";

/** Fully-resolved parameters for a single provider call. */
export interface GenerateTextInput {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  timeoutMs: number;
}

/** Raw result of a single provider call. */
export interface GenerateTextResult {
  text: string;
  /** The model ID that actually produced this text (per the provider's response). */
  model: string;
}

/** Per-feature model + generation-parameter configuration, resolved from env. */
export interface AIProviderConfig {
  apiKey: string;
  primaryModel: string;
  fallbackModel: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  timeoutMs: number;
}

/** Result of the fixed primary-then-fallback generation policy for a feature. */
export interface FeatureGenerationResult {
  text: string;
  model: string;
  usedFallback: boolean;
}
